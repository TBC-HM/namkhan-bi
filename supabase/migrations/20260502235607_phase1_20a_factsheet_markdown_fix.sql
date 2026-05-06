-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502235607
-- Name:    phase1_20a_factsheet_markdown_fix
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE FUNCTION marketing.f_factsheet_markdown(p_property_id bigint DEFAULT 260955)
RETURNS text
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v jsonb;
  out text := '';
  r jsonb;
  k text;
  vv jsonb;
BEGIN
  SELECT to_jsonb(f.*) INTO v FROM marketing.v_namkhan_factsheet f WHERE property_id = p_property_id;
  IF v IS NULL THEN RETURN '# No factsheet found for property '||p_property_id; END IF;

  out := out || '# ' || COALESCE(v->'identity'->>'trading_name', 'The Namkhan') || ' — Sales Factsheet' || E'\n\n';
  out := out || '_Auto-generated · Last profile update: '||(v->>'profile_updated_at')||'_' || E'\n\n';

  -- IDENTITY
  out := out || '## Identity' || E'\n';
  out := out || '- **Name:** ' || COALESCE(v->'identity'->>'trading_name','') || E'\n';
  out := out || '- **Legal:** ' || COALESCE(v->'identity'->>'legal_name','') || E'\n';
  out := out || '- **Category:** ' || COALESCE(v->'identity'->>'category','') || ' · ' || COALESCE((v->'identity'->>'star_rating'),'5') || '★' || E'\n';
  IF v->'identity'->'taglines' IS NOT NULL THEN
    out := out || '- **Taglines:** ' || array_to_string(ARRAY(SELECT jsonb_array_elements_text(v->'identity'->'taglines')), ' · ') || E'\n';
  END IF;
  out := out || E'\n' || COALESCE(v->'identity'->>'short_description','') || E'\n\n';

  -- LOCATION
  out := out || '## Location & Access' || E'\n';
  out := out || '- **Address:** '||COALESCE(v->'location'->>'village','')||', '||COALESCE(v->'location'->>'city','')||', '||COALESCE(v->'location'->>'country','') || E'\n';
  out := out || '- **GPS:** '||COALESCE(v->'location'->>'latitude','')||', '||COALESCE(v->'location'->>'longitude','') || E'\n';
  out := out || '- **Airport:** '||COALESCE(v->'location'->>'airport_km','')||' km · '||COALESCE(v->'location'->>'airport_min','')||' min' || E'\n';
  out := out || '- **Train:** '||COALESCE(v->'location'->>'train_km','')||' km · '||COALESCE(v->'location'->>'train_min','')||' min' || E'\n';
  out := out || '- **Climate:** '||COALESCE(v->'location'->>'climate_summary','') || E'\n';
  IF (v->'location'->>'shuttle_available')::boolean IS TRUE THEN
    out := out || '- **Shuttle:** '||COALESCE(v->'location'->>'shuttle_description','') || E'\n';
  END IF;
  out := out || E'\n';

  -- CAPACITY
  out := out || '## Capacity' || E'\n';
  out := out || '- **Total keys:** '||(v->'capacity'->>'rooms_total')||' · **Selling:** '||(v->'capacity'->>'rooms_selling')||' · **Room types:** '||(v->'capacity'->>'room_types_count') || E'\n\n';

  -- CONTACTS
  out := out || '## Contact' || E'\n';
  IF v->'contacts' IS NOT NULL THEN
    FOR r IN SELECT * FROM jsonb_array_elements(v->'contacts') LOOP
      out := out || '- **'||COALESCE(r->>'label', r->>'kind')||':** '||COALESCE(r->>'value','') || E'\n';
    END LOOP;
  END IF;
  out := out || '- **Web:** '||COALESCE(v->'web'->>'website','')||' · **Booking engine:** '||COALESCE(v->'web'->>'booking_engine','') || E'\n\n';

  -- USPs
  out := out || '## Why The Namkhan' || E'\n';
  IF v->'identity'->'usps' IS NOT NULL THEN
    FOR k IN SELECT jsonb_array_elements_text(v->'identity'->'usps') LOOP
      out := out || '- ' || k || E'\n';
    END LOOP;
  END IF;
  out := out || E'\n';

  -- CERTIFICATIONS
  out := out || '## Certifications' || E'\n';
  IF v->'certifications' IS NOT NULL THEN
    FOR r IN SELECT * FROM jsonb_array_elements(v->'certifications') LOOP
      out := out || '- '||COALESCE(r->>'body','')||' — '||COALESCE(r->>'name','')||COALESCE(' ('||(r->>'level')||')','') || E'\n';
    END LOOP;
  END IF;
  out := out || E'\n';

  -- ROOMS
  out := out || '## Rooms (' || (v->'capacity'->>'room_types_count') || ' types)' || E'\n';
  out := out || '| Room | Size | Units | Max | Tier | Pitch |' || E'\n';
  out := out || '|---|---|---:|---:|---|---|' || E'\n';
  IF v->'rooms' IS NOT NULL THEN
    FOR r IN SELECT * FROM jsonb_array_elements(v->'rooms') LOOP
      out := out || '| '||COALESCE(r->>'name','')
                 || ' | '||COALESCE(r->>'size_sqm','')||' m²'||COALESCE(' + '||(r->>'garden_sqm')||' m²','')
                 || ' | '||COALESCE(r->>'units','')
                 || ' | '||COALESCE(r->>'max_occupancy','')
                 || ' | '||COALESCE(r->>'tier','')
                 || ' | '||COALESCE(r->>'short_pitch','')
                 || ' |' || E'\n';
    END LOOP;
  END IF;
  out := out || E'\n';

  -- FACILITIES (fix: jsonb_each returns key/value as columns)
  out := out || '## Facilities' || E'\n';
  IF v->'facilities' IS NOT NULL THEN
    FOR k, vv IN SELECT key, value FROM jsonb_each(v->'facilities') LOOP
      out := out || '- **'||initcap(k)||':** '||
        (SELECT string_agg(item->>'name', ' · ')
         FROM jsonb_array_elements(vv) AS item) || E'\n';
    END LOOP;
  END IF;
  out := out || E'\n';

  -- ACTIVITIES
  out := out || '## Activities' || E'\n';
  IF v->'activities' IS NOT NULL THEN
    FOR k, vv IN SELECT key, value FROM jsonb_each(v->'activities') LOOP
      out := out || '- **'||initcap(k)||':** '||
        (SELECT string_agg(item->>'name', ' · ')
         FROM jsonb_array_elements(vv) AS item) || E'\n';
    END LOOP;
  END IF;
  out := out || E'\n';

  -- RETREATS
  out := out || '## Retreats' || E'\n';
  IF v->'retreats' IS NOT NULL THEN
    FOR r IN SELECT * FROM jsonb_array_elements(v->'retreats') LOOP
      out := out || '### '||COALESCE(r->>'name','') || E'\n';
      out := out || '_'||COALESCE(r->>'short_pitch','')||'_' || E'\n';
      out := out || '- **Stay:** '||COALESCE(r->>'min_nights','2')||'–'||COALESCE(r->>'max_nights','6')||' nights · **Min age:** '||COALESCE(r->>'min_age','16') || E'\n';
      out := out || '- **Eligible rooms:** '||
        COALESCE((SELECT string_agg(t::text, ', ') FROM jsonb_array_elements_text(r->'eligible_rooms') t),'') || E'\n';
      out := out || '- **Pricing ('||COALESCE(r->>'pricing_basis','per person/night')||', USD):**' || E'\n';
      out := out || '| Tier | Audience | High | Green |' || E'\n';
      out := out || '|---|---|---:|---:|' || E'\n';
      out := out ||
        (SELECT string_agg(
           '| '||tier||' | '||audience||' | $'||high_p||' | $'||green_p||' |',
           E'\n')
         FROM (
           SELECT
             p->>'tier' AS tier,
             p->>'audience' AS audience,
             max(CASE WHEN p->>'season'='high'  THEN p->>'price_usd' END) AS high_p,
             max(CASE WHEN p->>'season'='green' THEN p->>'price_usd' END) AS green_p
           FROM jsonb_array_elements(r->'pricing') p
           GROUP BY p->>'tier', p->>'audience'
           ORDER BY p->>'tier', p->>'audience'
         ) px) || E'\n\n';
    END LOOP;
  END IF;

  -- MEETINGS
  out := out || '## Meetings & Events' || E'\n';
  out := out || '| Room | Pax | Half day | Full day |' || E'\n';
  out := out || '|---|---|---:|---:|' || E'\n';
  IF v->'meetings'->'rooms' IS NOT NULL THEN
    FOR r IN SELECT * FROM jsonb_array_elements(v->'meetings'->'rooms') LOOP
      out := out || '| '||COALESCE(r->>'name','')
                 || ' | '||COALESCE(r->>'capacity_min','')||'–'||COALESCE(r->>'capacity_max','')
                 || ' | $' || COALESCE((SELECT p->>'price_usd' FROM jsonb_array_elements(v->'meetings'->'packages') p
                                        WHERE p->>'type'='room_rental' AND p->>'room_code'=r->>'code' AND (p->>'duration_hours')='4'),'')
                 || ' | $' || COALESCE((SELECT p->>'price_usd' FROM jsonb_array_elements(v->'meetings'->'packages') p
                                        WHERE p->>'type'='room_rental' AND p->>'room_code'=r->>'code' AND (p->>'duration_hours')='8'),'')
                 || ' |' || E'\n';
    END LOOP;
  END IF;
  out := out || E'\n';

  -- POLICIES
  out := out || '## Booking Terms' || E'\n';
  out := out || '- **Min stay (recommended):** '||COALESCE(v->'policies'->>'min_nights_recommended','3')||' nights' || E'\n';
  out := out || '- **Guest details required within:** '||COALESCE(v->'policies'->>'guest_details_deadline_days','10')||' days of confirmation' || E'\n';
  out := out || '- **FIT payment:** '||COALESCE(v->'policies'->>'fit_payment','') || E'\n';
  out := out || '- **Group payment:** '||COALESCE(v->'policies'->>'group_payment','') || E'\n';
  out := out || '- **Cancellation:** '||COALESCE(v->'policies'->>'cancellation','') || E'\n';
  out := out || '- **No-show / early departure:** '||COALESCE(v->'policies'->>'no_show','') || E'\n\n';

  RETURN out;
END
$$;