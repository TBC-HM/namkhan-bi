# Deploy prompt — `/front-office/arrivals` (schema)

**Use:** drop into `~/Desktop/namkhan-bi/proposals approved/` to approve. The next scheduled-task run will turn this into a deploy doc in `~/Desktop/namkhan-bi/to vercel production /`. Schema can ship independently of the frontend.

## Brief for the implementing Claude Code session

**Project ref:** `kpenyneooigsyuuomgct` (eu-central-1)
**Mechanism:** Supabase MCP `apply_migration` — never `execute_sql` for schema changes.

### Pre-flight

- [ ] Confirm `/sales/inquiries` schema (S1) status. If shipped, you can wire `frontoffice.brand_voice` as a view over `sales.brand_voice`. If not, ship the local `frontoffice.brand_voice` table per F1.
- [ ] Confirm `crm.contacts` (S9) status. If pending, `frontoffice.compute_tier_score()` falls back to `cloudbeds.guests.is_repeat` only.
- [ ] Confirm `governance.decision_queue` and `governance.alerts` exist (they should — `/finance/pnl` shipped them). If not, escalate.
- [ ] Confirm flight-ingest decision (FlightAware vs FlightRadar24 vs manual). If undecided, ship F1 only and leave ETA Watcher paused.

### Migration order

1. `mcp__supabase__create_branch("feat-front-office-schema")`
2. `mcp__supabase__apply_migration` with the F1 migration body from `schema-gap-analysis.md` (schema + 9 tables + 3 functions + RLS policies + DOWN block).
3. Smoke tests on the branch:
   - `select count(*) from frontoffice.arrivals;` → 0 (clean schema, no rows yet)
   - `select frontoffice.refresh_arrivals_board(7);` → returns int (stub today, real impl later)
   - Insert one fake row, run `select frontoffice.arrival_decay(1, 'room_up');` → returns numeric.
   - RLS check: simulate `fo_member` role → can read `arrivals`, cannot read `vip_briefs` (vip_briefs restricted to fo_lead/reservations/hk_lead/fnb_lead/concierge/gm).
4. If smoke clean: `mcp__supabase__merge_branch`
5. `mcp__supabase__delete_branch`
6. Drop `.shipped` marker next to this prompt.
7. Update `~/Desktop/cbfiles/supabase/15_SUPABASE_ARCHITECTURE.md` migration history (new schema count: 19 → 20; new table count: 158 → 167; new RLS policies: 247 → 253).

### What this migration does NOT do

- Does **not** wire flight ingest (FlightAware / FlightRadar24). That is F-EXT-1, separate migration + cron + secret.
- Does **not** wire email / WhatsApp ingest. That is F-EXT-2, shared with `/sales/inquiries` S2.
- Does **not** populate any rows. The frontend can ship in parallel; both will show "Data needed" until ingest is live.
- Does **not** activate any agent. Agent activation is a separate ops decision in `/agents/settings`, gated by guardrail validation.

### Rollback

Run the `-- DOWN` block from the F1 migration. It is idempotent. No data loss because no production data writes happen pre-ingest.

### Acceptance criteria

- [ ] `frontoffice` schema exists with 9 tables, 3 functions, 6 RLS policies.
- [ ] `governance.decision_queue` and `governance.alerts` row inserts from this section work without ACL violation (test with a synthetic insert from server-action role).
- [ ] No regression in any other schema's RLS or tables.
- [ ] Architecture inventory doc updated.

### Done

- [ ] `.shipped` marker placed.
- [ ] Append a row to `to vercel production /_LOG.md` with the migration timestamp.
- [ ] Update `proposals/_index.md` schema-shipped column.
