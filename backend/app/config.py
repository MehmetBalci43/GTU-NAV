import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    environment: str = os.getenv("ENVIRONMENT", "production")
    port: int = int(os.getenv("PORT", "8000"))
    host: str = os.getenv("HOST", "0.0.0.0")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./gtu_nav.db")
    admin_secret_key: str = os.getenv("ADMIN_SECRET_KEY", "gtunav_admin_secret_2026")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "gtunav_jwt_secret_key_2026")
    ai_model_path: str = os.getenv("AI_MODEL_PATH", "weights/ticket_ai_model.joblib")
    cors_origins: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        raw_origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173",
        )
        origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
        object.__setattr__(self, "cors_origins", origins)


settings = Settings()
