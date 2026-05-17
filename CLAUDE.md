# CLAUDE.md — instructions for AI coding agents working on this repo

> This file is auto-read by Claude Code, Cursor, and similar AI coding
> tools at the start of every session.
>
> It is the **operating manual** for AI agents working on this codebase.
> Architectural truth lives in `ARCHITECTURE.md`. Design / UI rules
> live in `DESIGN_NAMKHAN_BI.md`. Live system state lives in Supabase.
>
> Version: 2.0. Last updated: 2026-05-11.

---

## 0. STOP — READ FIRST, in this order

Before any code edit, schema change, or significant chat reply:

1. **`ARCHITECTURE.md`** (repo root) — what we are building, why, the
   multi-tenant + modular + phased structure. Non-negotiable context.
2. **`DESIGN_NAMKHAN_BI.md`** (repo root) — the design system, only if
   touching UI, styles, components, or `lib/format.ts`.
3. **Supabase live state** — query before any DB work:
   ```sql
   SELECT * FROM v_session_context;            -- where we are right now (planned view)
   SELECT * FROM cockpit_agent_memory
     WHERE importance >= 9 ORDER BY id DESC;   -- standing rules + recent learnings
   ```
4. **The actual code.**

Skipping these is the single biggest cause of regressions in this repo.

---

## 1. Identity

**This repo:** Namkhan BI — the reference implementation of The Beyond
Circle's hospitality intelligence platform. First of multiple
properties.

**Operator:** PBS (Paul Bauer) — architect of The Beyond Circle.

**Communication style:** blunt, bullets and tables, lead with the
answer, push back when logic is weak, show 2–3 alternatives when
relevant. Never flatter. Never propose stopping or sleeping. ROI-
focused. Senior consultant tone.

---

## 2. Multi-tenant rules (P1 — non-negotiable)

This platform serves multiple properties under multiple tenants. The
Namkhan (Laos) and Donna Portals (Spain) are two distinct tenants
today. External clients come in Phase 2.

**Every operational query MUST be tenant-scoped.**

| Rule | Why |
|---|---|
| Every operational table carries `tenant_id` AND `property_id` | Isolation enforced by RLS |
| Every SQL operation against operational data filters by both columns | Cross-tenant leak is the platform-killing bug |
| Cross-tenant joins happen only in Beyond Circle aggregation views (`SECURITY DEFINER` + explicit GRANT) | All other code paths see one tenant at a time |
| Never hardcode `property_id = 260955` past 2026-05-11 | The Namkhan is one property of many |
| Source-of-truth columns dispatch logic | `tenancy.properties.pms_source` decides Cloudbeds vs Mews; never assume |

If you find yourself writing `WHERE property_id = 260955`, stop — the
property must come from session context, not the source code.

---

## 2.1. UNIVERSAL TENANT URL RULE (P1 — added 2026-05-15, importance 10)

**Every dept/sub URL on this platform MUST be property-scoped under `/h/[property_id]/<dept>/<sub>`.** One canonical URL shape per page; legacy global aliases are 307 redirects only.

**Property IDs (locked)**

| Property | property_id | Canonical prefix |
|---|---|---|
| The Namkhan (Laos) | `260955` | `/h/260955/*` |
| Donna Portals (Spain) | `1000001` | `/h/1000001/*` |
| Beyond Circle holding | (synthetic) | `/holding/*` |

**Department slugs (locked):** `sales`, `revenue`, `marketing`, `finance`, `operations`, `guests`.

**HR routes — repaired 2026-05-15 (ticket #159):** HR lives at `/finance/hr/*` (NOT `/operations/staff/*` — old paths 307-redirect). Tabs: `register`, `onboarding`, `offboarding`, `attendance`, `schedule`, `holidays`, `recruitment`, `data`. Report tab removed.

**Legacy Namkhan aliases.** Pre-2026-05 routes (`/finance/*`, `/sales/*`, `/operations/*`, `/revenue/*`, `/marketing/*`, `/guests/*`) continue to render Namkhan content for backward compat, but every menu strip + every agent link MUST emit `/h/260955/...`. Surviving un-prefixed links are technical debt, not the canon.

**Implementation pins**

- `rewriteSubPagesForProperty(SUBPAGES, propertyId)` in `lib/dept-cfg/rewrite-subpages.ts`
- `scopeHrefs` / `PROPERTY_SCOPED_HREFS` in `lib/dept-cfg/by-property.ts`
- Every TabContent component accepts `subPagesOverride?: { label: string; href: string }[]`
- Catch-all `app/h/[property_id]/[...rest]/page.tsx` covers stubs

**Enforcement**

- An agent that emits a non-property-scoped link in a chat reply is in violation.
- Felix MUST rewrite any user-pasted un-prefixed URL into canonical form before answering.
- Coding agents proposing new routes MUST place them under `app/h/[property_id]/<path>` first; add a global alias only if a legacy redirect is needed.

**Why importance 10:** any drift here splits the property switcher + ThemeInjector — Donna ends up in Namkhan's dark palette, agent links route to the wrong tenant, and the multi-tenant guarantee (§2) breaks at the URL layer before RLS even gets a chance to enforce it.

Canonical sources: `claude_md` v2.29 §0.7, `architecture` v0.41 §17, `cockpit_agent_memory` id=330 (importance=10, handle=`all`).

---

## 3. Database discipline (P1 — added 2026-05-11)

The Supabase DB has 158+ tables across 19 schemas plus extensive
materialized views. **Discovering before creating is mandatory.**

### 3a. Before creating ANY new DB object

Run discovery first:

```sql
-- Functions / RPCs
SELECT n.nspname || '.' || p.proname AS fn
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname ILIKE '%<domain>%' AND n.nspname NOT IN ('pg_catalog','information_schema');

-- Tables / views
SELECT n.nspname AS schema, c.relname, c.relkind
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname ILIKE '%<domain>%' AND c.relkind IN ('r','v','m')
  AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast');

-- Columns of existing tables (verify names + types — never assume)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='<schema>' AND table_name='<table>';

-- Enum values / status strings (verify actual values, never assume)
SELECT status, COUNT(*) FROM <table> GROUP BY status ORDER BY 2 DESC;
```

If a comparable object exists, **use it** — do not wrap it in a new
function unless the wrapper adds genuinely new logic.

### 3b. Canonical views — source of truth, do NOT duplicate

| View | What it returns |
|---|---|
| `mv_kpi_today` | Today's snapshot per property |
| `v_kpi_daily` | Daily KPI series, USALI-aligned (USD) |
| `v_revenue_usali` | Revenue by USALI department |
| `kpi.v_occupancy_base` | Occupancy base view |
| `kpi.v_capture_rate_daily` | Daily capture rate |
| `kpi.v_ancillary_daily` | Daily ancillary revenue |
| `sync_watermarks` | Per-entity Cloudbeds → Supabase sync state |
| `mv_kpi_daily_by_segment` | Daily KPIs by segment |

If you build a function or view that duplicates the math in any of
these, you are creating drift between chat answers and dashboards. Use
the canonical view as a building block.

### 3c. Verified facts (do not assume — verify)

| Concern | Reality |
|---|---|
| `reservations.status` values | `checked_out`, `canceled` (not `cancelled`), `no_show`, `confirmed`, `checked_in` |
| `cockpit_tickets.status` values | `triaged`, `completed` (not `done`), `awaits_user`, `archived` |
| `reservation_rooms.rate` currency | USD (NOT LAK, despite Namkhan being in Laos) |
| `cockpit_agent_memory.memory_type` enum | `observation`, `decision`, `outcome`, `pattern`, `preference`, `fact` |
| Property timezone | `Asia/Vientiane` for Namkhan; tenant-scoped going forward |
| Operating currencies | LAK (Namkhan), EUR (Donna), USD (Beyond Circle reporting) |

### 3d. Never assume

- Column names — verify in `information_schema.columns`
- Enum / status values — `SELECT DISTINCT … FROM table`
- Currency — verify what's actually stored; label correctly
- Existence — `pg_class` / `pg_proc` lookups before any DDL

---

## 4. Forward-writing discipline

Every significant change writes itself forward so the next session,
next agent, and next property build inherits context. **If it isn't in
one of these tables, it didn't happen.**

| What | Table |
|---|---|
| Every agent action, tool call, merge, sync run | `cockpit_audit_log` |
| Every DDL change + significant state change | `cockpit_change_log` (planned) |
| Significant architectural decisions | `cockpit_decisions` (ADR table, planned) |
| End-of-session handoffs | `documentation.documents` + `document_versions` |
| Agent learnings, standing rules | `cockpit_agent_memory` (importance ≥ 9 for rules) |

### Session end (before declaring work done)

1. Run `date -u +%Y-%m-%dT%H:%M:%SZ` — never invent timestamps.
2. Write a handoff entry to `documentation.documents` summarising what
   changed, what's in flight, what's blocked.
3. If a new rule was learned, write it to `cockpit_agent_memory` with
   appropriate importance.
4. Commit doc updates with the deploy commit.

**Do not skip this step.** Tonight's sessions have surfaced repeatedly
that agents start cold because handoffs weren't written.

---

## 5. Design system rules

If you are touching UI, styles, or `lib/format.ts`:

1. Read `DESIGN_NAMKHAN_BI.md` end-to-end before any UI work.
2. Use the six canonical primitives only: `<Page>`, `<KpiBox>`,
   `<Panel>`, `<DataTable>`, `<Brief>`, `<Lane>` + `<ProposalCard>`.
3. No hardcoded `fontSize` numeric literals — use `var(--t-*)`.
4. No hex colors outside `:root` — use brand CSS variables.
5. No `USD ` prefix — use `$` for USD, `₭` for LAK, `€` for EUR.
6. Em-dash `—` for empty cells, never `N/A` / `null` / `0`.
7. True minus `−` (U+2212) for negatives, never ASCII hyphen.

Verification greps (CI-enforced):

```bash
npx tsc --noEmit
grep -rE "fontSize:\s*[0-9]" app/ components/ | grep -v fuse_hidden | wc -l   # must be 0
grep -rE 'USD \{|USD [0-9]' app/ components/ | grep -v 'fuse_hidden\|//' | wc -l  # must be 0
grep -rE "fontFamily:\s*'(Georgia|Menlo|Helvetica|Arial)" app/ components/ | wc -l  # must be 0
```

For everything else design-related, defer to `DESIGN_NAMKHAN_BI.md`.

---

## 6. Hard constraints (no exceptions)

### Code

- Never invent Cloudbeds fields, endpoints, or response shapes —
  cross-reference Cloudbeds API docs or developer forum; flag if
  unverified.
- Never push directly to `main` — always PR.
- Admin-bypass merges are for emergencies only, logged in audit_log
  with reason.
- Never modify production schema without PBS approval.
- Never disable tests to make a PR green.
- Never commit secrets or `.env` files — `.gitignore` already covers
  them. `gitleaks` pre-commit hook coming (ADR-002).
- Never touch payment, auth, or booking-write code without approval.

### Data

- Never invent values. If Supabase or Cloudbeds doesn't return it, say
  so. Never fabricate numbers.
- Never cross tenant boundaries in queries outside Beyond Circle
  internal aggregation views.
- Never write tenant data without `tenant_id` AND `property_id`.

### Agents / chat

- Never give particular advice in public visitor mode without enough
  property context (Phase 2 rule, but design code for it now).
- Never claim auto-run for an action that hasn't reached its trust
  threshold.
- Never bypass the proposal lifecycle (proposal → in_process → done).

---

## 7. Hospitality / business rules

- **USALI 11th edition** is the accounting standard for all reporting.
- **Cloudbeds is the sole PMS-revenue source** for properties where
  `pms_source = 'cloudbeds'`. Never propose changes that bypass it.
- **Direct booking growth** is a primary KPI. Never propose changes that
  reduce it.
- **Currency:** operating currency varies per property (LAK, EUR, ...);
  reporting currency = USD for all TBC tenants; Beyond Circle
  consolidates in USD.
- **Multi-language:** day-one EN, ES, LO, DE. Agent generates in
  user's language. UI translated via i18n catalogs. Brand-voiced
  content per property per language.
- **Brand:** Namkhan, Donna Portals, and future client properties each
  have distinct brand voices and visual identities. Same schema, fully
  separated content. Never blend.

---

## 8. Output style when responding to PBS

- Bullets and tables; not paragraphs.
- Lead with the answer, then the reasoning.
- If PBS's logic is wrong, say so directly with reasoning.
- Never apologise unnecessarily or add filler.
- Show 2–3 alternatives when a real choice exists.
- Be willing to be unpopular when correct.

This is also captured in `cockpit_agent_memory` at importance=10 — do
not let it drift.

---

## 9. Agent roles when running as a team

| Role | Owns | Cannot do |
|---|---|---|
| Lead (Felix) | Decomposition, dispatch, synthesis, audit log writes | Direct code commits — delegates |
| Frontend | UI, components, styling | Backend logic, schema |
| Backend | API routes, business logic | UI, schema migrations without approval |
| Designer (read-only) | Design-token + brand enforcement | Modify code — flags only |
| Tester | Playwright, unit tests, regression | Modify production code |
| Reviewer | Security, deps, perf, correctness | Modify code — flags only |
| Researcher | Investigation, analysis | Modify code |

Specialist HoD agents (Vector, Lumen, Intel, Forge, Mercer) are bound
to modules — see `ARCHITECTURE.md` §17.

---

## 10. Stack (authoritative)

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) / React |
| Hosting | Vercel (Pro) — team `pbsbase-2825s-projects`, project `namkhan-bi` |
| Database | Supabase (Pro) — `namkhan-pms` (id `kpenyneooigsyuuomgct`), eu-central-1 |
| Integration ETL | Make.com (Pro) |
| AI | Anthropic Claude (Sonnet 4.5 — ZDR for prod, ADR-002) |
| CI/CD | GitHub Actions + Vercel auto-deploy from `main` |
| Monitoring | Vercel Speed Insights, Web Analytics, Vercel Agent |
| Secret storage | GitHub Secrets, Vercel env vars, Supabase Vault, Make Connections |
| Billing (Phase 2+) | Stripe |

No new tools without an ADR.

---

## 11. Email / ticket conventions (Dev Arm)

- Tickets are created from chat or from email (intake address: TBD).
- Digest / alert email: `data@thedonnaportals.com`.
- If ticket intent is unclear, ask 1–3 clarifying questions before
  building.
- Always ship a preview URL; never auto-merge to production for
  non-trivial changes.
- Reply format: brief summary → what was done → preview link → what
  PBS needs to decide.

---

## 12. When you're stuck

1. Re-read this file + `ARCHITECTURE.md`.
2. Query Supabase: `cockpit_agent_memory` (rules), `cockpit_audit_log`
   (recent activity), `documentation.documents` (prior handoffs).
3. Check `cockpit/decisions/` and `cockpit_decisions` table for ADRs.
4. Search `cockpit_tickets` for similar past tickets.
5. Still stuck: document the blocker in the ticket; escalate via chat
   or email — do not guess.

---

## 13. Updating this file

- Append updates with a date heading at the bottom of the relevant
  section + a reason.
- Don't rewrite history.
- Major changes need an ADR in `cockpit_decisions`.

---

## Update history

| Date | Change | Author |
|---|---|---|
| 2026-05-03 | Mandatory session ritual locked | PBS |
| 2026-05-05 | Cockpit operating rules added | PBS |
| 2026-05-09 | Design system manifesto locked | PBS |
| 2026-05-11 | v2.0 — restructured: leads with reading order; multi-tenant rules as P1; database-discipline section added (tonight's lessons); points at ARCHITECTURE.md instead of duplicating; design rules trimmed and deferred to DESIGN_NAMKHAN_BI.md; stale rules removed (deploy-CLI-only line dropped) | PBS + Claude |
