-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429220439
-- Name:    phase1_12_storage_bucket_policies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.12 — Storage bucket RLS policies
-- Tied to app.has_role / app.is_top_level helpers.
-- =====================================================================

-- Public buckets (documents-public, media, avatars, sop-visuals, branding)
-- Read = anyone (no policy needed since bucket public=true)
-- Write = authenticated only
DROP POLICY IF EXISTS "public_buckets_authenticated_write"     ON storage.objects;
DROP POLICY IF EXISTS "public_buckets_authenticated_update"    ON storage.objects;
DROP POLICY IF EXISTS "public_buckets_authenticated_delete"    ON storage.objects;

CREATE POLICY "public_buckets_authenticated_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('documents-public','media','avatars','sop-visuals','branding'));

CREATE POLICY "public_buckets_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('documents-public','media','avatars','sop-visuals','branding')
       AND (owner = auth.uid() OR app.is_top_level()))
WITH CHECK (bucket_id IN ('documents-public','media','avatars','sop-visuals','branding'));

CREATE POLICY "public_buckets_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('documents-public','media','avatars','sop-visuals','branding')
       AND (owner = auth.uid() OR app.is_top_level()));

-- documents-internal: any authenticated user can read; owner/top-level can write
DROP POLICY IF EXISTS "internal_read"   ON storage.objects;
DROP POLICY IF EXISTS "internal_write"  ON storage.objects;
DROP POLICY IF EXISTS "internal_modify" ON storage.objects;

CREATE POLICY "internal_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents-internal');

CREATE POLICY "internal_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents-internal');

CREATE POLICY "internal_modify"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents-internal' AND (owner = auth.uid() OR app.is_top_level()))
WITH CHECK (bucket_id = 'documents-internal');

-- documents-confidential: only owner/gm/hod/auditor can read; only owner/gm can write
DROP POLICY IF EXISTS "confidential_read"   ON storage.objects;
DROP POLICY IF EXISTS "confidential_write"  ON storage.objects;
DROP POLICY IF EXISTS "confidential_modify" ON storage.objects;
DROP POLICY IF EXISTS "confidential_delete" ON storage.objects;

CREATE POLICY "confidential_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents-confidential' 
       AND app.has_role(ARRAY['owner','gm','hod','auditor']));

CREATE POLICY "confidential_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents-confidential' AND app.is_top_level());

CREATE POLICY "confidential_modify"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents-confidential' AND app.is_top_level())
WITH CHECK (bucket_id = 'documents-confidential' AND app.is_top_level());

CREATE POLICY "confidential_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents-confidential' AND app.is_top_level());

-- documents-restricted: owner only, full
DROP POLICY IF EXISTS "restricted_owner" ON storage.objects;
CREATE POLICY "restricted_owner"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'documents-restricted' AND app.has_role(ARRAY['owner']))
WITH CHECK (bucket_id = 'documents-restricted' AND app.has_role(ARRAY['owner']));

-- dq-evidence: top-level + auditor read; top-level write
DROP POLICY IF EXISTS "dq_evidence_read"  ON storage.objects;
DROP POLICY IF EXISTS "dq_evidence_write" ON storage.objects;
CREATE POLICY "dq_evidence_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dq-evidence' AND app.has_role(ARRAY['owner','gm','auditor']));
CREATE POLICY "dq_evidence_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dq-evidence');

-- signatures: read top-level + signer; write top-level
DROP POLICY IF EXISTS "signatures_read"  ON storage.objects;
DROP POLICY IF EXISTS "signatures_write" ON storage.objects;
CREATE POLICY "signatures_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'signatures' AND (app.is_top_level() OR owner = auth.uid()));
CREATE POLICY "signatures_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'signatures' AND app.is_top_level());

-- Service role: full access on all buckets
DROP POLICY IF EXISTS "service_all" ON storage.objects;
CREATE POLICY "service_all"
ON storage.objects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Verify
SELECT count(*) AS storage_policies FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';