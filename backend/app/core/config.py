import os
from typing import List

class Settings:
    ENV: str = os.environ.get("ENV", "development").lower()
    IS_PRODUCTION: bool = ENV == "production"
    
    ALGORITHM: str = "HS256"
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "marketplace_super_secret" if not IS_PRODUCTION else "")
    
    DB_URL: str = os.environ.get("DATABASE_URL", "sqlite:///./marketplace_v3.db")
    
    # Process DB_URL for SQLAlchemy 2.0
    if DB_URL.startswith("postgres://"):
        DB_URL = DB_URL.replace("postgres://", "postgresql+psycopg2://", 1)
    elif DB_URL.startswith("postgresql://"):
        DB_URL = DB_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
        
    if not SECRET_KEY and (IS_PRODUCTION or "postgres" in DB_URL):
        raise RuntimeError("SECRET_KEY environment variable must be set in production.")
    if not SECRET_KEY:
        SECRET_KEY = "marketplace_super_secret"
        
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.environ.get(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:80"
        ).split(",")
        if origin.strip()
    ]
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "")
    if FRONTEND_URL and FRONTEND_URL not in CORS_ORIGINS:
        CORS_ORIGINS.append(FRONTEND_URL)

settings = Settings()
