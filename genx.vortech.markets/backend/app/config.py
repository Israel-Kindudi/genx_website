from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    genx_root: str = "."
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 1440
    database_url: str = "sqlite:///./genx.db"
    allowed_origins: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()