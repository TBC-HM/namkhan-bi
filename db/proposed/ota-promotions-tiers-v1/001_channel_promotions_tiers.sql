-- db/proposed/ota-promotions-tiers-v1/001_channel_promotions_tiers.sql
-- APPROVED by PBS 2026-08-25. apply_migration is already transactional, so this
-- file carries no BEGIN/COMMIT.
-- Audit copy only; the live change goes through Supabase MCP apply_migration.
--
-- WHY -----------------------------------------------------------------------
-- public.channel_promotions models every OTA programme as one flat boolean
-- plus a single cost_pct. That cannot express how the two programmes that
-- actually move money are structured:
--
--   Booking.com Genius : Level 1 = 10%, Level 2 = 15%, Level 3 = 20%. The
--                        partner opts into a level; the discount then applies
--                        to that level AND EVERY LEVEL ABOVE IT.
--   Expedia One Key    : Blue / Silver / Gold / Platinum. Member Only Deals
--                        can target ALL members or SILVER-AND-ABOVE only.
--                        VIP Access is a separate property-level commitment
--                        (recognition, upgrades, perks) with its own
--                        member-facing saving floors (Silver 15%+, Gold 20%+).
--
-- Today Namkhan carries `expedia::one_key` and `expedia::member_deal` as two
-- unrelated booleans with null cost, and `booking.com::genius` as a single
-- row at 10% — which silently means "Level 1" with nothing recording that.
-- There is also nowhere to record a campaign window, which is one reason the
-- register has not been touched since 2026-07-14.
--
-- ADDITIVE ONLY. No DROP, no column rename, no promo_key rewrite — the day
-- report reads 'booking.com::genius', 'expedia::mob_book_expedia',
-- 'expedia::exp_accel' and 'expedia::p_plus_bar' by exact key and must keep
-- resolving them (app/revenue/pickup-day/page.tsx VIS[]).

ALTER TABLE public.channel_promotions
  -- Groups tiered rows under one programme, e.g. 'genius', 'one_key'.
  -- NULL for standalone promos (country rate, LOS deal, TA campaign).
  ADD COLUMN IF NOT EXISTS programme text,

  -- Lowest member tier the promo is offered to, in the OTA's own vocabulary:
  --   booking.com -> 'l1' | 'l2' | 'l3'
  --   expedia     -> 'blue' | 'silver' | 'gold' | 'platinum'
  --   agoda       -> 'vip' | 'vip_plus'
  -- NULL = not member-tier-targeted. Semantics are "this tier and above".
  ADD COLUMN IF NOT EXISTS member_tier_floor text,

  -- What the guest actually receives. cost_pct is meaningless for a free
  -- breakfast or a visibility boost; today those get null and read as "no cost".
  ADD COLUMN IF NOT EXISTS benefit_kind text NOT NULL DEFAULT 'rate_discount',

  -- Campaign window. Country deals, flash sales and TA campaigns are all
  -- time-boxed and there is currently nowhere to say so.
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to   date;

ALTER TABLE public.channel_promotions
  DROP CONSTRAINT IF EXISTS channel_promotions_benefit_kind_ck;
ALTER TABLE public.channel_promotions
  ADD CONSTRAINT channel_promotions_benefit_kind_ck
  CHECK (benefit_kind IN ('rate_discount', 'value_add', 'visibility', 'loyalty', 'commission'));

ALTER TABLE public.channel_promotions
  DROP CONSTRAINT IF EXISTS channel_promotions_valid_window_ck;
ALTER TABLE public.channel_promotions
  ADD CONSTRAINT channel_promotions_valid_window_ck
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);

COMMENT ON COLUMN public.channel_promotions.programme IS
  'Groups tiered rows under one OTA programme (genius, one_key). NULL = standalone promo.';
COMMENT ON COLUMN public.channel_promotions.member_tier_floor IS
  'Lowest member tier targeted, in the OTA''s own vocabulary. Semantics: this tier AND ABOVE. NULL = not tier-targeted.';
COMMENT ON COLUMN public.channel_promotions.benefit_kind IS
  'rate_discount | value_add | visibility | loyalty | commission. cost_pct only means a rate cut for rate_discount.';

-- Bridge objects / grants: channel_promotions already has RLS on and grants
-- of SELECT to authenticated + full DML to service_role, with NO anon grant.
-- Adding columns does not change that, so no REVOKE is required here.

-- Adding columns does not change grants; restated for the invariant-3 audit.
REVOKE ALL ON public.channel_promotions FROM anon;
