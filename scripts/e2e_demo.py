"""Browser end-to-end run of the demo flow (CONCEPT §12) against a running backend + frontend with an EMPTY database.

Also records a silent backup video of the demo (Playwright). Not a backend dependency; run with:

    uv run --with playwright python scripts/e2e_demo.py --audio question.wav --out e2e-out
    # first time: uv run --with playwright python -m playwright install chromium

--audio is a WAV file Chromium plays as the fake microphone (the spoken question).
WSL without Chromium's system libs: download libnss3/libnspr4/libasound2t64 with `apt-get download`, `dpkg -x` them
into a folder and point LD_LIBRARY_PATH at its usr/lib/x86_64-linux-gnu.
"""

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from demo_catalog import SUPPLIERS  # noqa: E402
from seed_demo import DATA, analyze_and_wait, request, upload  # noqa: E402

from playwright.sync_api import expect, sync_playwright  # noqa: E402

LIVE_UPLOAD = "alpha-delivery-performance.pdf"  # uploaded in the browser so the audience sees the score change
REAL_COMPANY = ("Northvolt", "SE")
results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")


def api_get(api: str, path: str):
    with urllib.request.urlopen(api + path, timeout=30) as r:
        return json.load(r)


def seed(api: str) -> None:
    if api_get(api, "/api/suppliers"):
        raise SystemExit("Database is not empty. Start the backend on an empty data dir for a clean demo run.")
    for s in SUPPLIERS:
        status, body = request("POST", f"{api}/api/suppliers",
                               data=json.dumps({k: s[k] for k in ("name", "country", "category", "criticality",
                                                                   "is_synthetic")}).encode(),
                               headers={"Content-Type": "application/json"})
        assert status == 201, body
        files = [f for f in s["files"] if f != LIVE_UPLOAD]
        upload(api, body["id"], files)
        analyze_and_wait(api, body["id"], s["name"])


def run(web: str, api: str, audio: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
                                          f"--use-file-for-fake-audio-capture={audio}", "--autoplay-policy=no-user-gesture-required"],
                                    slow_mo=120)
        ctx = browser.new_context(viewport={"width": 1280, "height": 820}, record_video_dir=str(out),
                                  record_video_size={"width": 1280, "height": 820})
        page = ctx.new_page()
        # "Failed to load resource" duplicates HTTP errors, which on_response already checks (with known exceptions)
        page.on("console", lambda m: m.type == "error" and not m.text.startswith("Failed to load resource")
                and errors.append(f"console: {m.text}"))
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        def on_response(r):
            # 404 on /risk is expected for a supplier that was never analysed
            if r.status >= 400 and not (r.status == 404 and r.url.endswith("/risk")) and "favicon" not in r.url:
                errors.append(f"HTTP {r.status} {r.request.method} {r.url}")
        page.on("response", on_response)

        try:
            steps(page, web, api, out)
        except Exception as e:
            page.screenshot(path=out / "FAILED.png", full_page=True)
            check("demo flow", False, f"{type(e).__name__}: {str(e).splitlines()[0]} | page: "
                  + page.inner_text("body")[-600:].replace("\n", " / "))
        ctx.close()
        browser.close()
    check("no browser/console/HTTP errors", not errors, "; ".join(errors[:5]))


def steps(page, web: str, api: str, out: Path) -> None:
        # 1. Dashboard
        page.goto(f"{web}/dashboard")
        dash = api_get(api, "/api/dashboard")
        expect(page.get_by_role("heading", name="Dashboard")).to_be_visible()
        page.wait_for_timeout(1500)
        check("dashboard renders", page.get_by_text("Alpha Präzisionsteile GmbH").first.is_visible(), str(dash["totals"]))
        page.screenshot(path=out / "1-dashboard.png", full_page=True)

        # 2. Supplier list → Alpha
        page.goto(f"{web}/suppliers")
        for s in SUPPLIERS:
            expect(page.get_by_role("link", name=s["name"])).to_be_visible()
        check("supplier list shows all seeded suppliers", True)
        check("synthetic badge shown", page.get_by_text("Synthetic demo data").first.is_visible())
        page.screenshot(path=out / "2-suppliers.png", full_page=True)
        page.get_by_role("link", name="Alpha Präzisionsteile GmbH").click()
        alpha_id = int(page.url.rstrip("/").split("/")[-1])
        before = api_get(api, f"/api/suppliers/{alpha_id}")
        expect(page.get_by_role("heading", name="Alpha Präzisionsteile GmbH")).to_be_visible()
        check("Alpha before live upload", before["classification"] == "medium", f"{before['overall_score']} {before['classification']}")
        page.screenshot(path=out / "3-alpha-before.png", full_page=True)

        # 3. Live upload → analysis stepper → new score
        page.locator('input[type="file"]').set_input_files(str(DATA / LIVE_UPLOAD))
        expect(page.get_by_text("Analyzing…")).to_be_visible(timeout=20_000)
        expect(page.get_by_role("button", name="Analyze", exact=True)).to_be_visible(timeout=120_000)
        after = api_get(api, f"/api/suppliers/{alpha_id}")
        expect(page.get_by_text(f"{after['overall_score']:.1f}").first).to_be_visible(timeout=10_000)
        check("Alpha after live upload", after["classification"] == "high", f"{after['overall_score']} {after['classification']}")
        check("missing-documents callout", page.get_by_text("Missing documents:").is_visible())

        # 4. Evidence → PDF page link works
        page.get_by_role("button", name="Evidence").first.click()
        link = page.get_by_role("link", name="Page 1").first
        expect(link).to_be_visible()
        pdf = page.request.get(link.get_attribute("href"))
        check("evidence opens source PDF", pdf.status == 200 and pdf.headers["content-type"] == "application/pdf")
        page.screenshot(path=out / "4-alpha-after-evidence.png", full_page=True)

        # 5. Approve an action
        page.get_by_role("button", name="Approve").first.click()
        expect(page.get_by_text("approved").first).to_be_visible()
        check("action approved", True)

        # 6. Add a real company live → web signals
        page.goto(f"{web}/suppliers")
        page.get_by_role("button", name="Add supplier").first.click()
        page.get_by_label("Name").fill(REAL_COMPANY[0])
        page.get_by_label("Country").fill(REAL_COMPANY[1])
        page.get_by_label("Category").fill("Battery cells")
        page.get_by_role("combobox", name="Criticality").click()
        page.get_by_role("option", name="High").click()
        page.get_by_role("dialog").get_by_role("button", name="Add supplier").click()
        page.get_by_role("link", name=REAL_COMPANY[0]).click()
        page.get_by_role("button", name="Analyze", exact=True).click()
        expect(page.get_by_role("button", name="Analyze", exact=True)).to_be_visible(timeout=180_000)
        nv_id = int(page.url.rstrip("/").split("/")[-1])
        signals = api_get(api, f"/api/suppliers/{nv_id}/signals")
        page.wait_for_timeout(1000)
        check("real company has web signals", len(signals) > 0 and page.get_by_text("source confirmed").first.is_visible(),
              f"{len(signals)} signals")
        page.screenshot(path=out / "5-northvolt.png", full_page=True)

        # 7. Assistant by voice (fake mic plays --audio)
        page.goto(f"{web}/assistant")
        expect(page.get_by_role("heading", name="Ask SupplierLens")).to_be_visible()
        with page.expect_response(lambda r: "/api/voice/transcribe" in r.url, timeout=60_000) as tr:
            page.get_by_role("button", name="Ask by voice").click()
            page.wait_for_timeout(5000)
            page.get_by_role("button", name="Stop recording").click()
        transcript = tr.value.json().get("text", "")
        check("voice transcribed", "risk" in transcript.lower(), repr(transcript))
        with page.expect_response(lambda r: "/api/voice/speak" in r.url, timeout=120_000) as sp:
            expect(page.get_by_text("AI-generated").first).to_be_visible(timeout=90_000)
        check("answer spoken (TTS)", sp.value.status == 200 and sp.value.headers["content-type"] == "audio/mpeg")
        chips = page.locator("button", has_text="[1]")
        check("answer has citations", chips.count() > 0)
        chips.first.click()
        page.wait_for_timeout(800)
        page.screenshot(path=out / "6-assistant-voice.png", full_page=True)

        # 8. German question via suggestion chip
        if page.get_by_role("button", name="Stop speaking").count():
            page.get_by_role("button", name="Stop speaking").click()
        page.get_by_label("Question").fill("Welche Dokumente fehlen bei Delta?")
        page.get_by_role("button", name="Ask", exact=True).click()
        expect(page.get_by_text("AI-generated").nth(1)).to_be_visible(timeout=90_000)
        german = page.locator("ol[aria-label=Conversation] li").last.inner_text()
        check("German question → German answer", any(w in german for w in (" fehlen", " Dokument", " und ")), german[:80])

        # 9. Phone width layout
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(f"{web}/suppliers/{alpha_id}")
        expect(page.get_by_role("heading", name="Alpha Präzisionsteile GmbH")).to_be_visible()
        wide = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        check("no horizontal scroll on phone width", not wide)
        page.screenshot(path=out / "7-alpha-mobile.png", full_page=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--web", default="http://localhost:3000")
    ap.add_argument("--api", default="http://localhost:8000")
    ap.add_argument("--audio", required=True, type=Path)
    ap.add_argument("--out", default=Path("e2e-out"), type=Path)
    a = ap.parse_args()
    t = time.time()
    seed(a.api.rstrip("/"))
    run(a.web.rstrip("/"), a.api.rstrip("/"), a.audio.resolve(), a.out)
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed in {time.time() - t:.0f}s")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
