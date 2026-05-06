-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502231141
-- Name:    phase1_16_room_content_and_policies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- 1) Room type content (owner-curated, mirrors public.room_types via FK)
CREATE TABLE IF NOT EXISTS marketing.room_type_content (
  room_type_id        bigint PRIMARY KEY REFERENCES public.room_types(room_type_id),
  property_id         bigint NOT NULL REFERENCES public.hotels(property_id),
  -- Display
  display_name        text NOT NULL,
  short_pitch         text,                          -- "Most unique experience"
  long_description    text,                          -- markdown, full prose
  -- Physical
  size_sqm            numeric(6,1),
  garden_sqm          numeric(6,1),
  view_type           text[] DEFAULT '{}',           -- ['riverfront','garden']
  bed_config          text[] DEFAULT '{}',           -- ['1 large double','2 single']
  max_occupancy       int,
  max_adults          int,
  max_children        int,
  extra_bed_allowed   boolean DEFAULT false,
  -- Positioning
  positioning_tier    text,                          -- 'entry','signature','premium'
  positioning_label   text,                          -- 'Most unique experience'
  ideal_for           text[] DEFAULT '{}',           -- ['couples','families','solo']
  -- Amenities (structured)
  amenities           jsonb DEFAULT '{}'::jsonb,     -- categorized
  -- Media
  hero_image_url      text,
  gallery_urls        text[] DEFAULT '{}',
  fact_sheet_url      text,                          -- the PDF you sent
  -- Notes
  internal_notes      text,
  todo_list           text[] DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE marketing.room_type_content IS
  'Owner-curated room type content. Mirrors public.room_types via FK. '
  'public.room_types is Cloudbeds-synced (read-only). This is brand/marketing layer.';

-- 2) Booking policies — single row per property
CREATE TABLE IF NOT EXISTS marketing.booking_policies (
  property_id          bigint PRIMARY KEY REFERENCES public.hotels(property_id),
  -- Confirmation
  confirmation_rules   text,
  required_guest_details text[] DEFAULT '{}',
  guest_details_deadline_days int DEFAULT 10,
  non_compliance_consequence text,
  -- Payment
  fit_payment_terms    text,
  group_payment_terms  text,
  accepted_payment_methods text[] DEFAULT '{}',
  -- Cancellation
  cancellation_policy  text,
  no_show_policy       text,
  early_departure_policy text,
  -- Modifications
  modification_policy  text,
  -- Group/retreat
  group_booking_terms  text,
  -- Booking approach
  recommended_min_nights int DEFAULT 3,
  selling_approach     text,
  -- Liability
  liability_clause     text,
  final_note           text,
  -- Audit
  effective_from       date DEFAULT current_date,
  source_doc_url       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE marketing.booking_policies IS
  'Booking, cancellation, payment policies. Single row per property. '
  'Used by reservation comms, OTA listings, agent training, agent prompts.';

-- 3) Certifications & affiliations (multi-row, separate from property_profile.affiliations text array)
CREATE TABLE IF NOT EXISTS marketing.certifications (
  cert_id              bigserial PRIMARY KEY,
  property_id          bigint NOT NULL REFERENCES public.hotels(property_id),
  certifying_body      text NOT NULL,
  certification_name   text NOT NULL,
  level                text,                         -- 'Gold','Considerate Collection'
  certification_url    text,
  issued_date          date,
  expires_date         date,
  is_active            boolean DEFAULT true,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE marketing.certifications IS
  'Eco/sustainability/luxury certifications. Tracks expiry dates so renewal alerts fire.';

-- 4) RLS for all 3 tables
ALTER TABLE marketing.room_type_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.booking_policies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.certifications     ENABLE ROW LEVEL SECURITY;

CREATE POLICY rtc_read   ON marketing.room_type_content FOR SELECT TO authenticated USING (true);
CREATE POLICY rtc_write  ON marketing.room_type_content FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));

CREATE POLICY bp_read    ON marketing.booking_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY bp_write   ON marketing.booking_policies FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm']))
  WITH CHECK (app.has_role(ARRAY['owner','gm']));

CREATE POLICY cert_read  ON marketing.certifications FOR SELECT TO authenticated USING (true);
CREATE POLICY cert_write ON marketing.certifications FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));

-- 5) Convenience view: room types with both Cloudbeds + content fields joined
CREATE OR REPLACE VIEW marketing.v_room_catalog AS
SELECT
  rt.room_type_id,
  rt.property_id,
  rt.room_type_name              AS cloudbeds_name,
  COALESCE(c.display_name, rt.room_type_name) AS display_name,
  rt.quantity                    AS units,
  rt.max_guests                  AS cloudbeds_max_guests,
  c.short_pitch,
  c.long_description,
  c.size_sqm,
  c.garden_sqm,
  c.view_type,
  c.bed_config,
  c.max_occupancy,
  c.max_adults,
  c.max_children,
  c.extra_bed_allowed,
  c.positioning_tier,
  c.positioning_label,
  c.ideal_for,
  c.amenities,
  c.hero_image_url,
  c.gallery_urls,
  c.fact_sheet_url,
  c.todo_list,
  rt.synced_at                   AS cloudbeds_synced_at,
  c.updated_at                   AS content_updated_at
FROM public.room_types rt
LEFT JOIN marketing.room_type_content c ON c.room_type_id = rt.room_type_id
ORDER BY
  CASE c.positioning_tier
    WHEN 'premium' THEN 1
    WHEN 'signature' THEN 2
    WHEN 'entry' THEN 3
    ELSE 4
  END,
  rt.room_type_name;

COMMENT ON VIEW marketing.v_room_catalog IS
  'Room catalog: Cloudbeds-synced fields (quantity, max_guests) + owner-curated content (description, amenities). '
  'Use this for the website, OTA refreshes, agent training, sales decks.';