"""Analysis pipeline: process_documents → external_research → score → recommend."""

import logging
import time
from datetime import UTC, date, datetime
from pathlib import Path

from sqlalchemy import delete, select

from app import db as dbmod
from app import llm
from app.facts import DocumentExtraction
from app.models import Action, AnalysisRun, Assessment, Chunk, Document, ExternalSignal, Indicator, Supplier
from app.services import extraction
from app.services import research as research_mod
from app.services import risk_engine as engine

log = logging.getLogger("supplierlens.analysis")
STEPS = ["process_documents", "external_research", "score", "recommend"]


def new_steps() -> list[dict]:
    return [{"name": n, "status": "pending", "error": None} for n in STEPS]


def run(run_id: int) -> None:
    """Never raises and never leaves the run queued/running: any crash is recorded via a fresh session."""
    try:
        _run(run_id)
    except Exception as e:
        log.exception("run %s crashed", run_id)
        _mark_failed(run_id, str(getattr(e, "message", None) or e)[:300])


def _mark_failed(run_id: int, error: str, attempts: int = 5) -> None:
    for i in range(attempts):  # the DB may be briefly locked by another writer
        try:
            with dbmod.SessionLocal() as db:
                r = db.get(AnalysisRun, run_id)
                if r is not None and r.status in ("queued", "running"):
                    r.status, r.error, r.finished_at = "failed", error, datetime.now(UTC)
                    r.steps = [{**x, "status": "failed", "error": x["error"] or error} if x["status"] == "running"
                               else x for x in r.steps]
                    db.commit()
            return
        except Exception:
            log.exception("could not mark run %s failed (attempt %s)", run_id, i + 1)
            time.sleep(1)


def _run(run_id: int) -> None:
    with dbmod.SessionLocal() as db:
        r = db.get(AnalysisRun, run_id)
        sup = db.get(Supplier, r.supplier_id)
        r.status = "running"
        db.commit()
        ctx: dict = {}

        def step(name: str, fn) -> bool:
            _set(db, r, name, "running")
            try:
                warn = fn()
                _set(db, r, name, "succeeded", warn)
                return True
            except Exception as e:
                db.rollback()
                log.exception("step %s failed (run %s)", name, run_id)
                _set(db, r, name, "failed", str(getattr(e, "message", None) or e)[:300])
                return False

        step("process_documents", lambda: _process_documents(db, sup))
        step("external_research", lambda: _research(db, sup))
        ok = step("score", lambda: _score(db, sup, r, ctx))
        if ok:
            step("recommend", lambda: _recommend(db, sup, ctx))
        else:
            _set(db, r, "recommend", "failed", "skipped: scoring failed")
        r.status = "succeeded" if ok else "failed"
        r.error = None if ok else "Scoring failed"
        r.finished_at = datetime.now(UTC)
        db.commit()


def _research(db, sup: Supplier) -> str | None:
    found = research_mod.research(db, sup)
    return None if found else "No relevant web signals found"


def _set(db, r: AnalysisRun, name: str, status: str, error: str | None = None) -> None:
    r.steps = [{**s, "status": status, "error": error} if s["name"] == name else s for s in r.steps]
    db.commit()


def _process_documents(db, sup: Supplier) -> str | None:
    docs = db.scalars(select(Document).where(Document.supplier_id == sup.id,
                                             Document.status.in_(["uploaded", "processing", "failed"]))).all()
    failed = 0
    for d in docs:
        d.status, d.error = "processing", None
        db.commit()
        try:
            # Slow work (PDF parsing + LLM) first, with no write transaction open: SQLite has a single writer lock.
            pages = extraction.extract_pages(Path(d.storage_path))
            ex = extraction.extract_facts(pages, d.filename)
            db.execute(delete(Chunk).where(Chunk.document_id == d.id))
            db.add_all(Chunk(document_id=d.id, supplier_id=sup.id, page_number=n, content=t)
                       for n, t in extraction.chunk_pages(pages))
            d.page_count = len(pages)
            if ex.doc_type != "other" or d.doc_type == "other":
                d.doc_type = ex.doc_type
            d.extracted = ex.model_dump(mode="json")
            d.status = "processed"
        except Exception as e:
            db.rollback()
            failed += 1
            log.warning("document %s failed: %s", d.id, e)
            d = db.get(Document, d.id)
            d.status, d.error = "failed", str(getattr(e, "message", None) or e)[:300]
        db.commit()
    return f"{failed} of {len(docs)} documents failed" if failed else None


def _score(db, sup: Supplier, r: AnalysisRun, ctx: dict) -> None:
    docs = db.scalars(select(Document).where(Document.supplier_id == sup.id, Document.status == "processed")).all()
    doc_inputs = [engine.DocInput(d.id, d.filename, DocumentExtraction.model_validate(d.extracted))
                  for d in docs if d.extracted]
    sigs = db.scalars(select(ExternalSignal).where(ExternalSignal.supplier_id == sup.id)).all()
    sig_inputs = [engine.SignalInput(s.id, s.title, s.url, s.signal_type, s.claim, s.excerpt,
                                     s.verification_status, s.published_at) for s in sigs]
    inds = engine.build_indicators(engine.SupplierInput(sup.name, sup.country, sup.criticality),
                                   doc_inputs, sig_inputs, date.today())
    a = engine.score(inds)
    row = Assessment(supplier_id=sup.id, run_id=r.id, overall_score=a.overall_score, classification=a.classification,
                     confidence=a.confidence, coverage=a.coverage, categories=a.categories)
    db.add(row)
    db.flush()
    db.add_all(Indicator(assessment_id=row.id, category=i.category, rule_key=i.rule_key, label=i.label[:300],
                         value=i.value, severity=i.severity, confidence=i.confidence, basis=i.basis,
                         evidence=i.evidence) for i in inds)
    db.commit()
    ctx.update(assessment=row, draft=a, indicators=inds, doc_types={d.doc_type for d in docs})


SUMMARY_SYSTEM = """Write a 2–3 sentence neutral summary of a supplier risk assessment for a procurement manager.
Use only the indicators given. Mention the main drivers and any risk categories that were not assessed for lack of
evidence. No advice beyond the facts, no markdown."""


def _recommend(db, sup: Supplier, ctx: dict) -> str | None:
    a, inds, row = ctx["draft"], ctx["indicators"], ctx["assessment"]
    open_actions = {x.template_key: x for x in db.scalars(select(Action).where(
        Action.supplier_id == sup.id, Action.status.in_(["proposed", "approved"])))}
    for x in engine.plan_actions(a, inds, sup.criticality, ctx["doc_types"]):
        existing = open_actions.get(x.template_key)
        if existing is None:
            db.add(Action(supplier_id=sup.id, assessment_id=row.id, template_key=x.template_key, title=x.title,
                          rationale=x.rationale, priority=x.priority))
        elif existing.status == "proposed":  # refresh wording to the latest assessment; approved ones stay as approved
            existing.title, existing.rationale, existing.priority = x.title, x.rationale, x.priority
            existing.assessment_id = row.id
    db.commit()
    lines = [f"- [{i.category}] {i.label}{f' ({i.value})' if i.value else ''}: severity {i.severity:.0f}, "
             f"basis {i.basis}" for i in inds]
    not_assessed = [c for c, v in a.categories.items() if v["score"] is None]
    try:
        row.summary = llm.text(SUMMARY_SYSTEM, f"Supplier: {sup.name}\nOverall: {a.overall_score} ({a.classification}), "
                                               f"coverage {a.coverage:.0%}\nNot assessed: {', '.join(not_assessed) or 'none'}\n"
                                               "Indicators:\n" + "\n".join(lines), max_tokens=300)
        db.commit()
    except Exception as e:
        db.rollback()
        log.warning("summary failed: %s", e)
        return "AI summary unavailable"
    return None
