-- Brief: ledger-contact-and-sync-fixes-v1
-- Status: PROPOSED — not applied (blocked pending approval)
-- Verified against live DB kpenyneooigsyuuomgct on 2026-09-06.
--
-- PROBLEM
-- The Finance > Ledger "Aged receivables" container (54 resv · $37.2k) offers
-- "click a guest name to open the contact drawer · send reminder". The reminder
-- button in GuestDrawer is disabled whenever guest_email is null.
--
--   SELECT count(*) FILTER (WHERE guest_email IS NOT NULL AND guest_email <> '')
--     FROM public.v_aged_ar_with_contact;   -->  7 of 54
--
-- So 47 rows carrying $33,492.52 of the $37,196.12 outstanding (90% of the
-- value) render a dead button.
--
-- ROOT CAUSE
-- v_aged_ar_with_contact ALREADY LEFT JOINs pms.guests_cb and already reads
-- g.phone for guest_phone. The guest_email expression simply never falls back
-- to g.email -- it stops at reservations_cb.guest_email + raw.guestList.
-- Measured recovery from the join that is already present:
--
--   from_resv_col       0
--   from_raw_guestlist  0
--   from_guests_cb     45      <-- of 47 missing
--
-- Coverage goes 7/54 -> 52/54.
--
-- SAFETY
-- Column list, order and types are unchanged (only the guest_email expression
-- changes), so CREATE OR REPLACE is valid here -- no DROP required, no
-- dependent object breaks. Additive, reversible by restoring the two-arm
-- COALESCE. Nothing is dropped, deleted or unscheduled.

CREATE OR REPLACE VIEW public.v_aged_ar_with_contact AS
 SELECT m.property_id,
    m.reservation_id,
    m.guest_name,
    m.source_name,
    m.check_in_date,
    m.check_out_date,
    m.open_balance,
    m.bucket,
    m.days_overdue,
    COALESCE(
      NULLIF(r.guest_email, ''::text),
      NULLIF((((r.raw -> 'guestList'::text) -> 0) ->> 'guestEmail'::text), ''::text),
      NULLIF(g.email, ''::text)
    ) AS guest_email,
    COALESCE(g.phone, NULLIF((((r.raw -> 'guestList'::text) -> 0) ->> 'guestPhone'::text), ''::text)) AS guest_phone,
    (r.raw ->> 'guestID'::text) AS guest_id
   FROM ((mv_aged_ar m
     LEFT JOIN pms.reservations_cb r ON (((r.property_id = m.property_id) AND (r.reservation_id = m.reservation_id))))
     LEFT JOIN pms.guests_cb g ON (((g.property_id = m.property_id) AND (g.guest_id = (r.raw ->> 'guestID'::text)))));

REVOKE ALL ON public.v_aged_ar_with_contact FROM anon;
GRANT SELECT ON public.v_aged_ar_with_contact TO authenticated, service_role;

-- VERIFY AFTER APPLY (expect have_email = 52)
-- SELECT count(*) AS total,
--        count(*) FILTER (WHERE guest_email IS NOT NULL AND guest_email <> '') AS have_email
--   FROM public.v_aged_ar_with_contact;

-- ROLLBACK: re-run the above with guest_email reduced to
--   COALESCE(r.guest_email, NULLIF(((r.raw->'guestList')->0)->>'guestEmail',''))
