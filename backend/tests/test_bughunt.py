"""Regression tests for the fresh-eyes bug hunt."""

from app import db as dbmod
from app.services.assistant import _Turn
from tests.test_pipeline import PDF, fakes, make_supplier, run_analysis  # noqa: F401 (fixture)


def test_compare_suppliers_accepts_string_ids(client, fakes):  # noqa: F811
    sid = make_supplier(client)
    client.post(f"/api/suppliers/{sid}/documents", files=[("files", ("otd_report.pdf", PDF, "application/pdf"))])
    run_analysis(client, sid)
    with dbmod.SessionLocal() as db:
        row = _Turn(db).compare_suppliers([str(sid)])[0]
    assert row["id"] == sid and row["classification"] != "not_assessed" and "overall_score" in row
