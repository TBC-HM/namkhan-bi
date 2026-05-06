-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171640
-- Name:    b17_tighten_staff_photos_bucket_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B17: Tighten staff-photos bucket: restrict file size and MIME types
UPDATE storage.buckets
SET file_size_limit = 10485760,  -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
WHERE id = 'staff-photos';