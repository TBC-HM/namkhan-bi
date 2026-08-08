-- website-module-v1 CMS-3b: Fix translation functions
-- GHA build website-module-v1-slice-cms3-ui
-- Issues fixed:
-- 1. fn_website_upsert_translation: wrong audit log table name and constraint handling
-- 2. fn_generate_sitedata: missing 'en' locale and section translation joins

-- Fix 1: fn_website_upsert_translation
CREATE OR REPLACE FUNCTION public.fn_website_upsert_translation(
  p_page_id bigint,
  p_section_id bigint DEFAULT NULL,
  p_property_id integer DEFAULT NULL,
  p_locale text DEFAULT 'lo',
  p_fields jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'draft',
  p_translated_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'website'
AS $function$
DECLARE
  v_property_id INTEGER;
  v_translation_id BIGINT;
  v_result JSONB;
  v_existing_id BIGINT;
  v_insert_page_id BIGINT;
  v_insert_section_id BIGINT;
BEGIN
  -- Resolve property_id
  v_property_id := COALESCE(
    p_property_id,
    current_setting('app.current_property_id', TRUE)::INTEGER
  );
  
  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'property_id required';
  END IF;
  
  -- Determine which ID to use (exclusive: page XOR section)
  -- The translations table has a CHECK constraint requiring EITHER page_id OR section_id, not both
  IF p_section_id IS NOT NULL THEN
    v_insert_page_id := NULL;
    v_insert_section_id := p_section_id;
  ELSE
    v_insert_page_id := p_page_id;
    v_insert_section_id := NULL;
  END IF;
  
  -- Check for existing translation
  SELECT translation_id INTO v_existing_id
  FROM website.translations
  WHERE locale = p_locale
    AND (
      (page_id = v_insert_page_id AND section_id IS NULL) OR
      (section_id = v_insert_section_id AND page_id IS NULL)
    );
  
  IF v_existing_id IS NOT NULL THEN
    -- Update existing
    UPDATE website.translations SET
      fields = p_fields,
      status = p_status,
      translated_by = p_translated_by,
      translated_at = NOW(),
      updated_at = NOW()
    WHERE translation_id = v_existing_id
    RETURNING translation_id INTO v_translation_id;
  ELSE
    -- Insert new
    INSERT INTO website.translations (
      page_id,
      section_id,
      property_id,
      locale,
      fields,
      status,
      translated_by,
      translated_at
    ) VALUES (
      v_insert_page_id,
      v_insert_section_id,
      v_property_id,
      p_locale,
      p_fields,
      p_status,
      p_translated_by,
      NOW()
    )
    RETURNING translation_id INTO v_translation_id;
  END IF;
  
  -- Audit (corrected table and column names for aud_audit_log)
  INSERT INTO cockpit.aud_audit_log (
    agent,
    action,
    target,
    metadata,
    success
  ) VALUES (
    COALESCE(p_translated_by, 'system'),
    'website_upsert_translation',
    'website.translations',
    jsonb_build_object(
      'translation_id', v_translation_id,
      'page_id', p_page_id,
      'section_id', p_section_id,
      'locale', p_locale,
      'property_id', v_property_id,
      'status', p_status,
      'operation', CASE WHEN v_existing_id IS NOT NULL THEN 'update' ELSE 'insert' END
    ),
    TRUE
  );
  
  v_result := jsonb_build_object(
    'ok', TRUE,
    'translation_id', v_translation_id
  );
  
  RETURN v_result;
END;
$function$;

-- Fix 2: fn_generate_sitedata
CREATE OR REPLACE FUNCTION website.fn_generate_sitedata(p_property_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'website', 'property'
AS $function$
  SELECT jsonb_build_object(
    'site', (SELECT to_jsonb(s) - 'deploy_hook_key' FROM website.sites s WHERE s.property_id = p_property_id),
    'settings', (SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) FROM website.site_settings WHERE property_id = p_property_id),
    'pages', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'title', p.title, 'kind', p.page_kind, 'meta', p.meta,
        'nav_order', p.nav_order, 'in_main_nav', p.in_main_nav,
        'room', CASE WHEN p.room_type_id IS NOT NULL THEN
          (SELECT jsonb_build_object('room_type_id', r.room_type_id, 'display_name', r.display_name,
             'short_pitch', r.short_pitch, 'long_description', r.long_description, 'size_sqm', r.size_sqm,
             'view_type', r.view_type, 'bed_config', r.bed_config, 'max_occupancy', r.max_occupancy,
             'amenities', r.amenities, 'hero_image_url', r.hero_image_url, 'gallery_urls', r.gallery_urls)
           FROM property.rooms r WHERE r.room_type_id = p.room_type_id AND r.property_id = p.property_id)
          ELSE NULL END,
        'sections', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'kind', sec.kind, 'heading', sec.heading, 'body_md', sec.body_md, 'data', sec.data)
            ORDER BY sec.sort_order), '[]'::jsonb)
          FROM website.sections sec WHERE sec.page_id = p.id),
        'translations', (SELECT coalesce(jsonb_object_agg(
            t.locale,
            jsonb_build_object(
              'page', (SELECT fields FROM website.translations WHERE page_id = p.id AND locale = t.locale AND section_id IS NULL AND status = 'published' LIMIT 1),
              'sections', (SELECT coalesce(jsonb_object_agg(
                  t2.section_id::text,
                  t2.fields
                ), '{}'::jsonb)
                FROM website.translations t2
                INNER JOIN website.sections sec ON sec.id = t2.section_id
                WHERE sec.page_id = p.id AND t2.locale = t.locale AND t2.section_id IS NOT NULL AND t2.status = 'published')
            )
          ), '{}'::jsonb)
          FROM (
            SELECT DISTINCT locale FROM website.translations WHERE page_id = p.id AND status = 'published'
            UNION
            SELECT DISTINCT t3.locale FROM website.translations t3
            INNER JOIN website.sections sec2 ON sec2.id = t3.section_id
            WHERE sec2.page_id = p.id AND t3.status = 'published'
          ) t),
        'images', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'src', m.src_url, 'alt', m.alt, 'role', m.role, 'storage_path', m.storage_path)), '[]'::jsonb)
          FROM website.media_manifest m WHERE m.page_id = p.id)
      ) ORDER BY p.nav_order NULLS LAST, p.slug), '[]'::jsonb)
      FROM website.pages p WHERE p.property_id = p_property_id AND p.status <> 'retired'),
    'redirects', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'from', from_path, 'to', to_path, 'status', http_status)), '[]'::jsonb)
      FROM website.redirects WHERE property_id = p_property_id),
    'locales', (
      SELECT jsonb_agg(DISTINCT locale ORDER BY locale)
      FROM (
        SELECT 'en'::text as locale
        UNION
        SELECT DISTINCT locale FROM website.translations WHERE property_id = p_property_id AND status = 'published'
      ) locales_union
    ),
    'generated_at', now()
  );
$function$;