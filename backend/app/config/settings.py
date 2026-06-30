from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_CORS_ORIGINS = [
    "https://www.rconnectx.com",
    "https://rconnectx.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
]


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgre:yourpassword@localhost:5432/rconnectx"
    GNEWS_API_KEY: str = ""
    DEVTO_API_KEY: str = ""
    NEWS_API_KEY: str = ""

    # App
    APP_NAME: str = "RConnectX"
    DEBUG: bool = False
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    FRONTEND_URL: str = "https://www.rconnectx.com"

    # Security
    SECRET_KEY: str = "your-super-secret-key-change-this"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — comma-separated origins (matches Render/Vercel env var name)
    CORS_ORIGINS: str = Field(default=",".join(_DEFAULT_CORS_ORIGINS))

    # OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REFRESH_TOKEN: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = ""

    # Email (Resend)
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@rconnectx.com"

    # APIs
    OPENROUTER_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_FOLDER: str = "rconnectx"

    # VAPID Keys
    VAPID_PUBLIC_KEY: str = "04275ece093b27ce4a6d10c1c144d150a7c656524a2ae67a1feebd3cf454df3d38786446792a73e85ecd4fd2a4dfca24069b7b5ba6e0875b23d570660afeab670d"
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "mailto:admin@rconnectx.com"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        parsed = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return parsed or list(_DEFAULT_CORS_ORIGINS)

    @property
    def github_redirect_uri(self) -> str:
        if self.GITHUB_REDIRECT_URI:
            return self.GITHUB_REDIRECT_URI
        return f"{self.FRONTEND_URL.rstrip('/')}/github/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
