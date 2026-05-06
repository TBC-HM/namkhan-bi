-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505154548
-- Name:    b26_add_unique_index_mv_kpi_today_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B26: mv_kpi_today has no unique index, so REFRESH MATERIALIZED VIEW CONCURRENTLY fails silently.
-- Add a unique index on (property_id, as_of) so concurrent refresh works.
CREATE UNIQUE INDEX IF NOT EXISTS mv_kpi_today_pk_idx
  ON public.mv_kpi_today (property_id, as_of);