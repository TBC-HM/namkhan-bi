-- db/proposed/build-spa-module/002_spa_booking_functions.sql
-- PROPOSED — NOT APPLIED. Requires PBS approval (project rule 4).
-- Conflict-safe booking writes for spa module v1. Depends on 001.
--
-- Queue-only law: nothing here triggers agents. These are SECURITY DEFINER
-- bridges so the dashboard (public schema only) can write to spa.*.

-- ── fn_spa_create_booking — conflict-safe insert ─────────────────────────
-- Rejects therapist or room overlap (booking window + room cleanup buffer).
CREATE OR REPLACE FUNCTION public.fn_spa_create_booking(
  p_property_id  bigint,
  p_scheduled_at timestamptz,
  p_duration_min integer,
  p_guest_name   text,
  p_treatment_id uuid    DEFAULT NULL,
  p_therapist_id uuid    DEFAULT NULL,
  p_room_id      bigint  DEFAULT NULL,
  p_reservation_id text  DEFAULT NULL,
  p_price        numeric DEFAULT NULL,
  p_currency     text    DEFAULT 'USD',
  p_notes        text    DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = spa, property, public
AS $$
DECLARE
  v_end     timestamptz := p_scheduled_at + make_interval(mins => COALESCE(p_duration_min, 60));
  v_cleanup integer := 0;
  v_id      uuid;
BEGIN
  IF p_room_id IS NOT NULL THEN
    SELECT COALESCE(cleanup_min, 0) INTO v_cleanup FROM spa.rooms WHERE room_id = p_room_id;
  END IF;

  -- therapist double-booking guard
  IF p_therapist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM spa.treatment_bookings b
    WHERE b.property_id = p_property_id
      AND b.therapist_id = p_therapist_id
      AND b.status NOT IN ('cancelled', 'no_show')
      AND tstzrange(b.scheduled_at, b.scheduled_at + make_interval(mins => COALESCE(b.duration_min, 60)))
          && tstzrange(p_scheduled_at, v_end)
  ) THEN
    RAISE EXCEPTION 'SPA_CONFLICT_THERAPIST: therapist already booked in this window';
  END IF;

  -- room double-booking guard (includes cleanup buffer)
  IF p_room_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM spa.treatment_bookings b
    WHERE b.property_id = p_property_id
      AND b.room_id = p_room_id
      AND b.status NOT IN ('cancelled', 'no_show')
      AND tstzrange(b.scheduled_at,
                    b.scheduled_at + make_interval(mins => COALESCE(b.duration_min, 60) + v_cleanup))
          && tstzrange(p_scheduled_at, v_end + make_interval(mins => v_cleanup))
  ) THEN
    RAISE EXCEPTION 'SPA_CONFLICT_ROOM: room occupied in this window (incl. cleanup buffer)';
  END IF;

  INSERT INTO spa.treatment_bookings
    (property_id, scheduled_at, duration_min, guest_name, treatment_id, therapist_id,
     room_id, reservation_id, price, currency, status, notes)
  VALUES
    (p_property_id, p_scheduled_at, COALESCE(p_duration_min, 60), p_guest_name, p_treatment_id,
     p_therapist_id, p_room_id, p_reservation_id, p_price, COALESCE(p_currency, 'USD'), 'booked', p_notes)
  RETURNING booking_id INTO v_id;
  RETURN v_id;
END $$;

-- ── fn_spa_set_booking_status — controlled lifecycle transitions ─────────
-- booked → confirmed → arrived → in_treatment → completed | cancelled | no_show
CREATE OR REPLACE FUNCTION public.fn_spa_set_booking_status(
  p_booking_id uuid,
  p_status     text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = spa, public
AS $$
BEGIN
  IF p_status NOT IN ('booked','confirmed','arrived','in_treatment','completed','cancelled','no_show') THEN
    RAISE EXCEPTION 'SPA_BAD_STATUS: %', p_status;
  END IF;
  UPDATE spa.treatment_bookings
     SET status = p_status, updated_at = now()
   WHERE booking_id = p_booking_id;
  RETURN FOUND;
  -- Follow-up (separate approval): on 'completed', call
  -- public.fn_inv_deduct_treatment_products for recipe consumable deduction
  -- and enqueue Cloudbeds folio posting for in-house guests.
END $$;

GRANT EXECUTE ON FUNCTION public.fn_spa_create_booking(bigint, timestamptz, integer, text, uuid, uuid, bigint, text, numeric, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_spa_set_booking_status(uuid, text)
  TO authenticated, service_role;
