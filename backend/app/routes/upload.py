import os
import uuid
from fastapi import APIRouter, File, UploadFile, status
from pathlib import Path

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "pdf", "mp4", "mov", "avi"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/images", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_images(files: list[UploadFile] = File(...)):
    uploaded_urls = []

    for file in files:
        if file.size > MAX_FILE_SIZE:
            return {
                "error": f"File {file.filename} exceeds maximum size of 5MB",
                "status_code": 413,
            }

        ext = file.filename.split(".")[-1].lower() if file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            return {
                "error": f"File type .{ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
                "status_code": 415,
            }

        unique_filename = f"{uuid.uuid4()}.{ext}"
        file_path = UPLOAD_DIR / unique_filename

        try:
            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            uploaded_urls.append(f"/uploads/{unique_filename}")
        except Exception as e:
            return {
                "error": f"Failed to upload {file.filename}: {str(e)}",
                "status_code": 500,
            }

    return {"urls": uploaded_urls, "count": len(uploaded_urls)}
