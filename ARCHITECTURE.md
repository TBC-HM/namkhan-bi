# The Beyond Circle — Platform Architecture

**Owner:** PBS · Constitution: `claude_md` v5 (L1–L30) governs; this doc is the structural map. Current state only — roadmap lives in `vision_roadmap` + the build-brief programme. Counts are QUERIES, never quoted here (L14). Prior versions: `documents_history`.

## 1. Top-level shape

```
VENDOR SYSTEMS  Cloudbeds (Namkhan) · Mews exports (Donna) · QuickBooks · GBP · YouTube · Banks · Factorial · DataForSEO
      ▼
BRONZE   pms.* raw vendor-shaped (+ ingest.*, gl.*, bank.*)   — fan-out trigger (ADR-058) + mapping.*
      ▼
SILVER   pms.v_* PMS-agnostic canonical views — the ONLY cross-property read path (L4)
      ▼   spine: core.v_property_night (time-varying capacity, ADR-060)
GOLD     kpi.* + domain gold views — bridge to app via public.v_*/fn_* (L5)
      ▼
CONSUMERS
  Next.js app (Vercel) — main → CI → fn_promotion_sweep → `production` branch (ADR-222; live = promotion_log.promoted)
  IT2 command center (/holding/it2) — Action Center · ONE chat · Decision Inbox
  Agent fleet (cockpit.id_agents) — Felix sole dispatcher (L9)
  Brains (N tenants + 1 holding, L7) — dms.documents → brain.chunks, context-only
  Module completion loop (governance.module_completion_queue) — the operating model
```
Estate scale: query `information_schema` / `cron.job` / `cockpit_decisions` live — every count previously written here rotted.

## 2. Properties (LOCKED)

| Property | property_id | PMS | TZ | Money | Sellable |
|---|---:|---|---|---|---|
| The Namkhan | 260955 | Cloudbeds (live API) | Asia/Vientiane | 5-layer (ADR-173): PMS LAK · invoice USD · settlement LAK · GL USD · filing Kip | 24 → **30 since 2026-07-01** |
| Donna Portals | 1000001 | Mews (CSV/XLSX exports — **no live feed**; CSV basis SANCTIONED) | Europe/Madrid | EUR | 64 (66 physical) |

Capacity is time-varying: `core.fn_property_capacity(pid, night)` / `core.v_property_night` only — never `core.properties.capacity_*` for analytics. Cross-property aggregation needs explicit FX (`v_fx_rates_latest`); group reporting USD.

## 3. Data platform (detail: `data_model`)

- **Bronze**: vendor-shaped; written by sync/ingest + the self-healing fan-out trigger only. Ingestion guard rejects Total/Summary phantom rows.
- **Mapping**: `channel_classification` (multi-axis, ADR-105) · `room_type_xref` (canonical codes; filter `active=true`) · `enum_map` · `field_catalog`.
- **Silver**: `pms.v_reservations / v_reservation_rooms / v_transactions / v_room_types` — normalizations baked in (nights fix, ISO country, USALI tags, effective_date). **data_source is per-property**: Namkhan filters `'cloudbeds_api'`; Donna's CSV sources ARE operator-facing truth until a real Mews feed exists.
- **Gold**: `kpi.*` reads Silver + spine only; `kpi.kpi_catalog` names each KPI's source view; registry-rendered pages via `container_registry` + `wiring_registry`; gold repoints snapshot to `gold_view_snapshots` first. RN = nights-stayed; rooms revenue from PMS, never GL (exception: Namkhan P&L mirrors QuickBooks by Class, ADR-159).

## 4. PostgREST bridge (L5 — ADR-277 posture)

App reads via `public.v_*` / `public.fn_*` SECURITY DEFINER, GRANTed to **authenticated + service_role only — never anon** (deliberate anon exposure = ADR + `governance.security_anon_allowlist` row; `fn_security_scan` 4h cron tickets violations). Bridges bypass RLS → each filters property_id itself. `gl` = historical schema exception. Symptom of a bridge gap: page shows $0 while SQL returns rows.

## 5. Tenancy & auth (ADR-281 enforcement model)

- `tenancy.tenants` + `tenancy.properties` **EXIST** (shipped 2026-07-31, seeded 260955/1000001) — remaining work is RLS completion + module data contracts, NOT table creation.
- Auth: Supabase Auth; JWT claims (`property_ids`, `holding_role`) stamped by `public.custom_access_token_hook` from `tenancy.property_users`/`holding_users`. Middleware enforces `/h/<id>` pages + `/holding/*`.
- **Enforcement model (L22)**: service-role bypasses RLS → every tenant-data API route MUST verify caller access (`requirePropertyAccess()` — build in flight, brief `tenancy-api-authorization-v1`) and scope by verified property_id. RLS = defense-in-depth. Constraint tier: ADR-184 composite-FK + guard-trigger recipe on every embedding surface.

## 6. Knowledge architecture

**Five layers, priority-ordered (conflict → lower number wins):**
1. **GUARDRAILS** `public.guardrails` — hard floors/ceilings; agents check before metric-changing actions; breach → stop + escalate (L24).
2. **GOALS** `governance.tenant_goals` — horizons (annual/2/3/5y), milestones, auto `current_value`; edited at `/h/[pid]/settings/knowledge`.
3. **JUDGMENT** `governance.tenant_knowledge_docs` — owner-approved prose (how to think); nothing reaches agents pre-approval.
4. **PROPERTY FACTS** `property.*` (query information_schema.tables where table_schema='property') — queried by domain slice, not auto-loaded; auto-rendered to brain via `fn_render_tenant_knowledge` (nightly + on-save, md5-guarded).
5. **PLATFORM KB** `cockpit_agent_memory` — rules/lessons by agent_handle + topics + importance (≥8 = hard).

**Brains**: one per tenant + one holding (L7, N+1), SQL-isolated (`fn_brain_*` all property-scoped; 0=holding, >0=tenant). Lifecycle per L25: INGEST (canon docs auto-rendered — a doc the brain can't find doesn't exist) · QUERY (scoped; durable answers filed back) · LINT (doc_lint + memory_lint sweeps — brief in queue). Context-only, never an execution source (L9). Agent startup bundle: `fn_agent_context(handle, min_importance, max_chars)`; constitution digest: `fn_claude_digest()`.

## 7. Agent platform

- Command flow (L9): USER → Central Chat / Action Center → Felix (sole dispatcher) → queue → specialists; no specialist owner-chat.
- Registry `cockpit.id_agents` (+instances/trust/skills/budgets); prompts in `cockpit_agent_prompts` (conformance sweep to constitution v5 in queue). Org: Felix (holding) · Nova (Namkhan) · Orion (Donna) · HoDs · Captain Kit + IT workers · Carla/Vera legal.
- **ONE owner-answer contract** (2026-08-07): `governance.owner_questions` (law-735 shape validated at write, free-text forced) + `fn_owner_question_ask/answer` + single route `/api/owner/answer` — brief/bug/finding/comment all four kinds; legacy endpoints delegate. Decision Inbox reads `v_owner_questions_open`.
- **Module intake — two front doors, one machinery** (ADR-260/262): Level 1 `+ Intake` (PBS, 8-section/MD-upload) · Level 2 `+ Module` (tenant admin, one description box, jargon-free interview). Shared evaluator + derived completeness (`fn_intake_completeness`, SQL-enforced 100% before approve) + FREEZE gate; a `ready` brief auto-enqueues = dispatch. Rationale (measured): 162 briefs averaged 5.6 versions pre-gate; spec churn happened during build.
- Economics: metering (`ai_token_meter`), runaway guard, $-caps, Anthropic-only through Phase 2 (L17).

## 8. Governance & build machinery (detail: `loop_operations`, `deployment`)

| Subsystem | One line |
|---|---|
| Completion loop | queue → audit-first → brief → builder → verifier (separate) → evidence → doc release (L11–L13) |
| Briefs | `build_briefs` slug-keyed + history; `intake_ok` = dispatch eligibility (state, not substring); slice law 12k/3-attempts |
| Owner loop (closed 2026-08-05) | finding → restate → confirm → `fn_finding_to_brief` → dispatch → ship → `fn_finding_close_on_ship` → clocks; `finding #<id>` token = 3-party contract; sweeps not triggers |
| Shipping | deploy_github → main → CI → promotion sweep → `production` (ADR-222); push-integrity: verified md5 ledger, shrink guard, hot-file CAS (ADR-221/166/167) |
| Dual actuation | pg_cron→repository_dispatch→GHA (reliable) + 2 lease-guarded CCR sweeps (judgment); CCR never sole actuator |
| Emergency | `fn_loop_doctor` first; `loop_kill`/`loop_restart` (3 switches, user-approved) |
| Docs | version-forward + auto history + releases; claude_md guarded (clerk + append gate); doc_lint/memory_lint organ in queue |
| Security | ADR-277 anon lockdown + 4h scan · search_path pinned (ADR-179) · vault secrets (L21) · self-approval blocked (L23) |

## 9. App surface (detail: `app_navigation`)

- Canonical: `/h/[property_id]/<dept>/<sub>` + `/holding/*`. **Layer reality (L6)**: legacy unprefixed trees are still the live implementations for many depts; `/h` pages often wrap them — edit where the import chain lands; conversion to /h-native = queued migration, not done.
- IT2 (`/holding/it2`): Action Center · modules/{status,queue,specs,briefs,intake,module} · fleet/{chat,team,tasks,skills,memory} · knowledge/{goals,docs,data,design,university} · system/{health,deploys,activity,checks,cost} · questions. Prebuild orphan gate makes page+nav one unit (push nav first). `/cockpit*`,`/chat` = enforced redirect stubs.
- Settings canonical: `lib/property-settings-tabs.ts` (12 tabs) — never inline tabs. Nav: `nav-subgroups.ts` + `prefixTabHref()` keep sub-tabs on-tenant.
- Design: primitives in `app/(cockpit)/_design`; per-tenant brand tokens (L26).

## 10. Modules & taxonomy (L8)

Platform → Tenant → Module (`tenancy.modules`, sellable, one lead agent) → Capability → Workflow → Agent. Capability docs = `*_module` doc_types (registration = enum value + doc row + queue row, same key — see `loop_operations` §3). Queue state = `v_module_completion_queue` — never snapshot it in prose. Open architectural question (unruled): doc_type enum → text+lookup to remove DDL from registration.

## 11. Known gaps / risks (live 2026-08-09)

- **Tenant API authorization missing on ~200 routes** — P1 brief in flight (ADR-281). Until wired: middleware protects pages only.
- Tenancy RLS completion + module data contracts (Phase-1 close).
- Vercel builds ignore TS/lint (`ignoreBuildErrors`, `strict:false`); GHA is the only type gate; ratchet-back brief open. No test runner exists.
- Donna: no live Mews feed; transaction-based KPIs proxy-grade. Bank ingestion stale since 2026-05-16.
- Forecast bands under-covered (~53% vs 80% design) — do not price against bands.
- FOLD-gate lookup flaw (resolves via queue.brief_slug, not naming brief) — logged, not bypassed.
- `db_schemas` PostgREST exposure (24 schemas) vs bridge law — open PBS decision.
- Legacy repo docs are sediment (L25 list); repo context brief in flight.

## 12. Superseded (do not resurrect)

Anon-granted bridge views (→ ADR-277) · "tenancy.tenants missing" (exists since 2026-07-31) · global data_source filter · Donna-Mews-API-live claims · single operating currency · fixed capacity · legacy cockpit/chat surfaces · `v_current_prod` · prose counts & queue snapshots · per-doc ADR index tables (query `cockpit_decisions`; ids 177/181 title collision — id canonical) · four owner-answer paths (→ ONE contract) · incident logs in this doc (→ rules/frontend + deployment + loop_operations).

---
*Update history: v104 · 2026-08-09 — canon-5 sweep slice (constitution v5 programme, ADR-279). 49k→~13k. ADR-277 contradiction fixed (§4), tenancy self-contradiction resolved (§5), TKA five-layer knowledge architecture integrated (§6), owner-answer contract + intake gates integrated (§7), promotion gate in top shape (§1), counts/queue snapshots/ADR tables/incident logs removed per L14/L25. Prior v103 in documents_history.*

## RealLive core (ADR-291/292, 2026-08-13)

- **Sibling project `reallive-core`** (id `euvutzlbcrpbnpideoxm`, eu-central-1, PG17, Pro): the RealLive.ai platform core. Greenfield per ADR-291. Schemas: `core` (orgs/properties/memberships UUID-keyed, connector_accounts — external IDs like Cloudbeds 260955 live ONLY there; settings_registry + property_settings with provenance; module_registry with 3-way dependency model requires_modules/requires_connectors/requires_settings; property_modules toggle state; entitlement_versions for Edge Config revocation) and `billing` (hardened port of commercial.*: wallets with CHECK balance>=0 — NO allow_negative; wallet_ledger with balance_after + credit_kind; stripe_events idempotency; provider_rates append-only; model_aliases; fn_wallet_spend fail-closed conditional UPDATE + daily cap; fn_wallet_credit idempotent; all money objects REVOKEd from anon/authenticated).
- **commercial.* in THIS project is the design donor, frozen** — deprecate in place once reallive-core billing is live. Do NOT extend commercial.*; new monetization work goes to reallive-core.
- **Canonical platform apex: `reallive.ai`** (ADR-292, PBS-owned). Spelling "reallife" is banned everywhere.
- Namkhan + Donna onboard into reallive-core via the PUBLIC signup flow as clients #1/#2 (no manual seeding — that is the foundation gate). Donna tenant status normalized fake_client→active 2026-08-13 (is_internal remains the single internal-ness flag, reporting only).