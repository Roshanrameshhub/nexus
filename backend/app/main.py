import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError

from app.config.settings import get_settings
from app.database import init_db
from app.routes import api_router
from app.websocket.routes import router as ws_router

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Nexus — futuristic startup networking platform API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

_dev_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_cors_origins = list(dict.fromkeys([*settings.cors_origins_list, *_dev_origins]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount static files for uploads
uploads_dir = Path("uploads")
if uploads_dir.exists():
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(_: Request, exc: SQLAlchemyError):
    logger.error(f"SQLAlchemy Error: {exc.__class__.__name__}", exc_info=exc)
    logger.error(f"Error details: {str(exc)}")
    detail = "Database error"
    if settings.DEBUG:
        detail = f"{exc.__class__.__name__}: {str(exc)}"
    return JSONResponse(status_code=503, content={"detail": detail, "error_type": "database_error"})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {exc.__class__.__name__}", exc_info=exc)
    logger.error(f"Error details: {str(exc)}")
    detail = "Internal server error"
    if settings.DEBUG:
        detail = f"{exc.__class__.__name__}: {str(exc)}"
    return JSONResponse(status_code=500, content={"detail": detail, "error_type": "internal_error"})


app.include_router(api_router, prefix=settings.API_PREFIX)
app.include_router(ws_router, prefix=settings.API_PREFIX)


@app.get("/")
async def root():
    return {"name": settings.APP_NAME, "status": "ok", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
