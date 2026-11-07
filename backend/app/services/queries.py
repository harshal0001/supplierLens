"""Read helpers shared by routes and assistant tools. Returns API schema objects."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas as s
from app.errors import AppError
from app.models import Action, AnalysisRun, Assessment, Document, ExternalSignal, Indicator, Supplier
from app.services.risk_engine import SIGNAL_RULES, missing_documents


def supplier_or_404(db: Session, supplier_id: int) -> Supplier:
    sup = db.get(Supplier, supplier_id)
    if sup is None:
        raise AppError(404, f"Supplier {supplier_id} not found")
    return sup


def _latest_assessments(db: Session, ids: list[int]) -> dict[int, Assessment]:
    if not ids:
        return {}
    latest = (select(Assessment.supplier_id, func.max(Assessment.id).label("aid"))
              .where(Assessment.supplier_id.in_(ids)).group_by(Assessment.supplier_id).subquery())
    rows = db.scalars(select(Assessment).join(latest, Assessment.id == latest.c.aid)).all()
    return {a.supplier_id: a for a in rows}


def summaries(db: Session, sups: list[Supplier]) -> list[s.SupplierSummary]:
    ids = [x.id for x in sups]
    latest = _latest_assessments(db, ids)
    counts = dict(db.execute(select(Document.supplier_id, func.count()).where(Document.supplier_id.in_(ids))
                             .group_by(Document.supplier_id)).all()) if ids else {}
    out = []
    for x in sups:
        a = latest.get(x.id)
        out.append(s.SupplierSummary(
            id=x.id, name=x.name, country=x.country, category=x.category, criticality=x.criticality,
            is_synthetic=x.is_synthetic, overall_score=a.overall_score if a else None,
            classification=a.classification if a else None, confidence=a.confidence if a else None,
            last_assessed_at=a.created_at if a else None, document_count=counts.get(x.id, 0)))
    return out


def list_suppliers(db: Session) -> list[s.SupplierSummary]:
    out = summaries(db, list(db.scalars(select(Supplier).order_by(Supplier.name)).all()))
    return sorted(out, key=lambda x: (x.overall_score is None, -(x.overall_score or 0)))


def supplier_detail(db: Session, sup: Supplier) -> s.SupplierDetail:
    docs = db.scalars(select(Document).where(Document.supplier_id == sup.id).order_by(Document.id)).all()
    run = db.scalar(select(AnalysisRun).where(AnalysisRun.supplier_id == sup.id).order_by(AnalysisRun.id.desc()))
    return s.SupplierDetail(
        **summaries(db, [sup])[0].model_dump(), website=sup.website,
        documents=[s.SupplierDocument.model_validate(d) for d in docs],
        # Only processed documents count as "on file" (same rule the scoring/action plan uses).
        missing_documents=missing_documents({d.doc_type for d in docs if d.status == "processed"}, sup.criticality),
        latest_run=s.AnalysisRunOut.model_validate(run) if run else None)


def risk(db: Session, supplier_id: int) -> s.RiskAssessment | None:
    a = _latest_assessments(db, [supplier_id]).get(supplier_id)
    if a is None:
        return None
    inds = db.scalars(select(Indicator).where(Indicator.assessment_id == a.id)
                      .order_by(Indicator.severity.desc())).all()
    return s.RiskAssessment(id=a.id, supplier_id=a.supplier_id, overall_score=a.overall_score,
                            classification=a.classification, confidence=a.confidence, coverage=a.coverage,
                            categories=a.categories, indicators=[s.RiskIndicator.model_validate(i) for i in inds],
                            summary=a.summary, created_at=a.created_at)


def signal_out(x: ExternalSignal) -> s.ExternalSignalOut:
    cat, sev = SIGNAL_RULES.get(x.signal_type, (None, None))
    return s.ExternalSignalOut(id=x.id, title=x.title, url=x.url, published_at=x.published_at,
                               retrieved_at=x.retrieved_at, signal_type=x.signal_type, category=cat, severity=sev,
                               claim=x.claim, excerpt=x.excerpt, relevance=x.relevance,
                               verification_status=x.verification_status)


def signals(db: Session, supplier_id: int) -> list[s.ExternalSignalOut]:
    rows = db.scalars(select(ExternalSignal).where(ExternalSignal.supplier_id == supplier_id)
                      .order_by(ExternalSignal.published_at.desc().nulls_last())).all()
    return [signal_out(x) for x in rows]


_PRIO = {"high": 0, "medium": 1, "low": 2}


def actions(db: Session, supplier_id: int | None = None, open_only: bool = False) -> list[s.ActionItem]:
    q = select(Action, Supplier.name).join(Supplier, Supplier.id == Action.supplier_id)
    if supplier_id is not None:
        q = q.where(Action.supplier_id == supplier_id)
    if open_only:
        q = q.where(Action.status.in_(["proposed", "approved"]))
    rows = db.execute(q.order_by(Action.id.desc())).all()
    out = [action_out(a, name) for a, name in rows]
    return sorted(out, key=lambda x: _PRIO[x.priority])


def action_out(a: Action, supplier_name: str) -> s.ActionItem:
    return s.ActionItem(id=a.id, supplier_id=a.supplier_id, supplier_name=supplier_name, template_key=a.template_key,
                        title=a.title, rationale=a.rationale, priority=a.priority, status=a.status,
                        created_at=a.created_at)
