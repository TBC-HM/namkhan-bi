-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504224600
-- Name:    marketing_classify_tier
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Tier Classifier — refines primary_tier with rule-based logic on top of AI's choice.
-- Runs as a function so it can be called manually for backfill or by trigger after tagging.

CREATE OR REPLACE FUNCTION marketing.classify_tier(p_asset_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $func$
DECLARE
  v_qc INT;
  v_brand_fit NUMERIC;
  v_width INT;
  v_height INT;
  v_has_no_people BOOLEAN;
  v_is_logo BOOLEAN;
  v_has_room_subject BOOLEAN;
  v_has_environment_style BOOLEAN;
  v_has_golden_hour BOOLEAN;
  v_orientation TEXT;
  v_aspect NUMERIC;
  v_tier TEXT;
BEGIN
  SELECT
    COALESCE(qc_score, 0),
    COALESCE(ai_confidence, 0) * 100,
    COALESCE(width_px, 0),
    COALESCE(height_px, 0)
  INTO v_qc, v_brand_fit, v_width, v_height
  FROM marketing.media_assets WHERE asset_id = p_asset_id;

  IF v_width IS NULL OR v_width = 0 THEN RETURN 'tier_internal'; END IF;
  v_aspect := v_width::numeric / v_height::numeric;
  v_orientation := CASE
    WHEN v_aspect > 1.2 THEN 'landscape'
    WHEN v_aspect < 0.85 THEN 'portrait'
    ELSE 'square' END;

  -- Has tag flags
  SELECT EXISTS(SELECT 1 FROM marketing.media_tags mt JOIN marketing.media_taxonomy tx ON tx.tag_id = mt.tag_id WHERE mt.asset_id = p_asset_id AND tx.tag_slug = 'no_people')
    INTO v_has_no_people;
  SELECT EXISTS(SELECT 1 FROM marketing.media_tags mt JOIN marketing.media_taxonomy tx ON tx.tag_id = mt.tag_id WHERE mt.asset_id = p_asset_id AND tx.category = 'room_type')
    INTO v_has_room_subject;
  SELECT EXISTS(SELECT 1 FROM marketing.media_tags mt JOIN marketing.media_taxonomy tx ON tx.tag_id = mt.tag_id WHERE mt.asset_id = p_asset_id AND tx.tag_slug IN ('wide_environmental','editorial','drone_aerial_style'))
    INTO v_has_environment_style;
  SELECT EXISTS(SELECT 1 FROM marketing.media_tags mt JOIN marketing.media_taxonomy tx ON tx.tag_id = mt.tag_id WHERE mt.asset_id = p_asset_id AND tx.tag_slug IN ('golden_hour_morning','golden_hour_evening','sunrise','sunset','blue_hour'))
    INTO v_has_golden_hour;

  -- Logo override (caption / alt-text contain 'logo' or 'wordmark') — defensive
  v_is_logo := FALSE;
  SELECT TRUE INTO v_is_logo FROM marketing.media_assets
    WHERE asset_id = p_asset_id
      AND (LOWER(COALESCE(caption,'')) ~ '(logo|wordmark|crest|mark)'
        OR LOWER(COALESCE(alt_text,'')) ~ '(logo|wordmark|crest|mark)'
        OR LOWER(COALESCE(original_filename,'')) ~ '(logo|nke-)'
      );

  IF v_is_logo THEN
    v_tier := 'tier_archive';
  -- Website hero: strict — only the absolute best wide environmental shots
  ELSIF v_qc >= 80 AND v_brand_fit >= 80 AND v_orientation = 'landscape'
        AND (v_has_environment_style OR v_has_golden_hour) THEN
    v_tier := 'tier_website_hero';
  -- OTA: clear, room/property feature, no people, decent quality
  ELSIF v_qc >= 70 AND v_orientation = 'landscape'
        AND v_has_no_people
        AND (v_has_room_subject OR v_has_environment_style) THEN
    v_tier := 'tier_ota_profile';
  -- Social pool: brand-safe with story
  ELSIF v_brand_fit >= 60 AND v_qc >= 50 THEN
    v_tier := 'tier_social_pool';
  -- Internal: low qc or unclear
  ELSE
    v_tier := 'tier_internal';
  END IF;

  RETURN v_tier;
END;
$func$;

-- Bulk reclassify helper
CREATE OR REPLACE FUNCTION marketing.reclassify_all_tiers()
RETURNS TABLE (asset_id UUID, old_tier TEXT, new_tier TEXT, changed BOOLEAN)
LANGUAGE plpgsql AS $func$
DECLARE
  rec RECORD;
  v_new TEXT;
BEGIN
  FOR rec IN
    SELECT a.asset_id, a.primary_tier::text AS old_tier
    FROM marketing.media_assets a
    WHERE a.status = 'ready' AND a.qc_score IS NOT NULL
  LOOP
    v_new := marketing.classify_tier(rec.asset_id);
    IF v_new IS DISTINCT FROM rec.old_tier THEN
      UPDATE marketing.media_assets
        SET primary_tier = v_new::marketing.usage_tier
        WHERE marketing.media_assets.asset_id = rec.asset_id;
    END IF;
    asset_id := rec.asset_id;
    old_tier := rec.old_tier;
    new_tier := v_new;
    changed := (v_new IS DISTINCT FROM rec.old_tier);
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$func$;