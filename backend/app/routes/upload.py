import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.utils.paths import UPLOAD_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
FILE_EXTENSIONS = {
    "pdf",
    "docx",
    "pptx",
    "xlsx",
    "txt",
    "zip",
    *IMAGE_EXTENSIONS,
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
}

# Magic-byte signatures for binary integrity (extension alone is not enough)
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


def _extension(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def _validate_magic(ext: str, content: bytes) -> None:
    signatures = MAGIC_CHECKS.get(ext)
    if not signatures:
        return
    if not any(content.startswith(sig) for sig in signatures):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File content does not match .{ext} format",
        )


def _validate_upload(filename: str | None, content: bytes, *, images_only: bool) -> str:
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    ext = _extension(filename)
    if not ext:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File must have an extension")
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=f"File type .{ext} is not allowed")
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
    _validate_magic(ext, content)
    return ext


def _save_upload(content: bytes, original_filename: str | None, ext: str) -> dict:
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    unique_filename = f"{uuid.uuid4()}.{ext}"
    file_path = UPLOAD_DIR / unique_filename
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except OSError as exc:
        logger.exception("[upload] failed to write %s", file_path)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to upload file: {exc}") from exc

    saved_size = file_path.stat().st_size
    if saved_size == 0:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Saved file is empty")

    mime_type = EXTENSION_MIME.get(ext, "application/octet-stream")
    logger.info(
        "[upload] original=%s saved=%s path=%s size=%s mime=%s",
        original_filename,
        unique_filename,
        file_path.resolve(),
        saved_size,
        mime_type,
    )

    uploaded_at = datetime.now(timezone.utc)
    return {
        "file_name": original_filename or unique_filename,
        "file_url": f"/uploads/{unique_filename}",
        "file_size": saved_size,
        "mime_type": mime_type,
        "uploaded_at": uploaded_at.isoformat(),
    }


@router.post("/images", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_images(files: list[UploadFile] = File(...)):
    uploaded_urls = []
    uploaded_files = []

    for file in files:
        content = await file.read()
        ext = _validate_upload(file.filename, content, images_only=True)
        meta = _save_upload(content, file.filename, ext)
        uploaded_urls.append(meta["file_url"])
        uploaded_files.append(meta)

    return {"urls": uploaded_urls, "files": uploaded_files, "count": len(uploaded_urls)}


@router.post("/files", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_files(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")

    uploaded_files = []
    for file in files:
        content = await file.read()
        ext = _validate_upload(file.filename, content, images_only=False)
        uploaded_files.append(_save_upload(content, file.filename, ext))

    if len(uploaded_files) == 1:
        return {"file": uploaded_files[0]}
    return {"files": uploaded_files, "count": len(uploaded_files)}
