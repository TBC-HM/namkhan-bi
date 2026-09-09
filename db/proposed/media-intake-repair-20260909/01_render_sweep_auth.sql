-- ============================================================================
-- ITEM 1 · Media render/polish sweep auth repair        PBS-approved 2026-09-09
-- ============================================================================
-- PROVEN, not hypothesised. media-render-web has verify_jwt=true since its
-- 2026-07-29 18:21 redeploy. The sweeps sent only 'apikey', no 'Authorization'.
--   control probe  req 1970 -> 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER"}
--   fixed   probe  req 1969 -> 200 {"ok":true,"rendered":1,...,"renders":3}
-- Last successful render before the probe: 2026-07-29 18:38 (42 days).
-- cron 145/146 reported "succeeded" 96x/day throughout.
--
-- Auth pattern copied verbatim from the proven in-estate caller
--   public.fn_website_archive_media -> website-media-archive (also verify_jwt=true).
-- Signatures unchanged, so cron 145/146 need no edit (create forward, memory 882).
--
-- Second defect fixed: render_attempts was incremented BEFORE the HTTP call while
-- the selection predicate excludes >=3, so a broken endpoint permanently retired
-- 4 assets per cycle. 3,115 assets (2,560 Donna + 555 Namkhan) are already dead.
-- The increment now happens only after pg_net accepts the request.
-- RESIDUAL GAP (stated, not hidden): this still burns an attempt on a 401, because
-- pg_net responses land after commit. It protects against a dead pg_net, not a
-- rejecting endpoint. A reconciler that reads net._http_response and refunds
-- attempts on 4xx/5xx is a separate brief.

CREATE OR REPLACE FUNCTION public.fn_render_next_batch(p_n integer DEFAULT 5)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'media', 'marketing'
AS $function$
DECLARE v_items jsonb; v_ids uuid[]; v_req bigint; v_key text; v_url text;
BEGIN
  v_key := public.fn_read_vault_secret('SUPABASE_SERVICE_ROLE_KEY_FALLBACK');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'fn_render_next_batch: SUPABASE_SERVICE_ROLE_KEY_FALLBACK missing from vault';
  END IF;
  v_url := COALESCE(public.fn_read_vault_secret('SUPABASE_PROJECT_URL'),
                    'https://kpenyneooigsyuuomgct.supabase.co');

  SELECT array_agg(asset_id), jsonb_agg(jsonb_build_object('asset_id',asset_id,'raw_path',raw_path))
    INTO v_ids, v_items
  FROM (
    SELECT m.asset_id, m.raw_path FROM media.media_assets m
    WHERE m.status::text='ready' AND m.asset_type::text='photo' AND m.raw_path IS NOT NULL
      AND m.mime_type IN ('image/jpeg','image/png')
      AND COALESCE(m.render_attempts,0) < 3
      AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='media-raw' AND o.name=m.raw_path)
      AND NOT EXISTS(SELECT 1 FROM media.media_renders r WHERE r.asset_id=m.asset_id AND r.render_purpose='web_2k')
    ORDER BY m.quality_index DESC NULLS LAST LIMIT p_n) q;
  IF v_ids IS NULL THEN RETURN NULL; END IF;

  SELECT net.http_post(
    url:= v_url || '/functions/v1/media-render-web',
    headers:=jsonb_build_object('Content-Type','application/json',
      'apikey', v_key, 'Authorization', 'Bearer ' || v_key),
    body:=jsonb_build_object('assets',v_items), timeout_milliseconds:=90000) INTO v_req;

  IF v_req IS NOT NULL THEN
    UPDATE media.media_assets SET render_attempts=COALESCE(render_attempts,0)+1
    WHERE asset_id = ANY(v_ids);
  END IF;
  RETURN v_req;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_polish_next_batch(p_n integer DEFAULT 2)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'media', 'marketing'
AS $function$
DECLARE v_ids uuid[]; v_req bigint; v_key text; v_url text;
BEGIN
  v_key := public.fn_read_vault_secret('SUPABASE_SERVICE_ROLE_KEY_FALLBACK');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'fn_polish_next_batch: SUPABASE_SERVICE_ROLE_KEY_FALLBACK missing from vault';
  END IF;
  v_url := COALESCE(public.fn_read_vault_secret('SUPABASE_PROJECT_URL'),
                    'https://kpenyneooigsyuuomgct.supabase.co');

  SELECT array_agg(asset_id) INTO v_ids FROM (
    SELECT m.asset_id FROM media.media_assets m
    WHERE m.status::text='ready' AND m.asset_type::text='photo' AND m.polished_at IS NULL
      AND EXISTS(SELECT 1 FROM media.media_renders r WHERE r.asset_id=m.asset_id AND r.render_purpose='web_2k')
    ORDER BY m.quality_index DESC NULLS LAST LIMIT p_n) q;
  IF v_ids IS NULL THEN RETURN NULL; END IF;

  SELECT net.http_post(
    url:= v_url || '/functions/v1/media-polish',
    headers:=jsonb_build_object('Content-Type','application/json',
      'apikey', v_key, 'Authorization', 'Bearer ' || v_key),
    body:=jsonb_build_object('max',p_n,'asset_ids',to_jsonb(v_ids)),
    timeout_milliseconds:=90000) INTO v_req;
  RETURN v_req;
END $function$;

REVOKE ALL ON FUNCTION public.fn_render_next_batch(integer) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.fn_polish_next_batch(integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_render_next_batch(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_polish_next_batch(integer) TO authenticated, service_role;
