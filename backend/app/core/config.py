from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="AUGMENTO_",
        extra="ignore",
    )

    app_name: str = "Augmento API"
    environment: str = "development"
    cors_origins: list[str] = ["*"]
    promotion_audio_path: Path = Path(__file__).resolve().parents[2] / "assets" / "promotion.mpeg"
    media_timeout_seconds: float = 120.0
    max_upload_bytes: int = 250 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
