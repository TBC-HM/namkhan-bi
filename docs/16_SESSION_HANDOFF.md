# 16 · Session Handoff — Live State (rolling)

**Status:** LIVE — refreshed 2026-05-09 at end of repair-list batch.

This file is the single read-on-mount handoff for any new agent or session. The 5-minute snapshot below tells you everything that survives across sessions; the `cockpit_knowledge_base` rows linked at the bottom carry the long-form detail.

---

## TL;DR — what is this app right now?

Namkhan BI is a Next.js 14 / Vercel / Supabase BI dashboard for The Namkhan, a 24/30-room SLH-affiliated boutique eco-retreat in Luang Prabang, Laos. Cloudbeds PMS is the sole revenue source. LAK base, USD reporting. Dark canvas, brass + paper accents, six canonical primitives only (`<Page>`, `<KpiBox>`, `<Panel>`, `<DataTable>`, `<Brief>`, `<Lane>`+`<ProposalCard>`).

- Vercel: project `namkhan-bi` (`prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl`, team `pbsbase-2825s-projects`, fra1)
- Supabase: project `namkhan-pms` (`kpenyneooigsyuuomgct`, eu-central-1, **Supabase Auth**)
- GitHub: `TBC-HM/namkhan-bi`
- Cloudbeds property ID: `260955`
- FX assumption: 21,800 LAK / USD

## Where the latest work lives

- **`cockpit_knowledge_base`** — the source-of-truth table (`scope IN ('design_system_log','system_architecture','design_system_manifesto','repair_list_status','ux_redesign','property_identity_v1')`). On any new session, read with `mcp__claude_ai_Supabase__execute_sql`:
  ```sql
  SELECT id, topic, scope, key_fact FROM public.cockpit_knowledge_base
   WHERE scope IN ('design_system_log','system_architecture','design_system_manifesto','repair_list_status')
     AND created_at > now() - interval '7 days'
   ORDER BY created_at DESC LIMIT 50;
  ```
- **`DESIGN_NAMKHAN_BI.md` (repo root)** — canonical design system + dated changelog. Every UI session must read this on start AND append at end (locked ritual; see `CLAUDE.md`).
- **`docs/CHANGELOG.md`** — operational changelog by date. Latest entry 2026-05-09 captures the repair-list batch.
- **`cockpit_agent_prompts`** — active persona system prompts (one row per `role` where `active=true`). Most recent batch dated 2026-05-09 added a "CHAT MODE — DECIDE FIRST" preamble to all 7 personas (lead + 6 HoDs).

## Current canonical-component invariants

| Concern | Component | Path |
|---|---|---|
| Page shell | `<Page>` | `components/page/Page.tsx` |
| KPI tile | `<KpiBox>` | `components/kpi/KpiBox.tsx` |
| Card | `<Panel>` | `components/page/Panel.tsx` |
| Sortable table | `<DataTable>` | `components/ui/DataTable.tsx` (must wrap in `'use client'`) |
| Brief | `<Brief>` | `components/page/Brief.tsx` |
| Kanban lane | `<Lane>` + `<ProposalCard>` | `components/page/{Lane,ProposalCard}.tsx` |
| Format helpers | `lib/format.ts` (`fmtKpi`, `fmtTableUsd`, `fmtIsoDate`, `EMPTY`, …) |

Hard rules: `$` for USD, `₭` for LAK, `—` (em-dash) for empty, `−` (U+2212) for negatives. Italic Fraunces for KPI values; mono uppercase brass-letterspaced for headers. Zero hardcoded `fontSize: <number>` literals — every size flows through `var(--t-xs|sm|base|md|lg|xl|2xl|3xl)`.

## Verification recipes (run before claiming consistency)

```bash
# Type-check
npx tsc --noEmit

# Zero hardcoded fontSize
grep -rE "fontSize:\s*[0-9]" app/ components/ | grep -v fuse_hidden | wc -l   # must be 0

# Zero `USD ` prefix
grep -rE 'USD \{|USD [0-9]' app/ components/ | grep -v 'fuse_hidden\|//' | wc -l   # must be 0

# Cache-bust on Vercel (revalidate=60 + force-dynamic still cache HTML)
curl -fsS "https://namkhan-bi.vercel.app/<route>?bust=$RANDOM"
```

## Deploy protocol (locked)

1. `npx tsc --noEmit` — must be clean before deploy.
2. `npx vercel@52 --prod --yes --force` (vercel@53.3.0 broken on npm; stay on @52). The `--force` is mandatory.
3. Smoke 200 on every touched route via the alias **and** the immutable deploy URL.
4. Cache-bust with `?bust=$RANDOM` on each smoke.
5. Append a dated bullet to `DESIGN_NAMKHAN_BI.md` under the right `### YYYY-MM-DD` heading.
6. Insert a `cockpit_knowledge_base` row (scope `design_system_log`, `key_fact` populated — there is no `body` column).

## What changed today (2026-05-09)

See `docs/CHANGELOG.md` § 2026-05-09 for the full list. Highlights:

- P/L 2025 + 2026 backfill (1497 rows, 17 periods)
- New `cockpit_bugs` table + Bugs box on every dept-entry page (red→orange→light green→dark green workflow)
- ChatShell: fresh-on-mount + "+ Create task" button + `conversation_history` wiring + CHAT MODE preamble across all 7 personas
- Compare-mode KPI tones threaded across channels + reports
- Dark-canvas table CSS root-cause fix (round 3, `body table { ... !important }`)
- `/cockpit/schedule` 404 fixed via redirect to `?tab=schedule`
- `/messy-data` unpaid-bills panel + auto-save dropdown + update API
- `/operations/events` new month-view calendar
- `/revenue/parity` rebuilt as date×OTA grid per PBS reference screenshot
- `/revenue/pulse` RM-meaningful redesign
- `/api/operations/inventory/sync-cloudbeds` `property_id` NOT NULL fix
- `HeaderPills` brightened
- `/knowledge` hidden from nav
- 16 KB rows logged (`#525` through `#540`)

## What's pending — read this first if you're picking up

`cockpit_knowledge_base.id = 536` (scope `repair_list_status`) lists every repair-list item PBS asked for, with status. The biggest open buckets:

- **Compset wiring + Top-insights chart per screenshot** (in flight via parallel agent)
- **Media library dropdown + search** (in flight)
- **Customer profile slide-in: contact fields + Bookings tab** (in flight)
- Suppliers operations page (channels-style, NEW)
- Pricing page KPI box wiring
- Reports builder (currently broken — default report routes to `/revenue/pace` instead of producing output)
- Pulse: today's sales / today's cancellations + hover detail
- Settings cleanup: only property settings stay under `/settings`; rest moves to `/cockpit`
- Email cockpit back button + top menu
- B2B / DMC differentiation (MICE / DMC / retreats / groups)
- Inquiry page email routing (book@ / reservations@ / plan@ / wm@ / xl@) + working header buttons
- KPI / weather / air popovers staying open while moving the mouse
- Customer targeting xlsx → Supabase schema (the `customer_targeting_definitions` workbook on Desktop)

## Don'ts (locked by past incident)

- Don't push directly to `main` — always PR.
- Don't modify production schema without approval.
- Don't fabricate values (FX, room counts, prices, guest contact info) — query `app_settings` / Supabase / Cloudbeds.
- Don't introduce new tile/card markup mimicking `<KpiBox>` or `<Panel>` — use the primitives.
- Don't bypass tests, hooks, or signing (`--no-verify`, `--no-gpg-sign`) without explicit instruction.
- Don't commit `.env*` or service-role keys.
- Don't ship a UI change without appending to `DESIGN_NAMKHAN_BI.md` under today's date.

## Pointers

- North-star manifesto: `cockpit_knowledge_base WHERE scope = 'design_system_manifesto'` (ids 483–489 — never overwrite).
- Property identity card: `cockpit_knowledge_base WHERE scope = 'property_identity_v1'` (legal name, tax ID, address, logos).
- Master compliance contract: `cockpit_knowledge_base.topic = 'KB_MASTER_COMPLIANCE_CONTRACT'`.
- USALI: `docs/04_USALI_MAPPING.md` + `usali_category_map` table.
- Cloudbeds API: `docs/02_CLOUDBEDS_API_REFERENCE.md`.

## Legacy stub content (preserved for reference)

The previous version of this file was a stub describing F1–F11 / E1–E8 / D1–D5 categories from the never-imported `COWORK_HANDOFF_2026-05-01.md`. Those identifiers are no longer used; tickets now live in `cockpit_knowledge_base`, `cockpit_proposals`, and the dept-entry Bugs box. If you find a cross-reference to F1–F11 in older docs, treat it as historical.

---

*Last updated 2026-05-09 by Claude Opus 4.7 (1M context). Append-only above this line; do not rewrite history.*
