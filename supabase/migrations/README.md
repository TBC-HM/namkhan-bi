# supabase/migrations

Schema gaps for `/operations/housekeeping` (Gap-H1..H6) and `/operations/maintenance` (Gap-M1..M9), copied from the 2026-04-30 deploy package.

## Apply order (already encoded in filename prefix)

| # | Domain | Gap | Notes |
|---|--------|-----|-------|
| 01 | HK | H1 | `ops.room_status` — CRITICAL, blocks every HK panel |
| 02 | HK | H2 | `ops.hk_assignments` |
| 03 | HK | H5 | `ops.v_dnd_streaks` (view, free) |
| 04 | HK | H6 | `governance.amenity_budget` + `ops.amenity_loadouts` |
| 05 | HK | H3 | `ops.linen_pars` + `ops.laundry_cycle` |
| 06 | HK | H4 | `ops.lost_and_found` |
| 07 | MT | M7 | `ops.vendors` (small, ship first) |
| 08 | MT | M1 | `ops.maintenance_tickets` — CRITICAL |
| 09 | MT | M2 | `ops.assets` — requires manual census ~140 assets |
| 10 | MT | M3 | `ops.v_asset_history` + `ops.v_asset_health` (free views) |
| 11 | MT | M5 | `ops.ppm_templates` + `ops.ppm_tasks` |
| 12 | MT | M8 | `ops.compliance_log` |
| 13 | MT | M4 | `ops.energy_meters` + `ops.energy_readings` (manual v0) |
| 14 | MT | M6 | `ops.spare_parts` |
| 15 | MT | M9 | `governance.maintenance_budget` |
| 16 | MT |  | `ops.v_vendor_scorecard_90d` |

## How to apply

These have **NOT** been applied to Supabase prod. Apply via one of:

**Option A — Supabase MCP** (preferred):
```
# inside Cowork/Claude Code session
supabase mcp execute_sql … per file in order
```

**Option B — psql**:
```bash
export SUPABASE_DB_URL="postgresql://…"
for f in supabase/migrations/202604301200*_hk_*.sql; do psql "$SUPABASE_DB_URL" -f "$f"; done
for f in supabase/migrations/202604301200*_mt_*.sql; do psql "$SUPABASE_DB_URL" -f "$f"; done
```

## Hard rule

Do NOT apply `09_mt_03-assets.sql` (FK from `maintenance_tickets`) until either (a) the asset census is complete, or (b) `ops.maintenance_tickets` is empty. Otherwise the FK fails on existing rows.

Front-end pages render with "Data needed · Gap-Hx / Gap-Mx" overlays until the corresponding migration has run and the table has rows.
