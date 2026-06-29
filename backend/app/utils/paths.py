from pathlib import Path

# backend/ directory (parent of app/)
BACKEND_ROOT = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BACKEND_ROOT / "uploads"
