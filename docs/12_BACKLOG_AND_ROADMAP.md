# 12 — Backlog and Roadmap

> Phased plan with **actual** status as of 2026-04-28.

## ✅ Phase 0 — Discovery (DONE)
| Task | Status |
|---|---|
| Cloudbeds API audit | DONE — see `02_CLOUDBEDS_API_REFERENCE.md` |
| Field inventory | DONE — see `03_DATA_MODEL_AND_FIELDS.md` |
| USALI mapping draft | DONE — 119 rules in `usali_category_map` |
| Supabase project created | DONE (`kpenyneooigsyuuomgct`) |
| Cloudbeds API key issued | DONE |
| Stack decision: Supabase + Vercel (NOT GCP/BigQuery/Looker) | DONE — pivot from original plan |

## ✅ Phase 1 — Sync + BI Layer (DONE)
| Task | Status |
|---|---|
| `sync-cloudbeds` edge function (Deno, v11) | DONE |
| Initial backfill 2019 → Feb 2027 | DONE — see row counts in `13_PHASE1_SYNC_AUDIT.md` |
| Hourly incremental sync via `cb_hourly_refresh()` | DONE |
| 9 mat views (`mv_*`) | DONE |
| `usali_category_map` populated + classifier materialized | DONE |
| Tent 7 retired in `operational_overrides` | DONE |
| Next.js dashboard codebase | DONE |
| TypeScript + production build verified | DONE |
| Deployment guide | DONE — see `15_DEPLOYMENT_GUIDE.md` |
| Vercel deploy | **PENDING — Paul to push to GitHub + import to Vercel** |
| `pg_cron` schedule for `refresh_bi_views()` | PENDING — one-off SQL |

## 🔄 Phase 2 — DQ + SOPs + Operational Improvements (NEXT)

### Critical for trust
| Task | Owner | Priority |
|---|---|---|
| Open Cloudbeds support ticket: `housekeeping:read` scope | Paul | HIGH |
| Resolve Supabase security advisors (RLS, SECURITY DEFINER, anon perms) | Paul + Claude | HIGH (before public deploy) |
| Set up monitoring/alerting on sync failures | Phase 2 dev | MEDIUM |

### DQ Agent (the "garbage data crawler")
| Task | Notes |
|---|---|
| Build DQ agent edge function | Crawls historical data, applies rules from `06_DATA_QUALITY_RULES.md` |
| `data_quality_log` table | One row per violation |
| Slack/Telegram webhook integration | Daily 09:00 digest |
| DQ dashboard tab | Currently grey placeholder; needs to show open violations + trends |
| Operator-error fingerprinting (OE rules) | Detect Lao operator wrong-button patterns |
| SOP feedback loop | Top operator-error rules → SOP topics |

### Operator-side fixes (root cause)
| Task | Owner |
|---|---|
| Mandatory `market_segment` enforcement in PMS | Paul (Cloudbeds settings) |
| Mandatory `item_category_name` on F&B items | Paul (Cloudbeds settings) |
| Standardize PMS item naming (no typos like "MInibar") | Paul |
| Clean up 6 uncategorized items | Paul |

### SOPs (Module 1)
| Task | Audience | Priority |
|---|---|---|
| SOP-RES-001: Booking entry | Reservations | HIGH |
| SOP-RES-002: Cancellation handling | Reservations | HIGH |
| SOP-FO-001: Charge posting workflow | Front Office | HIGH |
| SOP-FB-001: Item selection at POS | F&B | HIGH |
| SOP-HK-001 to 003 | Housekeeping | After scope unblock |
| Lao translation review | Native reviewer | All |
| Print + laminate quick cards | Paul | After approval |

### Dashboard improvements
| Task | Effort | Priority |
|---|---|---|
| Repeat Guest % dashboard tab | S | M |
| Geo Mix dashboard tab | S | M |
| Email Capture % visibility | S | M |
| Budget upload schema + Budget tab | M | M (when budget is ready) |
| Comp Set scraper agent | L | L |

## 🔮 Phase 3 — Cost / P&L expense side (LATER)

| Task | Effort |
|---|---|
| Define monthly cost upload schema | S |
| CSV upload pipeline | M |
| USALI cost categories mapping | M |
| GOP / GOPPAR / EBITDA KPIs | S (once data flows) |
| Forecast vs Budget tab | M |

## 🔮 Phase 4 — Vertex AI Recommendations (FUTURE)

Prerequisite: ≥6 months of clean post-DQ-agent data.

| Task | Notes |
|---|---|
| Vertex Forecast — occupancy / revenue | |
| AutoML — no-show / cancel prediction | |
| Rule engine for prescriptive actions | |
| Action Plans dashboard tab activation | |
| Weekly digest + real-time alerts | |
| Feedback loop logging (action taken → outcome) | |
| Quarterly model retrain | |

## Decisions resolved

| Decision | Outcome | When |
|---|---|---|
| Single property or multi-property | Single (v1); multi as future v2 | Phase 0 |
| BigQuery vs Supabase | Supabase | Phase 0 (pivot) |
| Looker Studio vs custom React | Custom Next.js on Vercel | Phase 0 (pivot) |
| In-house build vs freelancer vs AI loop | AI agent loop (Claude + human review) | Phase 0 |
| Auth model (single password vs multi-user) | Single password v1; SSO/per-user when warranted | Phase 1 |

## Risks log

| Risk | Mitigation | Status |
|---|---|---|
| Dirty operator data poisons KPIs | DQ agent + SOPs (Phase 2) + transparent `Unclassified` line | OPEN |
| Cloudbeds API changes | Versioned schemas; raw JSON kept; field-name discoveries logged | MITIGATED |
| Vercel + Supabase free-tier limits | Will upgrade to Pro tiers when needed (~$45/mo) | LOW |
| Single-person dependency (Paul) | Documentation in this repo; Claude mirrors knowledge | MITIGATED via docs |
| Lao staff resistance to SOPs | Visual-first; dept-head ownership; not top-down | TBD (Phase 2) |
| Anon-key exposure on public Vercel | Either lock RLS pre-deploy OR keep dashboard URL private | OPEN — decide before public |

## Next 5 actions (priority order)

1. **Paul: deploy to Vercel** — see `15_DEPLOYMENT_GUIDE.md`
2. **Paul: open Cloudbeds support ticket** for `housekeeping:read` scope
3. **Decide:** lock down RLS now vs defer (see security advisors in Supabase)
4. **Build DQ agent** (Phase 2) — most-leveraged next module
5. **Define operator-error rules with Paul** based on which patterns are actually worth detecting
