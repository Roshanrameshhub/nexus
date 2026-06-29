"""Persistent media storage (Cloudinary) with optional local fallback for dev."""

from __future__ import annotations

import io
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status

from app.config.settings import get_settings
from app.services.media_service import cloudinary_resource_type, is_local_upload_url, local_filename_from_url, mime_for_extension, parse_cloudinary_asset
from app.utils.paths import UPLOAD_DIR

logger = logging.getLogger(__name__)


class StorageService:
    def is_cloudinary_enabled(self) -> bool:
        settings = get_settings()
        return bool(
            settings.CLOUDINARY_CLOUD_NAME
            and settings.CLOUDINARY_API_KEY
            and settings.CLOUDINARY_API_SECRET
        )

    def _configure_cloudinary(self) -> None:
        import cloudinary

        settings = get_settings()
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

    def upload_bytes(
        self,
        content: bytes,
        *,
        original_filename: str | None,
        ext: str,
        mime_type: str | None = None,
    ) -> dict:
        if len(content) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

        resolved_mime = mime_type or mime_for_extension(ext)
        if self.is_cloudinary_enabled():
            return self._upload_cloudinary(content, original_filename, ext, resolved_mime)
        return self._upload_local(content, original_filename, ext, resolved_mime)

    def upload_file_path(self, file_path: Path, *, original_filename: str | None = None) -> dict:
        if not file_path.is_file():
            raise FileNotFoundError(str(file_path))
        ext = file_path.suffix.lstrip(".").lower()
        content = file_path.read_bytes()
        return self.upload_bytes(
            content,
            original_filename=original_filename or file_path.name,
            ext=ext,
            mime_type=mime_for_extension(ext),
        )

    def _upload_cloudinary(
        self,
        content: bytes,
        original_filename: str | None,
        ext: str,
        mime_type: str,
    ) -> dict:
        import cloudinary.uploader

        settings = get_settings()
        self._configure_cloudinary()
        resource_type = cloudinary_resource_type(ext, mime_type)

        try:
            result = cloudinary.uploader.upload(
                io.BytesIO(content),
                folder=settings.CLOUDINARY_FOLDER,
                resource_type=resource_type,
                use_filename=bool(original_filename),
                unique_filename=True,
                overwrite=False,
            )
        except Exception as exc:
            logger.exception(
                "[storage] Cloudinary upload failed original=%s ext=%s",
                original_filename,
                ext,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to upload media to cloud storage. Please try again.",
            ) from exc

        file_url = result.get("secure_url") or result.get("url")
        if not file_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Cloud storage did not return a valid media URL.",
            )

        bytes_used = int(result.get("bytes") or len(content))
        logger.info(
            "[storage] cloudinary original=%s url=%s bytes=%s resource_type=%s",
            original_filename,
            file_url,
            bytes_used,
            resource_type,
        )
        uploaded_at = datetime.now(timezone.utc)
        return {
            "file_name": original_filename or file_url.rsplit("/", 1)[-1],
            "file_url": file_url,
            "file_size": bytes_used,
            "mime_type": mime_type,
            "uploaded_at": uploaded_at.isoformat(),
        }

    def _upload_local(
        self,
        content: bytes,
        original_filename: str | None,
        ext: str,
        mime_type: str,
    ) -> dict:
        settings = get_settings()
        if not settings.DEBUG:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cloud storage is not configured. Set CLOUDINARY_* environment variables.",
            )

        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        unique_filename = f"{uuid.uuid4()}.{ext}"
        file_path = UPLOAD_DIR / unique_filename
        try:
            file_path.write_bytes(content)
        except OSError as exc:
            logger.exception("[storage] failed to write %s", file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload file: {exc}",
            ) from exc

        saved_size = file_path.stat().st_size
        if saved_size == 0:
            file_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Saved file is empty",
            )

        logger.warning(
            "[storage] saved locally (dev fallback) original=%s path=%s — configure Cloudinary for production",
            original_filename,
            file_path,
        )
        uploaded_at = datetime.now(timezone.utc)
        return {
            "file_name": original_filename or unique_filename,
            "file_url": f"/uploads/{unique_filename}",
            "file_size": saved_size,
            "mime_type": mime_type,
            "uploaded_at": uploaded_at.isoformat(),
        }

    def delete_media_url(self, url: str) -> None:
        if not url:
            return
        if "res.cloudinary.com" in url:
            self._delete_cloudinary(url)
        elif is_local_upload_url(url):
            self._delete_local(url)

    def delete_media_urls(self, urls: list[str]) -> None:
        for url in urls:
            self.delete_media_url(url)

    def _delete_cloudinary(self, url: str) -> None:
        if not self.is_cloudinary_enabled():
            logger.warning("[storage] skip cloudinary delete (not configured): %s", url)
            return
        parsed = parse_cloudinary_asset(url)
        if not parsed:
            logger.warning("[storage] could not parse cloudinary URL: %s", url)
            return
        public_id, resource_type = parsed
        import cloudinary.uploader

        self._configure_cloudinary()
        try:
            cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
            logger.info("[storage] deleted cloudinary asset public_id=%s", public_id)
        except Exception:
            logger.exception("[storage] failed to delete cloudinary asset %s", public_id)

    def _delete_local(self, url: str) -> None:
        filename = local_filename_from_url(url)
        if not filename:
            return
        file_path = UPLOAD_DIR / filename
        if file_path.is_file():
            try:
                file_path.unlink()
                logger.info("[storage] deleted local file %s", file_path)
            except OSError:
                logger.exception("[storage] failed to delete local file %s", file_path)


storage_service = StorageService()


def delete_media_urls(urls: list[str]) -> None:
    storage_service.delete_media_urls(urls)
