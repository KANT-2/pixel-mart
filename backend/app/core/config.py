from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경 변수 / backend/.env 에서 읽는 설정값 (.env.example 참고)"""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = "local"
    database_url: str = "postgresql+asyncpg://pixelmart:pixelmart@localhost:5432/pixelmart"
    jwt_secret: str = "local-dev-secret-change-me-please-32chars"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7일
    frontend_url: str = "http://localhost:3000"
    google_client_id: str = ""
    google_client_secret: str = ""
    # AI 픽셀 아바타 (Gemini) — 키가 없으면 AI 만들기만 꺼지고 나머지 기능은 그대로
    gemini_api_key: str = ""
    gemini_image_model: str = "gemini-nano-banana-2.1"
    ai_avatar_per_hour: int = 10

    @property
    def is_local(self) -> bool:
        return self.env == "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
