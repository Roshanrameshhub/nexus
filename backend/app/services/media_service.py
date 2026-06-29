"""Shared media validation and URL helpers."""

from __future__ import annotations

from fastapi import HTTPException, status

IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
VIDEO_EXTENSIONS = {"mp4", "mov", "webm"}
FILE_EXTENSIONS = {
    "pdf",
    "docx",
    "pptx",
    "xlsx",
    "txt",
    "zip",
    *IMAGE_EXTENSIONS,
    *VIDEO_EXTENSIONS,
}
BLOCKED_EXTENSIONS = {
    "exe",
    "bat",
    "cmd",
    "com",
    "scr",
    "vbs",
    "js",
    "jar",
    "msi",
    "dll",
    "bin",
    "sh",
    "app",
    "dmg",
    "ps1",
    "php",
    "html",
    "htm",
}

EXTENSION_MIME: dict[str, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "txt": "text/plain",
    "zip": "application/zip",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
}

MAGIC_CHECKS: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "gif": (b"GIF87a", b"GIF89a"),
    "zip": (b"PK\x03\x04",),
    "docx": (b"PK\x03\x04",),
    "pptx": (b"PK\x03\x04",),
    "xlsx": (b"PK\x03\x04",),
}

MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_FILE_SIZE = 15 * 1024 * 1024


def extension(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def mime_for_extension(ext: str) -> str:
    return EXTENSION_MIME.get(ext, "application/octet-stream")


def cloudinary_resource_type(ext: str, mime_type: str) -> str:
    if ext in VIDEO_EXTENSIONS or mime_type.startswith("video/"):
        return "video"
    if ext in IMAGE_EXTENSIONS or mime_type.startswith("image/"):
        return "image"
    return "raw"


def is_local_upload_url(url: str | None) -> bool:
    if not url:
        return False
    return "/uploads/" in url


def local_filename_from_url(url: str) -> str | None:
    if "/uploads/" not in url:
        return None
    return url.rsplit("/uploads/", 1)[-1].split("?")[0] or None


def local_upload_path(url: str) -> str:
    filename = local_filename_from_url(url)
    return f"/uploads/{filename}" if filename else url


def validate_magic(ext: str, content: bytes) -> None:
    signatures = MAGIC_CHECKS.get(ext)
    if not signatures:
        return
    if not any(content.startswith(sig) for sig in signatures):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File content does not match .{ext} format",
        )


def validate_upload(filename: str | None, content: bytes, *, images_only: bool) -> str:
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    ext = extension(filename)
    if not ext:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File must have an extension")
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type .{ext} is not allowed",
        )
    allowed = IMAGE_EXTENSIONS if images_only else FILE_EXTENSIONS
    if ext not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type .{ext} not allowed. Allowed: {', '.join(sorted(allowed))}",
        )
    max_size = MAX_IMAGE_SIZE if images_only else MAX_FILE_SIZE
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {max_size // (1024 * 1024)}MB",
        )
    validate_magic(ext, content)
    return ext


def collect_post_media_urls(media: list[str] | None, image_url: str | None) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []
    for url in [*list(media or []), *( [image_url] if image_url else [])]:
        if url and url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def parse_cloudinary_asset(url: str) -> tuple[str, str] | None:
    from urllib.parse import urlparse

    if "res.cloudinary.com" not in url:
        return None
    parts = urlparse(url).path.strip("/").split("/")
    if len(parts) < 4 or parts[1] not in {"image", "video", "raw"} or parts[2] != "upload":
        return None
    resource_type = parts[1]
    remainder = parts[3:]
    cleaned: list[str] = []
    for part in remainder:
        if part.startswith("v") and len(part) > 1 and part[1:].isdigit():
            continue
        cleaned.append(part)
    if not cleaned:
        return None
    public_id = "/".join(cleaned)
    last_segment = public_id.rsplit("/", 1)[-1]
    if "." in last_segment:
        public_id = public_id.rsplit(".", 1)[0]
    return public_id, resource_type
