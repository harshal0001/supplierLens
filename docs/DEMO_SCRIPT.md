# SupplierLens — Demo Script (≈ 4 minutes)

Story: **Upload a supplier document → analyse → identify risk → show evidence → ask by voice → spoken, cited answer → action plan.**
Every step below was run end to end in a real browser 3× from an empty database (`scripts/e2e_demo.py`, 15/15 checks each run).
Timings are from those runs.
Slides: [SupplierLens Pitch deck](https://claude.ai/artifact/7uqQni1T9a6PZBpjXndkr8) (8 slides, speaker notes included; private until shared from its Share menu).

## 0. Setup (15 min before, on the demo laptop)

```bash
# terminal 1 — backend on a fresh database
cd backend && rm -rf data && uv run uvicorn app.main:app --port 8000
# terminal 2 — frontend (production build is faster and calmer than dev)
cd frontend && pnpm build && pnpm start -p 3000
# terminal 3 — seed 4 synthetic suppliers, holding back Alpha's delivery report for the live upload (~60 s)
python3 scripts/seed_demo.py --skip alpha-delivery-performance.pdf
```

Checklist:
- [ ] Chrome, zoom 110 %, one tab on `http://localhost:3000/dashboard`, a second tab with the backup video ready
- [ ] Microphone allowed for `localhost:3000` (click "Ask by voice" once and stop it; this also warms up voice: the first voice reply of a session can take ~10 s)
- [ ] Ask one warm-up question on the Assistant page, then reload the page so the chat is empty
- [ ] Sound on, volume up
- [ ] `demo-data/alpha-delivery-performance.pdf` visible in the file explorer, ready to drag
- [ ] Expected state: Alpha **60.0 medium**, Beta 39.0 medium, Gamma 11.7 low, Delta 37.3 medium

## 1. The problem (30 s, slide 2)
> "A manufacturer with 50 suppliers keeps the information it needs to judge them in PDFs, spreadsheets and the news. By the time someone reads it, the supplier is already late."

## 2. Dashboard (20 s): `/dashboard`
- Show the KPI cards, the risk donut, **expiring certificates** (Alpha expired, Beta in 30 days) and open actions.
- Say: "Every supplier here is **synthetic demo data**. See the badge. Nothing is invented about real companies."

## 3. Live upload changes the risk (45 s): Suppliers → **Alpha Präzisionsteile GmbH**
- Show 60.0 **Medium**, "Based on 3 of 5 risk categories": operational and delivery are **Not assessed**, never shown as green.
- Drag `alpha-delivery-performance.pdf` onto "Drop PDFs here". The stepper runs (Process documents → Web research → Score → Recommend, ~15 s).
- The score jumps to **64.0 High**: the new delivery report shows 78 % on-time delivery.
- Say: "Claude extracts the facts, but the **score is deterministic code**: same evidence, same score, every time."

## 4. Evidence (30 s), same page
- Open **Evidence** under *On-time delivery rate*: the exact quote "On-time delivery rate: 78.0 %" and **Page 1**, which opens the source PDF.
- Point at the basis chips: *From document*, *AI interpretation*, *Reference data*. Say: "Every claim carries a quote and page, or a URL and date. If a quote isn't verbatim in the document, we drop the fact."

## 5. Action plan (15 s), same page
- Approve **"Identify and qualify an alternative supplier"**. Say: "Consequential actions always wait for a human."

## 6. A real company, live (40 s): Suppliers → **Add supplier**
- Name `Northvolt`, Country `SE`, Category `Battery cells`, Criticality **High** → open it → **Analyze** (~25 s).
- **Web signals** show real news (insolvency filings, plant closure), each with source, date and "source confirmed" / "unverified".
- Say: "Search results are leads, not proof. A signal only counts as confirmed when the quoted sentence names the company."

## 7. Ask by voice (45 s): **Assistant**
- Click **Ask by voice**: *"Which supplier has the highest risk, and what should we do next?"* → **Stop**.
- The answer appears with numbered source chips and is **spoken aloud** (~8 s in total). Click chip [1] to show the quote and the "Open source" link.
- Type, or say: *"Welche Dokumente fehlen bei Delta?"* → the answer comes back in German.

## 8. Close (20 s, slides 6–8)
> "SupplierLens turns scattered supplier documents and public signals into explainable, evidence-backed risk, and lets a procurement manager simply ask."

## Fallbacks (decide in 2 seconds, don't debug on stage)

| Step | If this happens | Do this |
|---|---|---|
| any | Backend/frontend error page | Switch to the backup video tab (`demo-data/out/supplierlens-demo-backup.webm`) and narrate over it |
| 3 | Analysis takes > 30 s or fails | Say "while it runs…", go to step 4 on **Beta**; come back to Alpha later |
| 6 | Exa slow / "Web research unavailable" | The score still uses documents and that's honest; show a pre-added Northvolt (add it during setup as plan B) |
| 7 | Mic blocked or not heard | Click a suggestion chip or type the question; voice output still plays |
| 7 | No sound | Untick "Read answers aloud" and read the answer yourself |
| 7 | Assistant error / rate limit (20 per min) | Wait 10 s and retry once, then use the video |

## 60-second pitch

> Every business depends on suppliers, but most small and medium-sized manufacturers have no reliable way to see when a supplier becomes a risk.
> The information is there: in financial reports, certificates, delivery data and the news. But it's scattered, and nobody has time to read it all.
> SupplierLens brings it together. Upload supplier documents, and it extracts the facts with their exact source, searches public news, and calculates an explainable risk score: the same evidence always gives the same score, and missing data is never treated as safe.
> It then proposes an action plan that a human approves.
> And procurement managers can simply ask, by voice, in English or German: "Which supplier is putting my production at risk?", and get a spoken answer with sources.
> We're starting with German manufacturing SMEs: an accessible, evidence-first alternative to complex enterprise risk platforms.
> **SupplierLens: know your suppliers before their risks become your business problems.**

## Honest answers for judges
- **Is the score AI?** No. It's rules plus a weighted formula (`backend/app/services/risk_engine.py`, CONTRACT §5). Claude only extracts quoted facts, classifies news into fixed types and writes the labelled summary.
- **Can it hallucinate?** Facts without a verbatim quote are dropped. The assistant can only cite evidence ids its tools returned. Others are removed.
- **Real data?** Only Northvolt (public news). All other suppliers are synthetic and labelled.
- **Validated demand?** Not yet. Customer interviews are the next step (CONCEPT §2.5).
- **Prototype limits:** no login or multi-tenancy, SQLite, single server. Each one is marked `shortcut:` in the code.
