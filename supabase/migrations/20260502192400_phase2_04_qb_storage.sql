-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502192400
-- Name:    phase2_04_qb_storage
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('qb_uploads', 'qb_uploads', false, 52428800,
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel','text/csv','application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "qb_uploads_list_owner_finance" ON storage.objects;
DROP POLICY IF EXISTS "qb_uploads_insert_owner_finance" ON storage.objects;

CREATE POLICY "qb_uploads_list_owner_finance"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'qb_uploads' AND auth.jwt() ->> 'role' IN ('owner','gm','finance','admin'));

CREATE POLICY "qb_uploads_insert_owner_finance"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qb_uploads' AND auth.jwt() ->> 'role' IN ('owner','gm','finance','admin'));