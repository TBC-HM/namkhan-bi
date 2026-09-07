-- db/proposed/ota-promotions-tiers-v1/004_seed_booking_com_genius_tiers.sql
-- *** NOT APPROVED — HELD. *** PBS approved the Expedia adjustments only.
--
-- Why this is held separately: booking.com::genius is the ONLY active promo row
-- in the entire table (10%, set 2026-07-08) and it feeds the day report's
-- "Genius" visibility column. Relabelling it is safe (promo_key untouched), but
-- it is Booking.com scope, not Expedia scope. Apply only on explicit say-so.

UPDATE public.channel_promotions
   SET programme = 'genius', member_tier_floor = 'l1',
       benefit_kind = 'rate_discount',
       label = 'Genius Level 1 (10%)'
 WHERE channel = 'booking.com' AND promo_key = 'genius';

INSERT INTO public.channel_promotions
  (property_id, channel, promo_key, label, is_active, cost_pct, notes,
   programme, member_tier_floor, benefit_kind)
SELECT p.property_id, 'booking.com', v.promo_key, v.label, false, v.pct, v.note,
       'genius', v.tier, 'rate_discount'
  FROM (SELECT DISTINCT property_id FROM public.channel_promotions WHERE channel = 'booking.com') p
 CROSS JOIN (VALUES
    ('genius_l2', 'Genius Level 2 (15%)', 15.00, 'l2', 'Opt-in tier above L1; may add breakfast/upgrade perks'),
    ('genius_l3', 'Genius Level 3 (20%)', 20.00, 'l3', 'Opt-in tier above L2; priority assistance + upgrade')
 ) AS v(promo_key, label, pct, tier, note)
ON CONFLICT (property_id, channel, promo_key) DO NOTHING;
