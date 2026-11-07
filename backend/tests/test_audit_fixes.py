"""Regressions from the backend e2e audit."""

from fastapi.testclient import TestClient

from app import db as dbmod
from app.models import AnalysisRun
from app.services import analysis
from tests.test_pipeline import make_supplier


def test_restart_fails_running_step_too(client):
    sid = make_supplier(client)
    steps = analysis.new_steps()
    steps[0]["status"], steps[1]["status"] = "succeeded", "running"
    with dbmod.SessionLocal() as db:
        run = AnalysisRun(supplier_id=sid, status="running", steps=steps)
        db.add(run)
        db.commit()
    from app.main import app

    with TestClient(app) as c:  # a second startup = server restart
        r = c.get(f"/api/runs/{run.id}").json()
    assert r["status"] == "failed" and r["error"] == "interrupted" and r["finished_at"]
    assert [x["status"] for x in r["steps"]] == ["succeeded", "failed", "pending", "pending"]
    assert r["steps"][1]["error"] == "interrupted"


def test_huge_ids_are_422_not_500(client):
    big = 10**20
    for method, url in [("get", f"/api/suppliers/{big}"), ("get", f"/api/runs/{big}"),
                        ("get", f"/api/documents/{big}/file"), ("post", f"/api/suppliers/{big}/analyze")]:
        r = getattr(client, method)(url)
        assert r.status_code == 422, (url, r.text)
        assert r.json()["error"]["code"] == "validation_error"
    r = client.post("/api/assistant/query", json={"question": "hi", "supplier_id": big})
    assert r.status_code == 422


def test_whitespace_question_rejected_before_llm(client):
    r = client.post("/api/assistant/query", json={"question": "  \n\t "})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"
