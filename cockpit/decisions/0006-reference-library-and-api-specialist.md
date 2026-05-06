# ADR 0006 — Reference Library + Atlas Anders (api_specialist)

**Date:** 2026-05-06
**Status:** Accepted
**Phase:** 1A
**Related:** ADR 0001 (cockpit architecture), ADR 0003+0004 (docs governance), ADR 0005 (post-crash + staging)

---

## Context

Documentation in this repo lived in two pillars before Phase 1A:

1. `cockpit_knowledge_base` — internal rules + protocols (~70 entries)
2. `documentation_staging` + `documentation` — 7 product docs (Phase 1B framework, content pending)

Missing: a structured place for **external system docs** (Cloudbeds, Supabase, Vercel, etc). Agents pulling external facts from training data leads to fantasy answers (hallucinated rate limits, made-up endpoints, stale auth flows). Reference library is the third pillar.

## Decision

Three new tables + one new agent + integrating skill across the team.

### Schema (public)

```text
reference_sources       — one row per external system (Cloudbeds, Supabase, ...)
reference_entries       — many rows per source (auth, rate limits, endpoints, ...)
reference_audit_log     — append-only history of writes
```

### Hard rules (DB-enforced)

- DELETE forbidden on `reference_sources` and `reference_entries` — trigger raises if non-superuser attempts. Use status flip: `active → deprecated → replaced (with replaced_by_id) → archived`.
- `credentials_location` is a pointer (env var name, vault path) — never the credential itself.
- RLS enabled on all three tables. Service role writes; authenticated users read.

### Atlas Anders

- Role: `api_specialist`
- Display: 🌐 Atlas Anders
- Reports to: lead (Foreman Felix)
- Coordinates with: researcher (Detective Data) for deep dives beyond official docs
- 4 skills: `query_reference_library`, `create_reference_source`, `update_reference_entry`, `verify_reference_entry`
- Plus standard read skills (KB, audit log, web_fetch, search_repo, property settings)

### Library-wide skill

`query_reference_library` granted to **all 14 active agents** so any of them can self-serve a lookup before answering an external-system question. Atlas owns the write path; everyone reads.

### Staleness

- Per-source threshold (default 90 days, fast-movers shorter — Anthropic 30, Supabase 30, Vercel 30, Cloudbeds 60, GitHub 60)
- Weekly cron `reference_library_staleness_check` (Mondays 06:00 UTC) inserts a triaged cockpit_ticket per stale source, assigned by Atlas
- Atlas processes the queue: fetch canonical_url → compare → `update_reference_entry` (if changed) or `verify_reference_entry` (if not) → log to `reference_audit_log`

### Day-one seed

8 sources with 22 starter entries covering authentication, rate limits/cost, and critical endpoints we use:

| System | Category | Threshold | Entries |
|---|---|---|---|
| Cloudbeds | pms | 60d | 3 |
| Cloudbeds Insights | pms | 90d | 2 |
| Supabase | infra | 30d | 3 |
| Vercel | infra | 30d | 3 |
| GitHub | devtool | 60d | 3 |
| Anthropic API | ai | 30d | 3 |
| Make.com | automation | 90d | 2 |
| Resend | other | 90d | 2 |

### UI

`/cockpit/docs-registry` — three sections (Knowledge Base, Product Documentation, Reference Library). File written to disk, deploys with the next push.

## Consequences

### Wins

- Eliminates fantasy answers for external systems — every agent has a single source of truth before it speaks
- Surface state of every integration in one place (last verified, who owns it, where credentials live)
- Make.com role explicitly bounded ("hotel-ops only — NOT cockpit monitoring") in the seed entries
- Anthropic cost guardrails ($5/wk soft, $20/d hard) live in the same library as the API docs that drive cost

### Losses

- One more agent to feed (Atlas) — but the staleness cron auto-creates work for him; no manual queue needed
- Adds 3 tables to RLS surface area — Sentinel Sergei should include them in the next advisor sweep

### Open follow-ups

- ai_agent / promotion_service / backup_service DB roles still deferred (per ADR 0004) — service_role writes for now
- /cockpit/docs-registry UI page is shipped to disk; awaits PBS commit + deploy
- Cloudbeds webhook subscriptions (booking/payment/cancellation) — flagged in the Cloudbeds source notes; Phase 2 wiring

## References

- Migration: `phase_1a_reference_library_schema`
- Migration: `phase_1a_atlas_anders_agent`
- Migration: `phase_1a_seed_8_sources_24_entries`
- Migration: `phase_1a_kb_entries_and_cron_staleness`
- KB: "reference library exists — query before guessing"
- KB: "credentials never stored in reference_library"
- KB: "staleness threshold defaults to 90 days"
- KB: "Phase 1A reference_library shipped 2026-05-06"
- Cron: `reference_library_staleness_check` (Mondays 06:00 UTC)
