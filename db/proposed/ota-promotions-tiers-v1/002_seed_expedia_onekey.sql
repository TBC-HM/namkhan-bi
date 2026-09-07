-- db/proposed/ota-promotions-tiers-v1/002_seed_expedia_onekey.sql
-- APPROVED by PBS 2026-08-25 ("follow the expedia adjustments").
-- Scope: EXPEDIA ONLY. The Booking.com Genius tier work is held in 004 and is
-- NOT approved — it touches the only active promo row in the whole table.
-- Runs after 001. Existing promo_keys are UPDATED, never renamed: the day
-- report reads expedia::mob_book_expedia / exp_accel / p_plus_bar by exact key.

-- One Key is Expedia's Genius. Tiers: Blue -> Silver -> Gold -> Platinum.
-- The enrolment row is the programme master; it is not itself a rate discount.
UPDATE public.channel_promotions
   SET programme     = 'one_key',
       benefit_kind  = 'loyalty',
       label         = 'One Key (programme enrolment)',
       notes         = 'Expedia Group unified loyalty. Tiers: Blue / Silver / Gold / Platinum.'
 WHERE channel = 'expedia' AND promo_key = 'one_key';

-- Member Only Deals target either all signed-in members or a tier floor.
UPDATE public.channel_promotions
   SET programme         = 'one_key',
       member_tier_floor = 'blue',
       benefit_kind      = 'rate_discount',
       label             = 'Member Only Deal — all members',
       notes             = 'Signed-in One Key members, any tier'
 WHERE channel = 'expedia' AND promo_key = 'member_deal';

-- Programmes Expedia sells that were never in the catalogue at all.
INSERT INTO public.channel_promotions
  (property_id, channel, promo_key, label, is_active, cost_pct, notes,
   programme, member_tier_floor, benefit_kind)
SELECT p.property_id, 'expedia', v.promo_key, v.label, false, NULL, v.note,
       v.prog, v.tier, v.kind
  FROM (SELECT DISTINCT property_id FROM public.channel_promotions WHERE channel = 'expedia') p
 CROSS JOIN (VALUES
    ('member_deal_silver', 'Member Only Deal — Silver+', 'one_key', 'silver', 'rate_discount',
     'Targets Silver, Gold and Platinum only'),
    ('member_deal_gold',   'Member Only Deal — Gold+',   'one_key', 'gold',   'rate_discount',
     'Targets Gold and Platinum only'),
    ('vip_access',         'VIP Access',                 'one_key', 'silver', 'visibility',
     'Property commitment: check-in recognition, upgrade when available, a perk. Silver saves 15%+, Gold 20%+'),
    ('value_add',          'Value Add promotion',        NULL,      NULL,     'value_add',
     'Non-rate offer — parking, breakfast, F&B or spa credit. Cost is flat, not %')
 ) AS v(promo_key, label, prog, tier, kind, note)
ON CONFLICT (property_id, channel, promo_key) DO NOTHING;

-- Accelerator and Package+ BAR buy visibility, not a guest-facing rate cut.
UPDATE public.channel_promotions
   SET benefit_kind = 'visibility'
 WHERE channel = 'expedia' AND promo_key IN ('exp_accel', 'p_plus_bar');

-- Mobile Book & Expedia is a device-targeted rate cut, not a member deal.
UPDATE public.channel_promotions
   SET benefit_kind = 'rate_discount'
 WHERE channel = 'expedia' AND promo_key = 'mob_book_expedia';

-- Data hygiene: `eu` was created through the UI on 2026-07-14 and left as a
-- placeholder. NOT deleted — operator-entered rows are not ours to remove.
UPDATE public.channel_promotions
   SET notes = 'INCOMPLETE — market never specified (created 2026-07-14). Complete or deactivate.'
 WHERE channel = 'expedia' AND promo_key = 'eu' AND notes = '(specify market in notes)';
