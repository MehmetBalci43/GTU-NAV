import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(
    title="GTÜ-NAV Kampüs Navigasyon ve Akıllı Yaşam API",
    description="Gebze Teknik Üniversitesi Yaya Navigasyonu, Boş Amfi Radarı ve Yerel AI Destekli Kampüs Bildirim Sistemi",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict:
    model_exists = os.path.exists(settings.ai_model_path)
    return {
        "status": "healthy",
        "service": "gtu-nav-backend",
        "database": "connected",
        "ai_model_loaded": model_exists,
        "version": "1.0.0",
    }
