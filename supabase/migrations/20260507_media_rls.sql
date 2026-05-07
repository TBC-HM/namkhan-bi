-- =============================================================================
-- Migration: 20260507_media_rls.sql
-- Ticket #114 — Explicit RLS policies for all four media storage buckets
-- Author: Code Carla (agent) — review required before production apply
--
-- FIX (PBS review comment on PR #39):
--   Renamed from 20240701_media_rls.sql → 20260507_media_rls.sql
--   Old timestamp caused this migration to sort before bucket-creation
--   migrations, resulting in policy creation on non-existent buckets.
--   New timestamp (2026-05-07) ensures correct execution order.
--
-- ASSUMPTIONS (document in PR review):
-- A1. Workers authenticate via service_role JWT (bypasses RLS by default in
--     Supabase; explicit policies below still restrict anon + authenticated).
-- A2. "owner" is stored in storage.objects.owner (auth.uid() UUID) per
--     Supabase default — NOT a custom metadata field. Adjust predicate if
--     a custom metadata key is used instead.
-- A3. Rate-limit (100 uploads/hour) is implemented as an Edge Function
--     middleware check — NOT as a pg trigger — because RLS cannot count
--     per-user within a rolling window reliably.
-- A4. Four buckets: media-raw, media-master, media-renders, media-rejects.
--     The triage summary mentioned "five buckets" in the subject but listed
--     four by name; add a fifth POLICY block if a fifth bucket is confirmed.
-- A5. RLS must be enabled on storage.objects (Supabase enables this by
--     default on hosted projects; verify with:
--       SELECT relrowsecurity FROM pg_class WHERE relname = 'objects';
--     before running this migration).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: media-raw
-- Intent: raw ingest uploads from authenticated users / worker (service_role)
-- Rules:
--   INSERT — authenticated users may insert ONLY their own objects
--   SELECT — authenticated users may read ONLY their own objects; anon denied
--   UPDATE — denied for all non-service_role
--   DELETE — denied for all non-service_role
-- ─────────────────────────────────────────────────────────────────────────────

-- INSERT: authenticated user can upload to their own path
CREATE POLICY "media-raw: authenticated insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-raw'
  AND auth.uid() = owner
);

-- SELECT: authenticated user can read their own objects only
CREATE POLICY "media-raw: authenticated select own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-raw'
  AND auth.uid() = owner
);

-- UPDATE: blocked for authenticated (service_role bypasses RLS)
CREATE POLICY "media-raw: deny authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (false);

-- DELETE: blocked for authenticated (service_role bypasses RLS)
CREATE POLICY "media-raw: deny authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (false);

-- Deny anon all access to media-raw
CREATE POLICY "media-raw: deny anon all"
ON storage.objects FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: media-master
-- Intent: processed master files written by ingest pipeline (service_role)
-- Rules:
--   INSERT — service_role only (bypasses RLS; explicit deny for others)
--   SELECT — authenticated users may read their own master objects
--   UPDATE — denied for authenticated
--   DELETE — denied for authenticated
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: authenticated user can read their own master objects
CREATE POLICY "media-master: authenticated select own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-master'
  AND auth.uid() = owner
);

-- INSERT: block authenticated users (pipeline writes as service_role)
CREATE POLICY "media-master: deny authenticated insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (false);

-- UPDATE: blocked for authenticated
CREATE POLICY "media-master: deny authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (false);

-- DELETE: blocked for authenticated
CREATE POLICY "media-master: deny authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (false);

-- Deny anon all access to media-master
CREATE POLICY "media-master: deny anon all"
ON storage.objects FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: media-renders
-- Intent: derived render outputs — read by authenticated owners; written by
--         pipeline (service_role)
-- Rules:
--   INSERT — service_role only
--   SELECT — authenticated users may read their own render objects
--   UPDATE — denied for authenticated
--   DELETE — denied for authenticated
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "media-renders: authenticated select own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-renders'
  AND auth.uid() = owner
);

CREATE POLICY "media-renders: deny authenticated insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "media-renders: deny authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "media-renders: deny authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (false);

-- Deny anon all access to media-renders
CREATE POLICY "media-renders: deny anon all"
ON storage.objects FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: media-rejects
-- Intent: quarantine bucket for failed/rejected ingest objects
-- Rules:
--   INSERT — service_role only
--   SELECT — authenticated users may read their own rejected objects
--   UPDATE — denied for authenticated
--   DELETE — denied for authenticated
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "media-rejects: authenticated select own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-rejects'
  AND auth.uid() = owner
);

CREATE POLICY "media-rejects: deny authenticated insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "media-rejects: deny authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "media-rejects: deny authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (false);

-- Deny anon all access to media-rejects
CREATE POLICY "media-rejects: deny anon all"
ON storage.objects FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- =============================================================================
-- ACCEPTANCE TEST (run each block in staging SQL editor; confirm results)
-- =============================================================================
--
-- 1. Verify RLS is enabled on storage.objects:
--    SELECT relrowsecurity FROM pg_class WHERE relname = 'objects';
--    → Expected: true
--
-- 2. Verify all 20 policies exist:
--    SELECT policyname, cmd, roles, qual, with_check
--    FROM pg_policies
--    WHERE tablename = 'objects'
--    ORDER BY policyname;
--    → Expected: 20 rows (5 policies × 4 buckets)
--
-- 3. Test anon denied on media-raw:
--    SET ROLE anon;
--    SELECT count(*) FROM storage.objects WHERE bucket_id = 'media-raw';
--    → Expected: 0 rows (policy blocks visibility)
--
-- 4. Test authenticated can only see own objects:
--    SET ROLE authenticated;
--    SET request.jwt.claim.sub = '<your-test-uuid>';
--    SELECT count(*) FROM storage.objects
--    WHERE bucket_id = 'media-raw' AND owner != '<your-test-uuid>'::uuid;
--    → Expected: 0 rows
--
-- =============================================================================
-- NOTE: The old migration file (20240701_media_rls.sql) must be removed from
-- the branch — it will cause duplicate policy errors if both files are applied.
-- Delete it via: git rm supabase/migrations/20240701_media_rls.sql
-- =============================================================================
