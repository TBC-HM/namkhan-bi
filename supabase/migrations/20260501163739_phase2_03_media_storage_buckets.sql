-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501163739
-- Name:    phase2_03_media_storage_buckets
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Create 4 buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('media-raw',     'media-raw',     false, 524288000,
    ARRAY['image/jpeg','image/png','image/heic','image/heif','image/webp','image/x-canon-cr2','image/x-nikon-nef','image/x-sony-arw','image/x-adobe-dng']),
  ('media-master',  'media-master',  false, 524288000, NULL),
  ('media-renders', 'media-renders', true,  104857600, NULL),
  ('media-rejects', 'media-rejects', false, 524288000, NULL)
ON CONFLICT (id) DO NOTHING;

-- READ policies (private buckets: owner/gm only; public bucket: anyone)
CREATE POLICY "media_raw_read"     ON storage.objects FOR SELECT
  USING (bucket_id = 'media-raw'     AND app.is_top_level());
CREATE POLICY "media_master_read"  ON storage.objects FOR SELECT
  USING (bucket_id = 'media-master'  AND app.is_top_level());
CREATE POLICY "media_renders_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'media-renders');
CREATE POLICY "media_rejects_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'media-rejects' AND app.is_top_level());

-- WRITE policies — uploads to media-raw allowed for owner/gm via authenticated client.
-- Edge Functions use service_role and bypass RLS.
CREATE POLICY "media_raw_insert"   ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media-raw' AND app.is_top_level());
CREATE POLICY "media_raw_update"   ON storage.objects FOR UPDATE
  USING (bucket_id = 'media-raw' AND app.is_top_level())
  WITH CHECK (bucket_id = 'media-raw' AND app.is_top_level());
CREATE POLICY "media_raw_delete"   ON storage.objects FOR DELETE
  USING (bucket_id = 'media-raw' AND app.is_top_level());

-- master / renders / rejects: writes only via service_role (no policy needed for service_role)
-- but allow owner cleanup of renders + rejects:
CREATE POLICY "media_master_admin"  ON storage.objects FOR ALL
  USING (bucket_id = 'media-master'  AND app.is_top_level())
  WITH CHECK (bucket_id = 'media-master'  AND app.is_top_level());
CREATE POLICY "media_renders_admin" ON storage.objects FOR ALL
  USING (bucket_id = 'media-renders' AND app.is_top_level())
  WITH CHECK (bucket_id = 'media-renders' AND app.is_top_level());
CREATE POLICY "media_rejects_admin" ON storage.objects FOR ALL
  USING (bucket_id = 'media-rejects' AND app.is_top_level())
  WITH CHECK (bucket_id = 'media-rejects' AND app.is_top_level());
