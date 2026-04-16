from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.core.config import settings
from app.db.session import engine
from app.models import models
from app.api.v1 import api_router

# Auto-create tables on startup (safe for production — does not drop existing data)
# Migrations are handled by Alembic: run `alembic upgrade head` before first deploy
models.Base.metadata.create_all(bind=engine)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="uzLoads TMS API",
    description="Transportation Management System — uzLoads",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "uzLoads TMS API", "version": "1.0.0"}
