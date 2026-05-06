-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429215635
-- Name:    phase1_12_storage_bucket_policies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.12 — Storage bucket RLS policies
-- Tightens access by sensitivity tier.
-- =====================================================================

-- Drop any existing policies on storage.objects (clean slate)
DO $$
DECLARE p text;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', p);
  END LOOP;
END$$;

-- ---------------------------------------------------------------------
-- PUBLIC BUCKETS — anyone can read, owner/gm/dept can write
-- ---------------------------------------------------------------------
CREATE POLICY "public_buckets_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('documents-public','media','avatars','sop-visuals','branding'));

CREATE POLICY "public_buckets_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('documents-public','media','avatars','sop-visuals','branding')
    AND (app.is_top_level() OR auth.uid() = owner)
  )
  WITH CHECK (
    bucket_id IN ('documents-public','media','avatars','sop-visuals','branding')
    AND (app.is_top_level() OR auth.uid() = owner)
  );

-- ---------------------------------------------------------------------
-- INTERNAL — any authenticated user reads + uploads, owner/gm full
-- ---------------------------------------------------------------------
CREATE POLICY "internal_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents-internal');

CREATE POLICY "internal_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents-internal');

CREATE POLICY "internal_update_delete" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents-internal' AND (app.is_top_level() OR auth.uid() = owner))
  WITH CHECK (bucket_id = 'documents-internal' AND (app.is_top_level() OR auth.uid() = owner));

CREATE POLICY "internal_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents-internal' AND (app.is_top_level() OR auth.uid() = owner));

-- ---------------------------------------------------------------------
-- CONFIDENTIAL — owner/gm/hod/auditor read; owner/gm write
-- ---------------------------------------------------------------------
CREATE POLICY "confidential_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('documents-confidential','dq-evidence','signatures')
    AND app.has_role(ARRAY['owner','gm','hod','auditor'])
  );

CREATE POLICY "confidential_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('documents-confidential','dq-evidence','signatures')
    AND app.is_top_level()
  )
  WITH CHECK (
    bucket_id IN ('documents-confidential','dq-evidence','signatures')
    AND app.is_top_level()
  );

-- ---------------------------------------------------------------------
-- RESTRICTED — owner only
-- ---------------------------------------------------------------------
CREATE POLICY "restricted_owner_only" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'documents-restricted'
    AND app.has_role(ARRAY['owner'])
  )
  WITH CHECK (
    bucket_id = 'documents-restricted'
    AND app.has_role(ARRAY['owner'])
  );

-- Verify
SELECT bucket_id, count(*) AS policies
FROM (
  SELECT unnest(string_to_array(replace(replace(replace(replace(replace(qual::text,'(',''),')',''),'''',''),'bucket_id = ',''),'bucket_id IN ',''), ',')) AS bucket_id
  FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
) x WHERE bucket_id LIKE '%documents%' OR bucket_id LIKE '%media%' OR bucket_id LIKE '%avatar%' OR bucket_id LIKE '%sop%' OR bucket_id LIKE '%dq%' OR bucket_id LIKE '%sign%' OR bucket_id LIKE '%brand%'
GROUP BY bucket_id ORDER BY bucket_id;