# SupplierLens: Round 1 Pitch (90 s) + Demo (90 s)

> **Know your supplier before a missed delivery tells you.**

---

## Part 1: The pitch (≈ 85–90 s, 213 words; rehearse with a timer. Running long? Cut the "80 percent" sentence: −27 words, about 11 s)

Speak at a calm pace (~145 words/min). **Bold** = stress the word. `/` = short breath. `(pause)` = a full second of silence.

### 0:00 · The hook (story)
> A friend of mine runs a busy restaurant. / One Thursday, the supplier's truck didn't come.
> That supplier had been failing for **months**. / The proof was a PDF / sitting in an inbox.
> They found out / when the food ran out.
>
> *(pause)*

### 0:18 · Why now (the stakes)
> Last year, around **24,000** German companies went insolvent, the most in over a decade.
> **Every one of them was somebody's supplier.**
> Almost **80 percent** of organisations had their supply chain disrupted in a single year, and the **number-one cause** was a supplier or partner failing them.

### 0:38 · The insight (why nobody sees it coming)
> The warning signs are usually already there, in financial reports, expired certificates, delivery data and the news.
> But with 150 suppliers, nobody reads it all. / So they check by hand, / once a year.

### 0:52 · The solution (what we built)
> **SupplierLens reads it for them.**
> Upload the documents you already have. We pull out every fact **with its exact quote and page**, add public news, and score the risk with fixed rules: / **same evidence, same score.**
> Missing evidence stays **grey**, / never green.
> And then you just ask, out loud: / *"Which supplier could stop my line?"* / and hear the answer, with its sources, in English or German.

### 1:20 · The close (hand off to the demo)
> We're starting with German manufacturing SMEs, as a monthly subscription.
> It's built, / and I'll show you right now.
>
> **Know your supplier before a missed delivery tells you.**

**Only tell the restaurant story if it really happened.** If it didn't, open with the numbers instead:
*"Last year, around 24,000 German companies went insolvent. Every one of them was somebody's supplier."*

### Why it's built this way
- **Story, then stakes, then insight, then product, then proof.** The judges feel the problem before they hear a feature.
- **Two numbers only**, both checked (see the evidence section below). The local one (Germany) lands harder than any global average.
- **"Every one of them was somebody's supplier"** is the line judges repeat. Say it slowly.
- **Three differentiators, each in one breath:** quote and page, same evidence gives the same score, grey not green. Then **voice** as the memorable moment.
- **"It's built" plus an immediate handoff:** you're showing something real, not a plan. That separates you from slide-only teams.
- **Closing line:** a sharper version of the tagline. It echoes the truck story, so the pitch ends where it began.

### Optional slides (3 at most during the pitch)
| When | Slide |
|---|---|
| 0:00 | Black background, white text: *"One Thursday, the truck didn't come."* |
| 0:18 | Huge **24,000**, small caption: *German company insolvencies, 2025 (Creditreform)* |
| 0:52 | One screenshot: the Alpha supplier page with score, evidence quote and page link (`demo-data/out/4-alpha-after-evidence.png`) |

---

## Part 2: The demo (90 s)

### Before you go on stage (15 min before)
- [ ] Backend and frontend running. Database seeded **with Alpha's delivery report held back**:
  `python3 scripts/seed_demo.py --skip alpha-delivery-performance.pdf`
- [ ] **Northvolt** added and analysed in advance (don't analyse it live in round 1: it takes about 25 seconds)
- [ ] **Voice warmed up:** ask one question on the Assistant page, then reload it. The first voice reply of a session can take about 10 seconds
- [ ] Microphone allowed in Chrome, sound on, browser zoom 110%
- [ ] `demo-data/alpha-delivery-performance.pdf` visible in a file-explorer window, ready to drag
- [ ] Backup video open in a second tab: `demo-data/out/supplierlens-demo-backup.webm`

### Script
| Time | On screen | You say |
|---|---|---|
| 0:00 | **Dashboard** | "Four suppliers. All synthetic demo data, see the badge. One certificate has already expired." |
| 0:08 | **Alpha Präzisionsteile**: **60, Medium**; Delivery shows **Not assessed** (grey) | "We have no delivery data for Alpha yet, so delivery stays grey. We never call missing data safe." |
| 0:18 | **Drag in** `alpha-delivery-performance.pdf` | *(during the ~15 s analysis)* "Their latest delivery report just arrived. SupplierLens reads it, checks the news, and re-scores." |
| 0:33 | **64, High** → click **Evidence** under *On-time delivery* → **Page 1** opens the PDF | "78 percent on time. And here's the exact line, on the exact page. Every number has proof." |
| 0:48 | **Assistant** → **Ask by voice**: *"Which supplier has the highest risk, and what should we do next?"* → **Stop** | *(let the spoken answer play, about 8 s)* |
| 1:05 | Click source chip **[1]** | "Every sentence links back to its source." |
| 1:12 | **Approve** the proposed action | "And nothing happens without a human approving it." |
| 1:20 | (stay on the screen) | "**Know your supplier before a missed delivery tells you.**" |

### If something breaks (decide in 2 seconds, don't debug on stage)
| Problem | Do this |
|---|---|
| Analysis is slow (> 25 s) | Keep talking, then switch to **Beta** for the evidence step |
| Mic blocked or not heard | Click the suggestion chip *"Which supplier has the highest risk, and why?"* |
| No sound | Read the first two sentences of the answer aloud yourself |
| Anything crashes | Switch to the backup-video tab and narrate over it |

---

## Part 3: Round 2 preparation (likely judge questions)

| Question | Honest answer |
|---|---|
| "Is the score just AI?" | "No. Claude extracts quoted facts and classifies news into fixed types. The score comes from deterministic rules and a weighted formula, so the same evidence always gives the same score." |
| "Can it hallucinate?" | "A fact whose quote isn't word for word in the document is dropped. The assistant can only cite evidence that its tools returned; anything else is removed." |
| "Why not Prewave or Dun & Bradstreet?" | "They're built for large enterprises. We start from the documents an SME already has, explain every score, and let you ask by voice. We'd validate that gap in customer interviews; we don't claim those tools can't do it." |
| "Is this real data?" | "Northvolt is real public news. All other suppliers are synthetic and labelled." |
| "Have customers validated this?" | "Not yet. Interviews with procurement managers are our next step. Our pricing (from €49/month) is a hypothesis we'll test with pilots." |
| "What are the prototype limits?" | "No login or multi-tenancy yet, SQLite, one server. Each one is marked in the code, with how we'd upgrade it." |
| "How did you test it?" | "79 backend tests, plus a browser test that runs the full demo from an empty database. It passed 15 of 15 checks in 3 runs." |

---

## Part 4: Evidence for every number

| Claim in the pitch | Source | Exact finding |
|---|---|---|
| "Around **24,000** German companies went insolvent last year, the most in over a decade" | Creditreform, Dec 2025, as reported by [Yahoo Finance](https://uk.finance.yahoo.com/news/german-corporate-insolvencies-reach-decade-122413913.html), [Xinhua](https://english.news.cn/20251209/636781975e6a4b92bb35ea7881fd6728/c.html) and [IDT](https://www.idt.media/markets/insolvencies-2025-highest-level-in-ten-years/2574460) | About **23,900** corporate insolvencies in 2025 (+8.3%), **highest since 2014**. A later count cited as Federal Statistical Office data gives 24,064 (not checked against the official source), so "around 24,000" is safe either way |
| "Almost **80 percent** of organisations had their supply chain disrupted in a single year" | [BCI Supply Chain Resilience Report 2024: press release](https://www.thebci.org/news/supply-chain-disruptions-drive-increased-tier-mapping-and-insurance-uptake.html) ([report page](https://www.thebci.org/resource/bci-supply-chain-resilience-report-2024.html)) | "Almost 80% of organizations' supply chains were disrupted over the past twelve months" |
| "The **number-one cause** was a supplier or partner failing them" | [Same BCI release](https://www.thebci.org/news/supply-chain-disruptions-drive-increased-tier-mapping-and-insurance-uptake.html), [CIR Magazine](https://cirmagazine.com/cir/Supply-chain-disruption-costs-businesses-1m-a-year.php) | Third-party failure was the most frequent cause: **43.6%** of organisations were disrupted by it. Cyber was second, weather third |
| *(Round 2 backup)* month-long disruptions every **3.7 years** | [McKinsey Global Institute, "Risk, resilience, and rebalancing in global value chains" (2020)](https://www.mckinsey.com/capabilities/operations/our-insights/risk-resilience-and-rebalancing-in-global-value-chains) | "Supply chain disruptions lasting a month or longer now occur every 3.7 years, on average" |

### Numbers from the earlier draft that were removed, and why
| Old claim | Why it's gone |
|---|---|
| McKinsey: "almost 45% of one year's EBITDA over a decade" | Secondary sources quote 30–50%, 40%, 42% or 45%, and I couldn't confirm the exact figure in McKinsey's own text. If a judge knows the real number, the whole pitch loses credibility. ([Insurance Journal](https://amp.insurancejournal.com/news/international/2020/08/11/578661.htm), [NC State summary](https://ra.poole.ncsu.edu/blog/2021/11/mitigating-supply-chain-disruptions-and-building-resilience/)) |
| Allianz: business interruption is the #1 risk for manufacturing | **Out of date.** In the Allianz Risk Barometer 2026, cyber is #1 and business interruption fell to **#3** globally. I found no confirmed 2026 manufacturing ranking. ([Claims Journal](https://www.claimsjournal.com/news/national/2026/01/15/335109.htm), [Engineering News](https://www.engineeringnews.co.za/article/cyber-risks-remain-top-business-risk-but-ai-bumps-business-interruption-to-third-spot-2026-02-02)) |
| "Only 2% of supply-chain leaders can see past the second tier" | **Not traceable to McKinsey.** The 2% figure appears in a [Lehigh abstract](https://business.lehigh.edu/sites/default/files/2022-01/Bob_O%27Donnell_Abstract1.pdf) about *tier 3*, and other surveys report very different numbers ([Tradeverifyd](https://tradeverifyd.com/blog/supply-chain-executive-industry-trends)). SupplierLens also doesn't do tier mapping, so the stat invites a question we'd lose |

### Product numbers used in the demo (measured, not claimed)
Measured in 3 browser runs from an empty database (`scripts/e2e_demo.py`, 15/15 checks each): Alpha **60.0 → 64.0** after the live upload; voice question transcribed word for word; spoken answer with citations; German question answered in German; real-company research found 6–8 sourced signals.
