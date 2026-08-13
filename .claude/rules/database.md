paths: supabase/**, db/**, lib/data*, lib/data/**, app/api/**

# Database & data-platform rules

DDL flow:
- supabase/migrations/ is DEAD (stale since 2026-05; live DB has 360+ more migrations). Schema changes go via Supabase MCP apply_migration after discover-before-create + PBS approval. Files under db/proposed/<brief>/ are the audit copy.
- apply_migration is transactional — split risky multi-view migrations.
- CREATE OR REPLACE VIEW cannot rename/reorder columns: DROP then CREATE (tail-append is safe).
- No volatile fns (now(), CURRENT_DATE) in materialized views.

Bridge + GRANT recipe (invariant 3):
Every migration creating a public object ends with:
REVOKE ALL ON public.v_x FROM anon;
-- functions additionally:
REVOKE ALL ON FUNCTION public.fn_x(...) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_x(...) TO authenticated, service_role;
Bridge objects are SECURITY DEFINER -> bypass RLS -> MUST filter property_id themselves. Matviews can't have RLS — never grant them to anon. Deliberate anon exposure needs an ADR + governance.security_anon_allowlist row.

Metric truth (query these, don't re-derive):
- Medallion: read pms.v_* silver views only — never reservations_cb / reservations_mews directly. Gold (kpi.*) reads silver + spine.
- data_source is per-property: Namkhan KPIs filter 'cloudbeds_api'; Donna is CSV-sourced (csv_bulk_load + gapfills) by design — do not "fix" it.
- Capacity is time-varying: core.fn_property_capacity(pid, night) / core.v_property_night — never core.properties.capacity_*.
- Room nights = nights stayed in period (pms.v_reservation_rooms.night_date), never check-in-attributed sums.
- Cancellations: pms.v_reservation_rooms does NOT filter them — join the reservations silver, is_cancelled = false; COALESCE(cancellation_date::date, booking_date::date) (14% NULLs).
- Currency layers (ADR-173): no single "operating currency". finance.gl_pl_monthly.amount_usd holds the GL currency, not USD — read finance.gl_accounts.currency. Money views expose a currency column.
- LY alignment: ly_* columns carry the CURRENT year's period key (shift period_year + 1 in the LY CTE).
- Revenue views are PMS-sourced (pms.v_reservation_rooms.rate); QuickBooks GL income belongs to Finance only.
- Before claiming data missing: search kpi.kpi_catalog, information_schema.views, fn_brain_platform_search — cite empty results.

Ingestion:
- xlsx imports reject reservation_id ~* '^(Total|Summary|Sum|Subtotal)$'.
- pg_net responses land only AFTER commit — never poll in-transaction; verify pushes via ledger/Contents API, not the timeout envelope.
