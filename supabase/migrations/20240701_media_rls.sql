-- =============================================================================
-- Migration: 20240701_media_rls.sql
-- Ticket #114 — Explicit RLS policies for all four media storage buckets
-- Author: Code Carla (agent) — review required before production apply
--
-- ASSUMPTIONS (document in PR review):
--   A1. Workers authenticate via service_role JWT (bypasses RLS by default in
--       Supabase; explicit policies below still restrict anon + authenticated).
--   A2. "owner" is stored in storage.objects.owner (auth.uid() UUID) per
--       Supabase default — NOT a custom metadata field. Adjust predicate if
--       a custom metadata key is used instead.
--   A3. Rate-limit (100 uploads/hour) is implemented as an Edge Function
--       middleware check — NOT as a pg trigger — because RLS cannot count
--       per-user within a rolling window reliably. See rate_limit section below.
--   A4. Four buckets: media-raw, media-master, media-renders, media-rejects.
--       The triage summary mentioned "five buckets" in the subject but listed
--       four by name; add a fifth POLICY block if a fifth bucket is confirmed.
--   A5. RLS must be enabled on storage.objects (Supabase enables this by
--       default on hosted projects; verify with:
--         SELECT relrowsecurity FROM pg_class WHERE relname = 'objects';
--       before running this migration).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: media-raw
--   Intent: raw ingest uploads from authenticated users / worker (service_role)
--   Rules:
--     INSERT  — authenticated users may insert ONLY their own objects
--     SELECT  — authenticated users may read ONLY their own objects; anon denied
--     UPDATE  — denied for all non-service_role
--     DELETE  — denied for all non-service_role
-- ─────────────────────────────────────────────────────────────────────────────

-- INSERT: authenticated user can upload to their own path
CREATE POLICY "media-raw: authenticated insert own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-raw'
  AND auth.uid() = owner
);

-- SELECT: authenticated user can read their own objects only
CREATE POLICY "media-raw: authenticated select own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-raw'
  AND auth.uid() = owner
);

-- UPDATE: blocked for authenticated (service_role bypasses RLS)
CREATE POLICY "media-raw: deny authenticated update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (false);

-- DELETE: blocked for authenticated (service_role bypasses RLS)
CREATE POLICY "media-raw: deny authenticated delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (false);

-- Deny anon all access to media-raw
CREATE POLICY "media-raw: deny anon all"
ON storage.objects
FOR ALL
TO anon
USING (false)
WITH CHECK (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: media-master
--   Intent: processed master files written by ingest pipeline (service_role)
--   Rules:
--     INSERT  — service_role only (bypasses RLS; explicit deny for others)
--     SELECT  — authenticated users may read their own master objects
--     UPDATE  — denied for authenticated
--     DELETE  — denied for authenticated
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: authenticated user can read their own master objects
CREATE POLICY "media-master: authenticated select own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-master'
  AND auth.uid() = owner
);

-- INSERT: block authenticated users (pipeline writes as service_role)
CREATE POLICY "media-master: deny authenticated insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (false);

-- UPDATE: blocked for authenticated
CREATE POLICY "media-master: deny authenticated update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (false);

-- DELETE: blocked for authenticated
CREATE POLICY "media-master: deny authenticated delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (false);

-- Deny anon all access to media-master
CREATE POLICY "media-master: deny anon all"
ON storage.objects
FOR ALL
TO anon
USING (false)
WITH CHECK (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: media-renders
--   Intent: derived render outputs — read by authenticated owners; written by
--           pipeline (service_role)
--   Rules:
--     INSERT  — service_role only
--     SELECT  — authenticated users may read their own render objects
--     UPDATE  — denied for authenticated
--     DELETE  — denied for authenticated
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "media-renders: authenticated select own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-renders'
  AND auth.uid() = owner
);

CREATE POLICY "media-renders: deny authenticated insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "media-renders: deny authenticated update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "media-renders: deny authenticated delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (false);

-- Deny anon all access to media-renders
CREATE POLICY "media-renders: deny anon all"
ON storage.objects
FOR ALL
TO anon
USING (false)
WITH CHECK (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: media-rejects
--   Intent: quarantine bucket for failed/rejected ingest objects
--   Rules:
--     INSERT  — service_role only
--     SELECT  — authenticated users may read their own rejected objects
--     UPDATE  — denied for authenticated
--     DELETE  — denied for authenticated
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "media-rejects: authenticated select own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-rejects'
  AND auth.uid() = owner
);

CREATE POLICY "media-rejects: deny authenticated insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "media-rejects: deny authenticated update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "media-rejects: deny authenticated delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (false);

-- Deny anon all access to media-rejects
CREATE POLICY "media-rejects: deny anon all"
ON storage.objects
FOR ALL
TO anon
USING (false)
WITH CHECK (false);


-- =============================================================================
-- ACCEPTANCE TEST BLOCK
-- Run in staging Supabase SQL editor as each role to verify.
-- Expected results annotated inline.
-- =============================================================================

/*
-- ── As anon ──────────────────────────────────────────────────────────────────
-- All SELECT queries should return 0 rows (denied by anon policy)
SET ROLE anon;
SELECT count(*) FROM storage.objects WHERE bucket_id = 'media-raw';      -- expect: 0 (denied)
SELECT count(*) FROM storage.objects WHERE bucket_id = 'media-master';   -- expect: 0 (denied)
SELECT count(*) FROM storage.objects WHERE bucket_id = 'media-renders';  -- expect: 0 (denied)
SELECT count(*) FROM storage.objects WHERE bucket_id = 'media-rejects';  -- expect: 0 (denied)
RESET ROLE;

-- ── As authenticated (test user) ─────────────────────────────────────────────
-- SELECT on own objects should succeed; SELECT on other user objects should return 0 rows
-- INSERT on media-raw with own owner should succeed
-- INSERT on media-master/renders/rejects should fail (denied)
-- UPDATE / DELETE on any bucket should fail (denied)

-- (Run via Supabase anon key with user JWT to get auth.uid() populated)

-- ── As service_role ──────────────────────────────────────────────────────────
-- All operations bypass RLS — confirm pipeline can INSERT/UPDATE/DELETE freely
-- SELECT count(*) FROM storage.objects WHERE bucket_id = 'media-raw';   -- expect: actual row count
*/


-- =============================================================================
-- RATE-LIMIT GUARD (media-raw uploads, 100/hour per user)
-- Implemented as an Edge Function middleware — NOT as pg RLS.
-- Create supabase/functions/upload-guard/index.ts with the following logic:
--
--   1. Receive upload request with user JWT.
--   2. Query a counter table (see DDL below) for uploads in last 60 minutes.
--   3. If count >= 100 → return HTTP 429 Too Many Requests.
--   4. Otherwise → increment counter and proxy to storage API.
--
-- Counter table DDL (apply separately, not part of this migration):
-- =============================================================================

/*
CREATE TABLE IF NOT EXISTS public.upload_rate_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_id   text        NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX upload_rate_log_user_bucket_time
  ON public.upload_rate_log (user_id, bucket_id, uploaded_at DESC);
-- RLS: users can only insert/read their own rows
ALTER TABLE public.upload_rate_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upload_rate_log: insert own" ON public.upload_rate_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "upload_rate_log: select own" ON public.upload_rate_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
*/

-- =============================================================================
-- END OF MIGRATION
-- Apply via: supabase db push  OR  paste into Supabase dashboard SQL editor
-- Verify with: SELECT policyname, cmd, roles, qual, with_check
--              FROM pg_policies
--              WHERE tablename = 'objects'
--              ORDER BY policyname;
-- =============================================================================
