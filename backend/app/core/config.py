import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "sqlite:///./app.db"

    # JWT — auto-generated if not set in .env
    SECRET_KEY: str = secrets.token_hex(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h

    # Master encryption key for AES-256-GCM (API Key storage)
    MASTER_ENCRYPTION_KEY: str = ""

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    # Tencent Cloud COS
    COS_SECRET_ID: str = ""
    COS_SECRET_KEY: str = ""
    COS_REGION: str = ""
    COS_BUCKET: str = ""


settings = Settings()