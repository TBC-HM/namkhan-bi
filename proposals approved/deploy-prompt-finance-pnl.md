# Deploy prompt — /finance/pnl

**Source proposal:** `/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/proposals/2026-04-30-finance-pnl/`
**Approved on:** 2026-04-30
**Target route:** `https://namkhan-bi.vercel.app/finance/pnl`
**Branch:** `feat/finance-pnl` off `revenue-redesign-v2`

---

## Paste this into a fresh Claude Code session in the namkhan-bi repo

```
ROLE
You are a senior Next.js/TypeScript engineer shipping a sub-tab to the Namkhan BI portal. Production-only mindset: typecheck before deploy, --force the cache, never push to main.

GOAL
Ship /finance/pnl to https://namkhan-bi.vercel.app following the IA proposal at:
  /Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/proposals/2026-04-30-finance-pnl/finance-pnl-mockup-branded.html
…and the codified standard at:
  /Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/proposals/_revenue-standard.md

REPO + INFRA (do NOT re-discover)
- Local repo: /Users/paulbauer/Desktop/namkhan-bi
- Branch base: revenue-redesign-v2 (NOT main)
- Working branch for this work: feat/finance-pnl
- Live: https://namkhan-bi.vercel.app  (Vercel project namkhan-bi, scope pbsbase-2825's projects, region fra1)
- Supabase: namkhan-pms (ref kpenyneooigsyuuomgct), property_id 260955, capacity 24 selling
- Currency: LAK base, USD comms, FX 21,800 (NEXT_PUBLIC_FX_LAK_USD)
- Vercel env vars exist already — DO NOT touch
- Vercel MCP returns 403 for this account — do NOT try
- Reference mockup-port pattern lives in app/revenue/_redesign/ (tabPulse.ts, render.tsx, chartReplace.ts, redesignCss.ts)

DELIVERABLE
Route /finance/pnl that renders all 9 mandatory blocks per the standard, branded to match the live /revenue/pulse:
  Block 1  Breadcrumb + Title  ("Finance › P&L · where the margin lives.")
  Block 2  Filter bar           (Property · Period · Compare · Department · DOW · Currency · Save view)
  Block 3  Sub-tab row          (Ledger · P&L · Budget · Cashflow · AR/AP · Audit Trail) + ⚙ Agent Guardrails + queued counter
  Block 4  KPI grid             (primary 6 + secondary 5; tabular sans-serif numerals, italic serif labels)
  Block 5  Agent strip          (P&L Detector · Variance Composer · Controller Agent · Procurement Agent + Fire-all)
  Block 6  Decision queue       (5 rows ranked by $ impact, single-action buttons)
  Block 7  Tactical alerts      (severity-bordered cards with dimensional header + handoff buttons)
  Block 8  Core panels          (USALI grid 2/3 left; waterfall + 13-week cash + heatmap + commentary 1/3 right)
  Block 9  Guardrails banner    (yellow, always-approval for finance writes)

DATA REALITY (read this — most tiles will be "Data needed")
- Cloudbeds does NOT carry P&L. There is no GL feed today. OPEN-03 (budget feed source) still unresolved.
- Required new sources, none of which exist: GL feed (QuickBooks/Xero/manual), GL→USALI mapping table, materiality thresholds, 13-week cash forecast, dept ratio history.
- Therefore: ship the page with mockup placeholder content gated by an explicit { wired:false } flag per panel, and a "Data needed" badge on every tile/panel sourcing data we do not have. Do NOT fake it as "live."
- Wire-able from existing matviews (cheap wins):
    • Total Revenue tile from mv_kpi_daily (rooms only — flag rest as partial)
    • Distribution cost % from mv_channel_perf (proxy)
- Everything else: placeholder + Data-needed tag.

PORT STRATEGY (pick A, fall back to B)
A) NATIVE NEXT.JS COMPONENT (preferred). Build app/finance/pnl/page.tsx as React/TSX using existing lib/format.ts, lib/period.ts, and a new lib/pnl.ts with stub fetchers that return { wired:false, value:null } for missing sources. Style via Tailwind tokens already in tailwind.config.js plus the brand tokens listed below.
B) MOCKUP-PORT (fallback). Follow the /revenue/_redesign pattern exactly: extract HTML to tabPnl.ts (export default "<html string>"), scope CSS via the same Python scoper, render in a layout wrapper, KPI patch by regex (function-form replacement only — never string-form $1...$3).

VISUAL TOKENS (sampled from live /revenue/pulse)
- Surface cream:           #f5efde
- Card white:              #ffffff
- Soft warm border:        #e6dfc9
- Text near-black:         #1c1c1a
- Forest green nav:        #1f3d2e
- Tan/copper accent:       #a17a4f   (primary CTAs only)
- Yellow warn:             bg #fef3c7  bd #f3d57a  tx #5e4818
- Status dots:             running #3aa56e · idle #a89c80 · paused #cf9b3a · err #a02d2d
- Type: italic serif (brand serif TBD — Cormorant Garamond stand-in) for labels + headings; tabular sans-serif numerals (SF Mono / Inter Tabular) for KPI values; system sans for body
- Radii: 8px cards, 6px buttons. Spacing 8/12/16/24/32

AGENTS (stub — no LLM calls live)
Each agent has a chip in the strip and a modal. Modal is static for now (system-prompt textarea, KPI mini-grid, schedule, last-run, cost). Wire to a no-op handler that records "would-fire" telemetry. Do NOT call any LLM API in this PR.
- P&L Detector       — daily 06:00, scans variances >$500/10%
- Variance Composer  — on-demand, drafts paragraph commentary
- Controller Agent   — weekly Mon 07:00, proposes JE; 4-eyes required
- Procurement Agent  — weekly Wed 09:00, vendor cost benchmark + RFQ drafts; no PO authority

AGENT WRITE POLICY (HARD)
No agent writes to GL, Cloudbeds, or any external system in this PR. All actions advisory. Block 9 banner must be present and accurate.

DEPLOY MECHANICS (the only thing that works — do not improvise)
1. cd ~/Desktop/namkhan-bi && git checkout revenue-redesign-v2 && git pull && git checkout -b feat/finance-pnl
2. Implement.
3. Pre-deploy guardrail (mandatory):
     export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
     npx --yes tsc --noEmit
4. git add -A && git commit -m "feat(finance): /finance/pnl per IA proposal 2026-04-30 — placeholder data gated"
5. git push -u origin feat/finance-pnl
6. Deploy via the existing osascript path (NOT Vercel MCP):
     nohup '/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/deploy-namkhan-bi.command' > /tmp/nb_force.log 2>&1 & disown
   Poll: tail -10 /tmp/nb_force.log
7. Verify:
     curl -sI https://namkhan-bi.vercel.app/finance/pnl   # expect 200
     curl -sL https://namkhan-bi.vercel.app/finance/pnl | grep -E "Profit & loss|where the.*margin|USALI|Data needed"
8. Do NOT merge to main. Stay on feat/finance-pnl until owner approves.

DON'T
- Don't push to main.
- Don't deploy without `npx tsc --noEmit` first.
- Don't deploy without --force flag (cache will burn you).
- Don't use string-form regex replace `'$1...$3'` — function form only.
- Don't try Vercel MCP (403 on this account).
- Don't touch other pillars (/overview, /operations, /guest stay legacy).
- Don't claim a tile is "live" unless it actually pulls from Supabase.
- Don't call any LLM API for the agents in this PR.

ACCEPTANCE CRITERIA (binary)
[ ] curl -sI /finance/pnl → 200
[ ] All 9 blocks present in DOM
[ ] Primary 6 + secondary 5 KPI tiles render
[ ] Tabular sans-serif numerals on KPI values, italic serif on labels
[ ] Branded skin matches /revenue/pulse (cream surface, forest-green rail, tan CTAs)
[ ] Yellow guardrails banner present (block 9)
[ ] Every unwired tile shows "Data needed" badge with tooltip naming the missing source
[ ] No agent calls any external API
[ ] No regression on /revenue/* (curl /revenue/pulse, /pace, /channels → all 200)
[ ] tsc --noEmit clean
[ ] Branch is feat/finance-pnl, not main

REPORT BACK (write into ~/Desktop/namkhan-bi/to vercel production /deploy-doc-finance-pnl-2026-04-30.md)
- Commit hash + branch
- /finance/pnl 200 confirmation
- Screenshot path of the live page
- Punch list of "Data needed" tiles with the source each one is waiting on
- Append a row to ~/Desktop/namkhan-bi/to vercel production /_LOG.md

ON SUCCESS
- Drop a marker file ~/Desktop/namkhan-bi/proposals approved/deploy-prompt-finance-pnl.shipped (empty file is fine — its existence is the signal).

START.
```
