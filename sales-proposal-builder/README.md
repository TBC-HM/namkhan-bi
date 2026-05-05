# sales-proposal-builder · handoff

**Generated:** 2026-05-03
**Status:** SHIPPED · live at https://namkhan-bi.vercel.app
**Owner:** PBS

## What landed in this build

### Database (`namkhan-pms` Supabase, applied via MCP)
- 17 `sales.*` tables · 41 RLS policies · 2 RPCs (`proposal_available_rooms`, `proposal_inventory_freshness`)
- 30 LP activities seeded (12 internal · 18 external) across 7 categories, 7 partners
- 5 sample inquiries seeded so the queue has shape (James Kim, Hanoi Architects Co, Sophie Martin, Liu Wei, Hartmann GmbH)
- `pgrst.db_schemas` correctly merged: appended only `sales` (per `feedback_pgrst_db_schemas_merge.md` rule)
- 6 migration files in `supabase/migrations/2026050309000{1..6}_*.sql` + rollback file

### Code (design-conformant per `DESIGN_NAMKHAN_BI.md`)
- `lib/sales.ts` — server-only data layer, all queries via `getSupabaseAdmin()`
- `lib/composerRunner.ts` — Auto-Offer Composer with stub fallback (€0.20/proposal cost cap, logs to `sales.agent_runs`)
- `lib/ics.ts`, `lib/makeWebhooks.ts`
- 11 API routes under `/api/sales/proposals/*` and `/api/p/[token]/*` (added `/check` for the pre-send gate)
- 3 pages: `/sales/inquiries/[id]`, `/sales/proposals/[id]/edit`, `/p/[token]`
- 5 React components in `components/proposal/` — all use `<PageHeader>`, `<DataTable>`, `<StatusPill>`, `.panel`, `.btn`, `lib/format`
- ~220 lines of CSS appended to `styles/globals.css` using brand tokens (zero hex literals introduced)

### Pre-send room availability gate (commit `f0d6942`)
At Send time, re-checks `rate_inventory` for every room block on the proposal:
- 🟢 GREEN: `min_avail > qty` AND `synced_at` < 60min — Send button enabled
- 🟡 YELLOW: tight (`min_avail == qty` or `qty + 1`) OR rate_inventory stale — Send allowed but warning banner
- 🔴 RED: any room sold out for ≥1 night, OR `min_avail < qty` — Send button DISABLED + "Force-send anyway" button surfaces

Per-room messages spell out the action: *"Open Cloudbeds → Calendar → River Suite to add a block, then re-check."* The agent's mental model: pick rooms in composer → see banner → if red, go to Cloudbeds and add a manual block → click "↻ Re-check" → green → send.

Endpoints:
- `GET /api/sales/proposals/[id]/check` — returns the `ProposalCheck` JSON (used by the live banner)
- `POST /api/sales/proposals/[id]/send` — pre-checks; returns 409 with check details if blocked
- `POST /api/sales/proposals/[id]/send?force=1` — agent override, logged in `proposal_sent` Make webhook payload as `forced: true`

### Modifications to existing files
- `components/nav/subnavConfig.ts` — Packages flipped `coming` → `isNew`
- `app/sales/inquiries/page.tsx` — wired to live `sales.inquiries` data via `listInquiries()`, falls back to mock decisions if empty
- `next.config.js` — `X-Robots-Tag: noindex` + `Cache-Control: private, no-store` on `/p/:token`
- `lib/agents/sales/autoOfferComposer.ts` — agent status flipped `idle` → `run`

## Verification gates (all green)

- `npx tsc --noEmit` → exit 0
- `grep -rE "fontSize:\s*[0-9]" components/proposal app/sales/inquiries/[id] app/sales/proposals app/p` → 0 hits
- `grep -rE "fontFamily:\s*'(Georgia|Menlo|Helvetica|Arial)" ...` → 0 hits
- `grep -rE "#[0-9a-fA-F]{6}" components/proposal app/sales/inquiries/[id] app/sales/proposals app/p` → 0 hits
- `grep -rE 'USD \{|USD [0-9]' ...` → 0 hits
- All 5 client components carry `'use client';` directive
- Live HTML: `/sales/inquiries` contains `James`, `Liu Wei`, `Sophie Martin`, `Hartmann`, `Hanoi Architects` ✓
- `/sales/inquiries/{real-id}` → 200 (new dynamic route works)
- `/p/test-bad-token` → 404 (new route, correct for invalid token)

## Schema fixes vs the original 04b-deployment.md spec

The original deploy doc had three errors caught by live DB inspection:
1. FK to `marketing.campaign_assets(id)` → real table is `marketing.media_assets(asset_id)`
2. FK to `governance.dmc_contracts(id)` → real PK column is `contract_id`
3. `pgrst.db_schemas` doc assumed `ops/frontoffice/revenue` were exposed — they're intentionally internal. Merge appended only `sales`.

## Next steps for PBS

1. **Walk through the live portal** — `/sales/inquiries` → click James → "Open in Composer →" → add a few activities → switch to Email tab → "↻ Re-draft with AI" (real Claude) → "Send to guest →" → opens `/p/[token]` in new tab → test on phone.
2. **Import 5 Make scenarios** from `make-blueprints/` (each `.json` is a Make blueprint).
3. **Set 5 webhook env vars** in Vercel (see `env-vars-to-add.md`) using the URLs Make assigns after import.
4. **Nudge the other Claude session** to run `cb_sync_*` so `rate_inventory.synced_at` is fresh — currently 4.4 days stale, which makes the room picker drawer empty + show the "Rates stale" warning banner.

## Files in this folder

```
README.md                       (this file)
env-vars-to-add.md
make-blueprints/
  proposal-sent.json
  proposal-viewed.json
  proposal-guest-edited.json
  proposal-signed.json
  proposal-expired.json
migrations/
  20260503090001_sales_schema_base.sql
  20260503090002_sales_activity_catalog.sql
  20260503090003_sales_seed_activities.sql
  20260503090004_sales_rls.sql
  20260503090005_pgrst_expose_sales.sql
  20260503090006_rpc_available_rooms.sql
  rollback/
    20260503090001_sales_rollback.sql
```

The `to-vercel-production/` folder is gitignored from Vercel deploys (`.vercelignore` + `tsconfig.json` exclude) so contents won't accidentally ship as code.
