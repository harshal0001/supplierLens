from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import schemas as s
from app.db import get_db
from app.errors import AppError
from app.models import Action, AnalysisRun, Document, Supplier
from app.services import analysis, queries
from app.services.risk_engine import _cert_key

router = APIRouter(prefix="/api")


@router.post("/suppliers/{supplier_id}/analyze", response_model=s.AnalysisRunOut, status_code=202)
def analyze(supplier_id: s.DbId, bg: BackgroundTasks, db: Session = Depends(get_db)):
    queries.supplier_or_404(db, supplier_id)

    def active():
        return db.scalar(select(AnalysisRun).where(AnalysisRun.supplier_id == supplier_id,
                                                   AnalysisRun.status.in_(["queued", "running"])))

    if existing := active():
        return existing
    run = AnalysisRun(supplier_id=supplier_id, steps=analysis.new_steps())
    db.add(run)
    try:
        db.commit()
    except IntegrityError:  # a concurrent request created the active run first (uq_active_run)
        db.rollback()
        if existing := active():
            return existing
        raise AppError(409, "An analysis was just started for this supplier, try again")
    # shortcut: in-process BackgroundTasks, lost on restart (recovered as failed); use a job queue for >1 instance
    bg.add_task(analysis.run, run.id)
    return run


@router.get("/runs/{run_id}", response_model=s.AnalysisRunOut)
def get_run(run_id: s.DbId, db: Session = Depends(get_db)):
    run = db.get(AnalysisRun, run_id)
    if run is None:
        raise AppError(404, "Run not found")
    return run


@router.get("/suppliers/{supplier_id}/risk", response_model=s.RiskAssessment)
def get_risk(supplier_id: s.DbId, db: Session = Depends(get_db)):
    queries.supplier_or_404(db, supplier_id)
    r = queries.risk(db, supplier_id)
    if r is None:
        raise AppError(404, "Supplier has not been analysed yet", "not_assessed")
    return r


@router.get("/suppliers/{supplier_id}/risk/history", response_model=list[s.RiskHistoryPoint])
def get_risk_history(supplier_id: s.DbId, db: Session = Depends(get_db)):
    queries.supplier_or_404(db, supplier_id)
    return queries.risk_history(db, supplier_id)


@router.get("/suppliers/{supplier_id}/signals", response_model=list[s.ExternalSignalOut])
def get_signals(supplier_id: s.DbId, db: Session = Depends(get_db)):
    queries.supplier_or_404(db, supplier_id)
    return queries.signals(db, supplier_id)


@router.get("/suppliers/{supplier_id}/actions", response_model=list[s.ActionItem])
def get_actions(supplier_id: s.DbId, db: Session = Depends(get_db)):
    queries.supplier_or_404(db, supplier_id)
    return queries.actions(db, supplier_id)


@router.patch("/actions/{action_id}", response_model=s.ActionItem)
def patch_action(action_id: s.DbId, body: s.ActionPatch, db: Session = Depends(get_db)):
    a = db.get(Action, action_id)
    if a is None:
        raise AppError(404, "Action not found")
    a.status = body.status
    db.commit()
    return queries.action_out(a, db.get(Supplier, a.supplier_id).name)


@router.get("/dashboard", response_model=s.Dashboard)
def dashboard(db: Session = Depends(get_db)):
    sups = queries.list_suppliers(db)
    totals = {"suppliers": len(sups), "high": 0, "medium": 0, "low": 0, "insufficient_data": 0, "not_assessed": 0}
    for x in sups:
        totals[x.classification or "not_assessed"] += 1

    names = {x.id: x.name for x in sups}
    certs: dict[tuple[int, str], s.DashboardCert] = {}
    today = date.today()
    for d in db.scalars(select(Document).where(Document.status == "processed")).all():
        for c in (d.extracted or {}).get("certifications", []):
            if not c.get("expires_on"):
                continue
            exp = date.fromisoformat(c["expires_on"])
            key = (d.supplier_id, _cert_key(c["standard"]))
            if key not in certs or certs[key].expires_on < c["expires_on"]:
                certs[key] = s.DashboardCert(supplier_id=d.supplier_id, supplier_name=names.get(d.supplier_id, "?"),
                                             standard=key[1], expires_on=c["expires_on"], days_left=(exp - today).days)
    expiring = sorted((c for c in certs.values() if c.days_left <= 90), key=lambda c: c.days_left)

    return s.Dashboard(totals=s.DashboardTotals(**totals),
                       top_risk=[x for x in sups if x.overall_score is not None][:5],
                       certifications=expiring, open_actions=queries.actions(db, open_only=True)[:8])
