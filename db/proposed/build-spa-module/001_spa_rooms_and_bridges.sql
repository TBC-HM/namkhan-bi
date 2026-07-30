-- db/proposed/build-spa-module/001_spa_rooms_and_bridges.sql
-- APPLIED 2026-07-30 15:24 UTC as migration spa_rooms_and_bridges (verifier-authorized, brief spa-module-v1 §0.V).
-- Spa module v1 (brief spa-module-v1, audit docs/spa-audit-2026-07-30.md).
--
-- Found state: spa.treatment_bookings / spa.therapists exist (0 rows) but have
-- NO public bridges (PostgREST law §5) and no rooms resource (bookings.room is
-- free text). property.spa_treatments is the catalogue source of truth and is
-- already bridged (v_property_spa_treatments). This file only ADDS; nothing
-- existing is altered destructively.

-- ── 1. Treatment rooms as a real resource ────────────────────────────────
CREATE TABLE IF NOT EXISTS spa.rooms (
  room_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id  bigint NOT NULL,
  name         text   NOT NULL,
  room_type    text,                          -- treatment | couples | facial | wet | relaxation
  couples_capable boolean NOT NULL DEFAULT false,
  cleanup_min  integer NOT NULL DEFAULT 15,   -- turnover buffer used by conflict check
  is_active    boolean NOT NULL DEFAULT true,
  display_order integer,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, name)
);

-- Seed (Namkhan Jungle Spa — CONFIRM room names with spa team before apply):
-- INSERT INTO spa.rooms (property_id, name, room_type, couples_capable, display_order)
-- VALUES (260955, 'Treatment Room 1', 'treatment', true, 1),
--        (260955, 'Treatment Room 2', 'treatment', true, 2)
-- ON CONFLICT (property_id, name) DO NOTHING;
-- [2026-07-30 builder note: superseded — rooms seeded from property.facilities
--  treatment_room rows (3 real rooms, facility_id 118/119/120); see 003.]

-- ── 2. Therapist display name (gap: spa.therapists has no name column) ───
ALTER TABLE spa.therapists ADD COLUMN IF NOT EXISTS display_name text;

-- Link bookings to a real room while keeping the legacy free-text column.
ALTER TABLE spa.treatment_bookings
  ADD COLUMN IF NOT EXISTS room_id bigint REFERENCES spa.rooms(room_id);

-- ── 3. Public bridges (PostgREST exposes only `public`) ──────────────────
CREATE OR REPLACE VIEW public.v_spa_rooms AS
SELECT room_id, property_id, name, room_type, couples_capable,
       cleanup_min, is_active, display_order, notes
FROM spa.rooms;

CREATE OR REPLACE VIEW public.v_spa_therapists AS
SELECT t.therapist_id, t.property_id,
       COALESCE(t.display_name, 'Therapist ' || left(t.therapist_id::text, 8)) AS display_name,
       t.specialties, t.languages, t.certifications, t.rating, t.is_active
FROM spa.therapists t;

CREATE OR REPLACE VIEW public.v_spa_treatment_bookings AS
SELECT b.booking_id, b.property_id,
       b.scheduled_at,
       COALESCE(b.duration_min, pt.duration_min, 60)             AS duration_min,
       b.scheduled_at + make_interval(mins => COALESCE(b.duration_min, pt.duration_min, 60)) AS ends_at,
       b.guest_name, b.guest_id, b.reservation_id,
       b.treatment_id,
       COALESCE(st.name, pt.name, '—')                           AS treatment_name,
       COALESCE(st.category, pt.category)                        AS treatment_category,
       b.therapist_id,
       COALESCE(th.display_name, 'Therapist ' || left(b.therapist_id::text, 8)) AS therapist_name,
       b.room_id, COALESCE(r.name, b.room)                       AS room_name,
       b.status, b.price, b.currency,
       b.posted_to_folio, b.cloudbeds_charge_id,
       b.notes, b.created_at, b.updated_at
FROM spa.treatment_bookings b
LEFT JOIN spa.treatments st        ON st.treatment_id = b.treatment_id
LEFT JOIN property.spa_treatments pt ON pt.name = st.name AND pt.property_id = b.property_id
LEFT JOIN spa.therapists th        ON th.therapist_id = b.therapist_id
LEFT JOIN spa.rooms r              ON r.room_id = b.room_id;

GRANT SELECT ON public.v_spa_rooms, public.v_spa_therapists, public.v_spa_treatment_bookings
  TO anon, authenticated, service_role;
