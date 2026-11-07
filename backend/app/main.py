import importlib.util
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from app import db as dbmod
from app import errors
from app.api import analysis, assistant, suppliers
from app.config import settings
from app.models import AnalysisRun

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    dbmod.Base.metadata.create_all(dbmod.engine)
    with dbmod.SessionLocal() as db:  # background runs don't survive a restart
        db.execute(update(AnalysisRun).where(AnalysisRun.status.in_(["queued", "running"]))
                   .values(status="failed", error="interrupted", finished_at=datetime.now(UTC)))
        db.commit()
    yield


app = FastAPI(title="SupplierLens API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
                   allow_methods=["*"], allow_headers=["*"])
errors.install(app)
app.include_router(suppliers.router)
app.include_router(analysis.router)
app.include_router(assistant.router)

if importlib.util.find_spec("app.api.voice"):  # Pranam's voice router (CONTRACT §2), registered once it exists
    from app.api import voice

    app.include_router(voice.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
