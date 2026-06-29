"""Migrate legacy /uploads files to Cloudinary and update database URLs.

Usage (from backend/):
    python scripts/migrate_uploads_to_cloudinary.py
    python scripts/migrate_uploads_to_cloudinary.py --dry-run

Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import AsyncSessionLocal
from app.models.message import Message
from app.models.post import Post
from app.models.user import User
from app.services.media_service import is_local_upload_url, local_filename_from_url, local_upload_path
from app.services.storage_service import storage_service
from app.utils.paths import UPLOAD_DIR


@dataclass
class MigrationReport:
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    dry_run: bool = False
    uploaded_files: list[dict] = field(default_factory=list)
    skipped_missing_files: list[str] = field(default_factory=list)
    failed_uploads: list[dict] = field(default_factory=list)
    updated_posts: int = 0
    updated_users: int = 0
    updated_messages: int = 0
    url_mappings: dict[str, str] = field(default_factory=dict)


def _replace_url(url: str | None, mappings: dict[str, str]) -> str | None:
    if not url:
        return url
    if url in mappings:
        return mappings[url]
    normalized = local_upload_path(url)
    if normalized in mappings:
        return mappings[normalized]
    return url


async def migrate(dry_run: bool) -> MigrationReport:
    if not storage_service.is_cloudinary_enabled():
        raise RuntimeError("Cloudinary is not configured. Set CLOUDINARY_* environment variables.")

    report = MigrationReport(dry_run=dry_run)

    if UPLOAD_DIR.is_dir():
        for file_path in sorted(UPLOAD_DIR.iterdir()):
            if not file_path.is_file():
                continue
            local_url = f"/uploads/{file_path.name}"
            if dry_run:
                exists = file_path.is_file()
                if exists:
                    report.uploaded_files.append({"local_url": local_url, "cloud_url": "(dry-run)"})
                else:
                    report.skipped_missing_files.append(local_url)
                continue
            try:
                meta = storage_service.upload_file_path(file_path)
                report.url_mappings[local_url] = meta["file_url"]
                report.uploaded_files.append({"local_url": local_url, "cloud_url": meta["file_url"]})
            except FileNotFoundError:
                report.skipped_missing_files.append(local_url)
            except Exception as exc:
                report.failed_uploads.append({"local_url": local_url, "error": str(exc)})

    async with AsyncSessionLocal() as db:
        posts = (await db.execute(select(Post))).scalars().all()
        for post in posts:
            changed = False
            new_media: list[str] = []
            for item in post.media or []:
                replacement = _maybe_map_existing(item, report)
                if replacement != item:
                    changed = True
                new_media.append(replacement)
            if new_media != (post.media or []):
                post.media = new_media
                changed = True

            if post.image_url:
                replacement = _maybe_map_existing(post.image_url, report)
                if replacement != post.image_url:
                    post.image_url = replacement
                    changed = True

            if changed:
                report.updated_posts += 1

        users = (await db.execute(select(User))).scalars().all()
        for user in users:
            if not user.profile_image or not is_local_upload_url(user.profile_image):
                continue
            replacement = _maybe_map_existing(user.profile_image, report)
            if replacement != user.profile_image:
                user.profile_image = replacement
                report.updated_users += 1

        messages = (await db.execute(select(Message))).scalars().all()
        for message in messages:
            meta = message.attachment_meta or {}
            file_url = meta.get("file_url")
            if not file_url or not is_local_upload_url(str(file_url)):
                continue
            replacement = _maybe_map_existing(str(file_url), report)
            if replacement != file_url:
                meta = dict(meta)
                meta["file_url"] = replacement
                message.attachment_meta = meta
                report.updated_messages += 1

        if not dry_run:
            await db.commit()

    return report


def _maybe_map_existing(url: str, report: MigrationReport) -> str:
    if not is_local_upload_url(url):
        return url

    normalized = local_upload_path(url)
    if normalized in report.url_mappings:
        return report.url_mappings[normalized]

    filename = local_filename_from_url(url)
    if not filename:
        report.skipped_missing_files.append(url)
        return url

    file_path = UPLOAD_DIR / filename
    if not file_path.is_file():
        report.skipped_missing_files.append(url)
        return url

    if report.dry_run:
        report.uploaded_files.append({"local_url": normalized, "cloud_url": "(dry-run)"})
        return url

    try:
        meta = storage_service.upload_file_path(file_path)
        report.url_mappings[normalized] = meta["file_url"]
        report.url_mappings[url] = meta["file_url"]
        report.uploaded_files.append({"local_url": normalized, "cloud_url": meta["file_url"]})
        return meta["file_url"]
    except Exception as exc:
        report.failed_uploads.append({"local_url": normalized, "error": str(exc)})
        return url


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate local uploads to Cloudinary")
    parser.add_argument("--dry-run", action="store_true", help="Report actions without uploading or committing")
    parser.add_argument(
        "--report-file",
        default="migration_report.json",
        help="Where to write the migration report JSON",
    )
    args = parser.parse_args()

    try:
        report = asyncio.run(migrate(dry_run=args.dry_run))
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    report_path = Path(args.report_file)
    report_path.write_text(json.dumps(report.__dict__, indent=2), encoding="utf-8")

    print(f"Migration {'(dry run) ' if report.dry_run else ''}complete")
    print(f"  Uploaded files: {len(report.uploaded_files)}")
    print(f"  Skipped missing: {len(report.skipped_missing_files)}")
    print(f"  Failed uploads: {len(report.failed_uploads)}")
    print(f"  Updated posts: {report.updated_posts}")
    print(f"  Updated users: {report.updated_users}")
    print(f"  Updated messages: {report.updated_messages}")
    print(f"  Report written to: {report_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
