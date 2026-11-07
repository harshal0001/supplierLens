"""Create the synthetic suppliers, upload their PDFs, and wait for analysis.

Re-runnable: a supplier whose name already exists is skipped.

    python scripts/seed_demo.py --api http://localhost:8000
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from demo_catalog import SUPPLIERS

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "demo-data"


def request(method: str, url: str, data: bytes | None = None, headers: dict | None = None, timeout: int = 60):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"error": {"code": "request_failed", "message": raw or error.reason}}
        return error.code, payload


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def existing_names(api: str) -> set[str]:
    status, body = request("GET", f"{api}/api/suppliers")
    if status != 200 or not isinstance(body, list):
        message = body.get("error", {}).get("message", body) if isinstance(body, dict) else body
        fail(f"Could not list suppliers ({status}): {message}")
    return {item["name"].casefold() for item in body}


def upload(api: str, supplier_id: int, filenames: list[str]) -> None:
    boundary = "----SupplierLensDemo"
    chunks: list[bytes] = []
    for filename in filenames:
        path = DATA / filename
        if not path.is_file():
            fail(f"Missing {path}. Run scripts/make_demo_docs.py first.")
        chunks.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="files"; filename="{filename}"\r\n'
            f"Content-Type: application/pdf\r\n\r\n".encode()
        )
        chunks.append(path.read_bytes())
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode())
    status, body = request(
        "POST",
        f"{api}/api/suppliers/{supplier_id}/documents",
        data=b"".join(chunks),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        timeout=120,
    )
    if status != 201:
        message = body.get("error", {}).get("message", body) if isinstance(body, dict) else body
        fail(f"Upload failed for supplier {supplier_id} ({status}): {message}")


def analyze_and_wait(api: str, supplier_id: int, name: str) -> None:
    status, body = request("POST", f"{api}/api/suppliers/{supplier_id}/analyze")
    if status != 202 or not isinstance(body, dict) or "id" not in body:
        message = body.get("error", {}).get("message", body) if isinstance(body, dict) else body
        fail(f"Analyze failed for {name} ({status}): {message}")
    run_id = body["id"]
    deadline = time.time() + 180
    while time.time() < deadline:
        status, run = request("GET", f"{api}/api/runs/{run_id}")
        if status != 200 or not isinstance(run, dict):
            fail(f"Could not read run {run_id} ({status})")
        print(f"  {name}: {run.get('status')}")
        if run.get("status") in {"succeeded", "failed"}:
            if run.get("status") == "failed":
                fail(f"Analysis failed for {name}: {run.get('error')}")
            return
        time.sleep(2)
    fail(f"Analysis timed out for {name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000")
    args = parser.parse_args()
    api = args.api.rstrip("/")
    names = existing_names(api)
    for supplier in SUPPLIERS:
        if supplier["name"].casefold() in names:
            print(f"skip {supplier['name']} (exists)")
            continue
        payload = {key: supplier[key] for key in ("name", "country", "category", "criticality", "is_synthetic")}
        status, body = request(
            "POST",
            f"{api}/api/suppliers",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        if status == 409:
            print(f"skip {supplier['name']} (exists)")
            continue
        if status != 201 or not isinstance(body, dict):
            message = body.get("error", {}).get("message", body) if isinstance(body, dict) else body
            fail(f"Create failed for {supplier['name']} ({status}): {message}")
        print(f"created {supplier['name']} (id {body['id']})")
        upload(api, body["id"], list(supplier["files"]))
        analyze_and_wait(api, body["id"], supplier["name"])


if __name__ == "__main__":
    main()
