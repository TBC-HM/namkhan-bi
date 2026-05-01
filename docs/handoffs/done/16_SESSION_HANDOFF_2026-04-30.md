# 16 — Session Handoff & Next-Session Start

> Snapshot at end of session — 30 April 2026.
> Drop this in the Project knowledge alongside docs 00–15. **Read this first next time.**

---

## TL;DR — where we are

The Supabase backend is **production-ready as a data layer**. Cron jobs run, RLS works, agents are queued, KPIs refresh every 15 minutes, mandates are enforced.

**Nothing the user can see exists yet.** The v9 mockup HTML is static. There is no live frontend. Agents queue runs into a void because nothing executes them. The next session is about **closing that loop**.

---

## State of the Supabase project

| Metric | Count |
|---|---:|
| Schemas | 26 |
| Tables | 162 |
| Materialized views | 12 |
| RLS policies | 250 (incl. 21 storage) |
| Cron jobs | 14 active |
| Agents (registry) | 27 (7 active, 20 planned) |
| Agent prompts (v1, current) | 7 |
| Agent triggers wired | 7 (5 cron, 2 webhook) |
| Mandate rules | 23 across 7 mandates |
| Authority limits | 6 |
| SOPs seeded | 21 |
| Compliance / insurance / legal docs | 23 |
| KPI daily snapshots | 1 (started today) |
| Segment KPI rows | 2,868 |
| Capacity (selling / total) | 24 / 30 |
| Migrations applied | 13 |
| Auth users | 1 (Owner) |

Project: `namkhan-pms` · `kpenyneooigsyuuomgct` · eu-central-1 · Postgres 17

---

## What was done this session (29–30 April 2026)

### Backend foundation (already existed at session start)
- 19 schemas, Cloudbeds mirror in `public`, plan/dq/gl/marketing schemas
- 11 KPI matviews refreshing every 15 min
- 33 DQ rules running every 4h
- 24 agents in registry

### Done in this session
1. ✅ **Owner profile + auth** — Paul Bauer wired to `auth.users` (UUID `a86bcf48-1b44-41a7-9167-eda823d68418`), owner role, 23 docs attributed
2. ✅ **Supabase Auth turned on** — replaces any Vercel auth idea. Helper functions (`app.has_role`, `app.is_top_level`, `app.my_dept_codes`) + auto-profile trigger
3. ✅ **247 RLS policies** across 12 schemas — sensitivity-based docs, dept-scoped tasks, owner-only audit/keys
4. ✅ **21 storage bucket policies** across 10 buckets — public/internal/confidential/restricted tiers
5. ✅ **Capacity views** — `v_property_capacity` + `v_property_totals` resolving 20-vs-24-vs-30 confusion. Source of truth = `room_types.quantity` not `rooms` count
6. ✅ **Agent count corrected** — 27 not 24 (data_quality, proposal_outcome, agent_orchestrator already existed)
7. ✅ **Expiry alert generator** — `docs.generate_expiry_alerts()` runs nightly at 06:00 ICT, fires at 90/60/30/14/7/1 days before `valid_until`, flips expired docs
8. ✅ **21 SOPs seeded** with `knowledge.sop_meta` extension (department, kind, agent consumers, review cadence, QA flags)
9. ✅ **7 agent prompts v1** — system_prompt + user_prompt_template + JSON output_schema + variables + knowledge_refs + input_sources + tools_enabled + guardrails (1,188–1,719 chars each, claude-sonnet-4-7, temp 0.2)
10. ✅ **KPI completeness (5 gaps closed)**:
    - K1 — `kpi.daily_snapshots` table + nightly snapshot at 05:30 ICT
    - K2 — Agent run scheduler (5 cron jobs queue agent runs into `governance.agent_runs`)
    - K3 — `hourly-refresh` extended from UTC 00–13 to **24/7** (closed 13-hour overnight gap)
    - K4 — `kpi.freshness_log` + `kpi.check_freshness()` running every 30 min, alerts if matview > 30 min stale
    - K5 — `mv_kpi_daily_by_segment` (2,868 rows) — TA/OTA/Direct/Brand/Corp/Group/Other splits
11. ✅ **Doc 15** (Supabase Architecture) — saved as kb_article in `docs.documents` and as `.md` file output

---

## What's still open

### Critical — blocks frontend ROI
| # | Item | Why it matters | Effort |
|---|---|---|---|
| F1 | **Edge Function `agent-runner`** | 5 cron jobs queue agent runs but nothing executes them. Without this, `governance.agent_runs` fills with `status='queued'` rows that never run. **All agent prompts are dead until this exists.** | 2 hours |
| F2 | **v9 frontend → Vercel/Next.js** | `beyond_circle_showcase_v9.html` is one static HTML file. Needs cutting into routed pages, wired to Supabase via SDK with anon key + RLS, real auth flow | 2–4 days |
| F3 | **Proposal approval queue UI** | `governance.proposals` will fill once F1 ships. Owner must be able to approve/reject/adjust each one. Without this, agents propose into a void | 1 day |
| F4 | **Per-page RLS tightening** | Current policies are coarse (read all authenticated, top-level write). Refine per page as v9 surfaces ship | ongoing |

### Important — but not blocking
| # | Item | Notes |
|---|---|---|
| F5 | Custom SMTP | Auth emails currently sent from `noreply@mail.app.supabase.io`. Replace with Resend/Postmark. 5 min in dashboard |
| F6 | Owner 2FA (TOTP) | Required before any production traffic |
| F7 | Service role lockdown | Currently bypasses all RLS. Lock from frontend before production — frontend must use anon key only |
| F8 | Auth provider config | Magic link + password not yet enabled in dashboard. URL: `https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/auth/providers` |
| F9 | Site URL + redirect whitelist | Dashboard → Authentication → URL configuration. Needed before first frontend deploy |
| F10 | Per-bucket retention policy | `guest_docs` and `hr_docs` need GDPR-aligned retention. Currently no policy |
| F11 | Backup snapshot before next migration | Supabase auto-backups exist but worth confirming retention period |

### External — not Supabase
| # | Item | Status |
|---|---|---|
| E1 | Bank feed | needs Lao bank conversation — paused |
| E2 | QuickBooks Online | needs subscription + Cloudbeds → QB integration setup |
| E3 | Poster POS API access | needs Poster credentials + Cloudbeds folio link |
| E4 | DocuSign connector | off |
| E5 | Booking.com Reviews API webhook | needed for `review_agent` to fire |
| E6 | Gmail webhook on `book@thenamkhan.com` | needed for `lead_scoring_agent` to fire |
| E7 | 23 compliance PDFs uploaded with `valid_until` dates | real-world scanning task — closed forever in tracker |
| E8 | Anthropic API key in Supabase Vault | needed before F1 can call Claude API |

### Defer
| # | Item | When |
|---|---|---|
| D1 | Multi-property layer | When 2nd property arrives |
| D2 | SEO module population | Post-launch |
| D3 | Loyalty program (`guest.loyalty_members`) | After SLH integration confirmed |
| D4 | Training module rollout | After basic ops stable |
| D5 | `rooms` table backfill for 4 inventory-pool room types | Cosmetic — `room_types.quantity` is source of truth |

---

## Cron jobs (14 active)

| Job | Schedule UTC | Schedule ICT | Status |
|---|---|---|---|
| `refresh_bi_views_15min` | `*/15 * * * *` | every 15 min | ✅ |
| `hourly-refresh` | `0 * * * *` | every hour | ✅ (24/7 since today) |
| `daily-cold-sync` | `0 20 * * *` | 03:00 | ✅ |
| `dq-engine-run` | `15 */4 * * *` | every 4h | ✅ |
| `dq-daily-digest` | `0 1 * * *` | 08:00 | ✅ |
| `monthly-close-prep` | `0 19 28-31 * *` | 02:00 28–31 | ✅ |
| `docs_expiry_alerts` | `0 23 * * *` | 06:00 | ✅ |
| `kpi-daily-snapshot` | `30 22 * * *` | 05:30 | ✅ |
| `kpi-freshness-check` | `*/30 * * * *` | every 30 min | ✅ |
| `agent-snapshot_agent` | `0 0-16 * * *` | hourly 07–23 | ⚠️ queues only, no executor |
| `agent-pricing_agent` | `5 0-16 * * *` | hourly 07–23 :05 | ⚠️ queues only |
| `agent-forecast_agent` | `0 */6 * * *` | every 6h | ⚠️ queues only |
| `agent-variance_agent` | `0 0 * * *` | 07:00 | ⚠️ queues only |
| `agent-cashflow_agent` | `15 0 * * *` | 07:15 | ⚠️ queues only |

---

## Where to start next session

**One-line context for the next Claude:**
> "Read project doc 15 (Supabase Architecture) and 16 (Session Handoff). Backend is done. We're now wiring the v9 frontend to Supabase and building the Edge Function that runs queued agents."

### Recommended order
1. **Decide hosting** — Vercel? Bauer Cloudflare? Confirm before writing any frontend code
2. **F8 + F9** (5 min in Supabase dashboard) — Auth providers + URL whitelist
3. **F2** — Cut `beyond_circle_showcase_v9.html` into Next.js routes:
   - `/login` (Supabase Auth magic link)
   - `/` (Owner Overview / Compass)
   - `/revenue` `/operations` `/guest` `/finance` (4 pillars)
   - `/proposals` (the approval queue)
   - `/settings` (mandates, agents, profile)
4. **F1** — Edge Function `agent-runner`. Once F3 exists, agents finally have an audience
5. **F3** — Proposal approval queue UI (depends on F2)
6. **F5** Custom SMTP, **F6** 2FA, **F7** service-role lockdown — before public launch

### Cost reality check
| Item | Monthly cost |
|---|---:|
| Supabase (current, free tier limits) | $0 → $25 if pushed |
| Vercel (Pro) | $20 |
| Anthropic API (5 agents × ~$2/run × 24 runs/day) | ~$300 |
| Resend (SMTP) | $20 |
| Domain + Cloudflare | $5 |
| **Total to run the agents** | **~$370/month** |

If `claude-haiku` is acceptable for snapshot/forecast (not pricing/review), drop to ~$100/month.

---

## Files / artifacts to keep

| File | Where | Purpose |
|---|---|---|
| `00–14_*.md` | Project knowledge | COI scope (don't edit; describe Supabase via doc 15) |
| `15_SUPABASE_ARCHITECTURE.md` | Project knowledge + storage `documents-internal` | Schema, RLS, agents, mandates, capacity |
| `16_SESSION_HANDOFF.md` (this) | Project knowledge | Next-session start |
| `beyond_circle_showcase_v9.html` | `/mnt/user-data/uploads` | Frontend reference — visual + nav truth |
| `13_PHASE1_SYNC_AUDIT.md` | Project knowledge | What Cloudbeds sync covers / misses |
| `14_MOCKUP_VS_DATA_AUDIT.md` | Project knowledge | What v9 mockup needs vs what Supabase has |

---

## Risks I'm flagging into next session

1. **Frontend will reveal data gaps the backend papers over.** The mockup shows things like F&B food cost % at 31.2%, but `fb.food_cost_snapshots` has 0 rows. The number is hardcoded in HTML. Same with `qa_score_pct = 78%`, `wastage 4.1%` — all visual placeholders. **Either accept "owner enters monthly via UI" or build the math.**
2. **Agent runs will fail without Anthropic key in Vault.** F1 deployment will surface this immediately.
3. **Service role exposure.** During development the v9 frontend may use service_role for convenience. **It must be removed before any production traffic** or RLS is meaningless.
4. **Mandate breaches are noted but never alert.** `governance.mandate_breaches` table exists, never written to. The breach detection logic is implicit in agent prompts but not enforced anywhere central. Worth a small `governance.detect_breaches()` function that runs daily.
5. **No webhook receiver exists yet.** `review_agent` and `lead_scoring_agent` triggers point at `/webhooks/reviews` and `/webhooks/inbound-email` — these endpoints don't exist. Either build via Edge Function or via Make.com.
6. **`mv_kpi_today` data sparse.** Only 4 active days in past week (occupancy 15–21%) — Cloudbeds sandbox or genuine low season. **Verify this is real before showing on dashboard.**

---

## Useful commands for next session

```sql
-- State snapshot
SELECT count(*) AS schemas FROM information_schema.schemata 
  WHERE schema_name IN ('public','plan','dq','gl','app','docs','governance','ops','fb','spa','activities','knowledge','training','guest','marketing','seo','alerts','auth_ext','kpi');

-- Verify cron health
SELECT j.jobname, j.schedule, max(d.start_time) AS last_run, max(d.status) AS last_status
FROM cron.job j LEFT JOIN cron.job_run_details d ON d.jobid = j.jobid
WHERE j.active GROUP BY j.jobname, j.schedule ORDER BY j.jobname;

-- Queued agent runs (will accumulate without Edge Function)
SELECT count(*), status FROM governance.agent_runs GROUP BY status;

-- Today's KPIs
SELECT * FROM public.mv_kpi_today;
SELECT * FROM public.v_property_totals;
SELECT * FROM kpi.daily_snapshots WHERE snapshot_date = current_date;

-- Active mandate breaches
SELECT * FROM governance.mandate_rules WHERE current_value IS NOT NULL;

-- KPI freshness
SELECT matview, last_refresh, round(staleness_minutes,1) AS minutes_stale, is_stale
FROM kpi.freshness_log
WHERE checked_at = (SELECT max(checked_at) FROM kpi.freshness_log)
ORDER BY staleness_minutes DESC;
```

---

## Decisions made (don't relitigate next session)

- **Cloudbeds is single source of truth for revenue.** Never duplicate in `fb` / `spa` / `activities`. Those schemas hold ops metadata only.
- **LAK base, USD comms, FX 21,800.** Stored in `gl.fx_rates` (20 rows). Never hardcoded in app code.
- **Cloudbeds IDs are PKs, never remapped.** bigint for property/room_type/rate; text for everything else.
- **Capacity = `room_types.quantity`**, not `rooms` count. Helper view `v_property_totals`.
- **Supabase Auth, not Vercel Auth.** Single user store. `auth.uid()` keys all RLS.
- **No localStorage in artifacts.** React state only.
- **All agent prompts on `claude-sonnet-4-7`, temp 0.2, structured output_schema.**
- **Agent runs queue, never auto-execute writes.** Proposals go to owner approval queue.
- **USALI 11th edition.** All P&L mapping via `public.usali_category_map` (177 rows).
- **No emoji, no exclamation marks** anywhere in agent voices or UI copy. Casual luxury, place-rooted.

---

## What "done" looks like (next 2 weeks, owner's call)

| Milestone | Definition |
|---|---|
| M1 | Owner can log into v9 frontend with magic link |
| M2 | Owner Overview page shows live KPIs from `mv_kpi_today` + `kpi.daily_snapshots` |
| M3 | First agent runs end-to-end (queue → Edge Function → Anthropic → proposal → owner approves) |
| M4 | All 4 pillar pages render real data (not mockup placeholders) |
| M5 | Proposal queue cleared daily by owner; outcomes logged in `governance.proposal_outcomes` |
| M6 | Custom SMTP + 2FA on; service role removed from frontend; production-safe |

After M6, the system is live and earning its keep.
