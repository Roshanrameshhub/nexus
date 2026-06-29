import logging
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.utils.paths import UPLOAD_DIR

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Files"])

SAFE_FILENAME = re.compile(r"^[a-f0-9\-]+\.[a-z0-9]+$", re.IGNORECASE)

EXTENSION_MIME: dict[str, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "txt": "text/plain; charset=utf-8",
    "zip": "application/zip",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}


def _mime_for(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return EXTENSION_MIME.get(ext, "application/octet-stream")


@router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    if not SAFE_FILENAME.match(filename):
        logger.warning("[download] rejected unsafe filename: %s", filename)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")

    file_path = (UPLOAD_DIR / filename).resolve()
    if not str(file_path).startswith(str(UPLOAD_DIR.resolve())):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path")

    exists = file_path.is_file()
    size = file_path.stat().st_size if exists else 0
    mime = _mime_for(filename)
    logger.info(
        "[download] requested=%s exists=%s size=%s content_type=%s path=%s",
        filename,
        exists,
        size,
        mime,
        file_path,
    )

    if not exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if size == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File is empty")

    return FileResponse(
        path=file_path,
        media_type=mime,
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
