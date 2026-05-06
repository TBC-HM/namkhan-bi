-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504194008
-- Name:    add_public_v_ota_uploads
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP VIEW IF EXISTS public.v_ota_uploads CASCADE;
CREATE VIEW public.v_ota_uploads AS
SELECT id, ota_source, file_kind, file_name, storage_path, snapshot_date, period_from, period_to, uploaded_by, uploaded_at, parser_version, status, row_counts, notes
FROM revenue.ota_uploads;
GRANT SELECT ON public.v_ota_uploads TO authenticated, anon, service_role;