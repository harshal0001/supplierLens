import importlib.util
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app import db as dbmod
from app import errors
from app.api import analysis, assistant, suppliers
from app.config import settings
from app.models import AnalysisRun
from app.services import analysis as analysis_svc

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    dbmod.Base.metadata.create_all(dbmod.engine)
    with dbmod.SessionLocal() as db:  # background runs don't survive a restart
        active = db.scalars(select(AnalysisRun.id).where(AnalysisRun.status.in_(["queued", "running"]))).all()
    for run_id in active:  # same as a crash: the run and its running step become failed
        analysis_svc._mark_failed(run_id, "interrupted")
    with dbmod.SessionLocal() as db:
        # At most one active run per supplier, enforced by the DB (two fast "Analyze" clicks race otherwise).
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_active_run ON analysis_runs (supplier_id) "
                        "WHERE status IN ('queued', 'running')"))
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
