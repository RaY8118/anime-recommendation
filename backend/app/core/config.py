from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    env: str = "DEVELOPMENT"
    allowed_origins: str = "*"
    mongodb_uri: str
    auth0_domain: str | None = None
    openrouter_api_key: str | None = None
    qdrant_cloud_endpoint: str | None = None
    qdrant_cloud_api_key: str | None = None
    redis_url: str | None = None
    redis_history_ttl: int = 86400

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
