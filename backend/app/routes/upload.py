import logging

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.services.media_service import EXTENSION_MIME, validate_upload
from app.services.storage_service import storage_service

# Backward-compatible re-exports for verification route imports.
_validate_upload = validate_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("/images", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_images(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")

    uploaded_urls = []
    uploaded_files = []

    for file in files:
        content = await file.read()
        ext = validate_upload(file.filename, content, images_only=True)
        meta = storage_service.upload_bytes(content, original_filename=file.filename, ext=ext)
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
        ext = validate_upload(file.filename, content, images_only=False)
        uploaded_files.append(
            storage_service.upload_bytes(content, original_filename=file.filename, ext=ext)
        )

    if len(uploaded_files) == 1:
        return {"file": uploaded_files[0]}
    return {"files": uploaded_files, "count": len(uploaded_files)}
