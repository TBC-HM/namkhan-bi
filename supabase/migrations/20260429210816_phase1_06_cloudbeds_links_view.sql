-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429210816
-- Name:    phase1_06_cloudbeds_links_view
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.6 — Cloudbeds deeplink helpers
-- Frontend reads .url to render "Open in Cloudbeds" buttons.
-- Pattern based on common Cloudbeds web app routes.
-- Verify one and we tweak the template.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.cloudbeds_link(entity text, entity_id text, property_id bigint DEFAULT 260955)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE entity
    WHEN 'reservation' THEN 'https://hotels.cloudbeds.com/connect/' || property_id::text || '#/reservations/' || entity_id
    WHEN 'guest'       THEN 'https://hotels.cloudbeds.com/connect/' || property_id::text || '#/guests/' || entity_id
    WHEN 'room'        THEN 'https://hotels.cloudbeds.com/connect/' || property_id::text || '#/rooms/' || entity_id
    WHEN 'house_account' THEN 'https://hotels.cloudbeds.com/connect/' || property_id::text || '#/house-accounts/' || entity_id
    WHEN 'group'       THEN 'https://hotels.cloudbeds.com/connect/' || property_id::text || '#/groups/' || entity_id
    WHEN 'rate_plan'   THEN 'https://hotels.cloudbeds.com/connect/' || property_id::text || '#/rate-plans/' || entity_id
    WHEN 'item'        THEN 'https://hotels.cloudbeds.com/connect/' || property_id::text || '#/items/' || entity_id
    ELSE NULL END
$$;

GRANT EXECUTE ON FUNCTION public.cloudbeds_link(text,text,bigint) TO anon, authenticated, service_role;

-- Convenience view: every reservation with its deeplink
CREATE OR REPLACE VIEW public.v_reservations_linked AS
SELECT r.*,
       public.cloudbeds_link('reservation', r.reservation_id, r.property_id) AS cloudbeds_url
FROM public.reservations r;

CREATE OR REPLACE VIEW public.v_guests_linked AS
SELECT g.*,
       public.cloudbeds_link('guest', g.guest_id, g.property_id) AS cloudbeds_url
FROM public.guests g;

GRANT SELECT ON public.v_reservations_linked TO authenticated, anon;
GRANT SELECT ON public.v_guests_linked TO authenticated, anon;

COMMENT ON FUNCTION public.cloudbeds_link IS 'Returns a Cloudbeds web app deeplink for the given entity. Adjust template once one URL is verified.';
