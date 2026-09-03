-- db/proposed/social-push-cron-v1/migration.sql
-- PBS approval required before applying via Supabase MCP apply_migration.
--
-- Adds:
--   1. fn_social_program_upsert — create/update a social program without direct
--      table access from the app layer (mirrors fn_social_slot_upsert pattern)
--   2. fn_social_program_delete — soft-delete (active=false)
--   3. pg_cron job: social-push-due — every 5 min, calls the cron API route
--      to push scheduled posts whose scheduled_at <= now()
--
-- Prereqs:
--   - CRON_SECRET set in Vercel env and as pg_settings:
--       ALTER DATABASE postgres SET app.cron_secret = '<secret>';
--   - Site URL set:
--       ALTER DATABASE postgres SET app.site_url = 'https://namkhan-bi.vercel.app';
--   - pg_cron extension enabled (already is)
--   - pg_net extension enabled (check: SELECT * FROM pg_extension WHERE extname='pg_net')

-- ── 1. fn_social_program_upsert ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_social_program_upsert(
  p_property_id  bigint,
  p_platform     text,
  p_category_code text,
  p_label        text,
  p_weekday_slots int[],
  p_posts_per_week int,
  p_notes        text    DEFAULT NULL,
  p_active       boolean DEFAULT true,
  p_id           bigint  DEFAULT NULL   -- pass to UPDATE existing
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marketing', 'public'
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE marketing.social_programs SET
      category_code    = p_category_code,
      label            = p_label,
      weekday_slots    = p_weekday_slots,
      posts_per_week   = p_posts_per_week,
      notes            = p_notes,
      active           = p_active,
      updated_at       = now()
    WHERE id = p_id AND property_id = p_property_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO marketing.social_programs
      (property_id, platform, category_code, label, weekday_slots, posts_per_week, notes, active)
    VALUES
      (p_property_id, p_platform, p_category_code, p_label, p_weekday_slots, p_posts_per_week, p_notes, p_active)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.fn_social_program_upsert(bigint,text,text,text,int[],int,text,boolean,bigint) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_social_program_upsert(bigint,text,text,text,int[],int,text,boolean,bigint) TO authenticated, service_role;

-- ── 2. fn_social_program_delete ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_social_program_delete(
  p_property_id bigint,
  p_id          bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marketing', 'public'
AS $$
BEGIN
  UPDATE marketing.social_programs
  SET active = false, updated_at = now()
  WHERE id = p_id AND property_id = p_property_id;
END $$;

REVOKE ALL ON FUNCTION public.fn_social_program_delete(bigint, bigint) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_social_program_delete(bigint, bigint) TO authenticated, service_role;

-- ── 3. pg_cron: social-push-due ──────────────────────────────────────────────
-- Runs every 5 min. Calls /api/cron/social-push to push posts whose
-- scheduled_at has arrived. Set app.cron_secret + app.site_url first (above).

SELECT cron.schedule(
  'social-push-due',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url     := current_setting('app.site_url') || '/api/cron/social-push',
    headers := jsonb_build_object('x-cron-secret', current_setting('app.cron_secret'))
  )
  $$
);
