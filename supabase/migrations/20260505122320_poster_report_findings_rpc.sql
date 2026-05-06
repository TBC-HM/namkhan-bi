-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505122320
-- Name:    poster_report_findings_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Single RPC that returns every finding the report page renders, with counts
-- and dollar impact. Cheap one-shot — page calls this once and renders.
CREATE OR REPLACE FUNCTION public.poster_report_findings()
RETURNS TABLE (
  unmatchable_clients_n         integer,
  unmatchable_clients_usd       numeric,
  ambiguous_room_n              integer,
  ambiguous_room_usd            numeric,
  unaliased_distinct_clients    integer,
  alias_review_n                integer,
  amount_mismatch_n             integer,
  amount_mismatch_usd           numeric,
  no_cb_lines_n                 integer,
  no_cb_lines_usd               numeric,
  open_receipts_n               integer,
  open_receipts_usd             numeric,
  deleted_receipts_n            integer,
  deleted_receipts_usd          numeric,
  without_payment_n             integer,
  without_payment_usd           numeric,
  internal_n                    integer,
  internal_usd                  numeric,
  charge_room_total_n           integer,
  charge_room_total_usd         numeric,
  matched_green_n               integer,
  matched_green_usd             numeric,
  reconciled_at                 timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
WITH cr AS (
  SELECT * FROM pos.poster_receipts
  WHERE payment_method = 'Charge Room / to Folio' AND status = 'Close'
)
SELECT
  -- Reconciliation findings (Charge to Room only)
  (SELECT COUNT(*)         FROM cr WHERE reconciled_with IS NULL OR reconciled_with = 'no_match')::int        AS unmatchable_clients_n,
  COALESCE((SELECT SUM(order_total) FROM cr WHERE reconciled_with IS NULL OR reconciled_with = 'no_match'), 0) AS unmatchable_clients_usd,
  (SELECT COUNT(*)         FROM cr WHERE reconciled_with = 'ambiguous_room')::int                              AS ambiguous_room_n,
  COALESCE((SELECT SUM(order_total) FROM cr WHERE reconciled_with = 'ambiguous_room'), 0)                      AS ambiguous_room_usd,
  -- Distinct Poster client values that have no alias entry yet
  (
    SELECT COUNT(DISTINCT client) FROM cr
    WHERE client IS NOT NULL
      AND client !~* '^(NK |Hotel Guest|Volunteer)'
      AND lower(trim(client)) NOT IN (SELECT lower(trim(poster_client)) FROM pos.poster_room_type_alias)
      AND lower(trim(client)) NOT IN (SELECT lower(trim(room_type_name)) FROM public.reservations WHERE property_id=260955)
      AND lower(trim(client)) NOT IN (SELECT lower(trim(guest_name))     FROM public.reservations WHERE property_id=260955)
  )::int                                                                                                       AS unaliased_distinct_clients,
  (SELECT COUNT(*) FROM pos.poster_room_type_alias WHERE confidence = 'review')::int                           AS alias_review_n,
  (SELECT COUNT(*)         FROM cr WHERE reconciled_with = 'amount_mismatch')::int                             AS amount_mismatch_n,
  COALESCE((SELECT SUM(order_total) FROM cr WHERE reconciled_with = 'amount_mismatch'), 0)                     AS amount_mismatch_usd,
  (SELECT COUNT(*)         FROM cr WHERE reconciled_with = 'no_cb_lines')::int                                 AS no_cb_lines_n,
  COALESCE((SELECT SUM(order_total) FROM cr WHERE reconciled_with = 'no_cb_lines'), 0)                         AS no_cb_lines_usd,
  -- Hygiene findings (all receipts)
  (SELECT COUNT(*)         FROM pos.poster_receipts WHERE status = 'Open')::int                               AS open_receipts_n,
  COALESCE((SELECT SUM(order_total) FROM pos.poster_receipts WHERE status = 'Open'), 0)                        AS open_receipts_usd,
  (SELECT COUNT(*)         FROM pos.poster_receipts WHERE status IN ('Delete','Canceled'))::int                AS deleted_receipts_n,
  COALESCE((SELECT SUM(order_total) FROM pos.poster_receipts WHERE status IN ('Delete','Canceled')), 0)        AS deleted_receipts_usd,
  (SELECT COUNT(*)         FROM pos.poster_receipts WHERE status = 'Close' AND payment_method = 'Without payment')::int AS without_payment_n,
  COALESCE((SELECT SUM(order_total) FROM pos.poster_receipts WHERE status = 'Close' AND payment_method = 'Without payment'), 0) AS without_payment_usd,
  (SELECT COUNT(*)         FROM pos.poster_receipts WHERE status = 'Close' AND payment_method = 'Internal  (Bfast,Mgmt/Staff,IMekong)')::int AS internal_n,
  COALESCE((SELECT SUM(order_total) FROM pos.poster_receipts WHERE status = 'Close' AND payment_method = 'Internal  (Bfast,Mgmt/Staff,IMekong)'), 0) AS internal_usd,
  -- Headline totals
  (SELECT COUNT(*) FROM cr)::int                                                                                AS charge_room_total_n,
  COALESCE((SELECT SUM(order_total) FROM cr), 0)                                                                AS charge_room_total_usd,
  (SELECT COUNT(*) FROM cr WHERE reconciled_with = 'cloudbeds_match')::int                                     AS matched_green_n,
  COALESCE((SELECT SUM(order_total) FROM cr WHERE reconciled_with = 'cloudbeds_match'), 0)                     AS matched_green_usd,
  (SELECT MAX(reconciled_at) FROM cr)                                                                          AS reconciled_at;
$$;

GRANT EXECUTE ON FUNCTION public.poster_report_findings() TO anon, authenticated, service_role;