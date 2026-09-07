-- db/proposed/ota-promotions-tiers-v1/003_fn_channel_promotion_upsert_v2.sql
-- Required for 001's columns to be reachable from the UI. Without this the new
-- dimensions exist but nothing can write them — a write-only schema.
--
-- CREATE FORWARD: fn_channel_promotion_upsert (v1) is left exactly as it is.
-- v1's ON CONFLICT clause does not touch the new columns, so any legacy caller
-- preserves rather than wipes them.

CREATE OR REPLACE FUNCTION public.fn_channel_promotion_upsert_v2(
  p_property_id      bigint,
  p_channel          text,
  p_promo_key        text,
  p_label            text,
  p_is_active        boolean,
  p_cost_pct         numeric DEFAULT NULL,
  p_cost_flat        numeric DEFAULT NULL,
  p_notes            text    DEFAULT NULL,
  p_updated_by       text    DEFAULT 'ui',
  p_programme        text    DEFAULT NULL,
  p_member_tier_floor text   DEFAULT NULL,
  p_benefit_kind     text    DEFAULT 'rate_discount',
  p_valid_from       date    DEFAULT NULL,
  p_valid_to         date    DEFAULT NULL
)
RETURNS public.channel_promotions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare r public.channel_promotions;
begin
  insert into public.channel_promotions
    (property_id, channel, promo_key, label, is_active, cost_pct, cost_flat,
     notes, updated_at, updated_by,
     programme, member_tier_floor, benefit_kind, valid_from, valid_to)
  values
    (p_property_id, p_channel, p_promo_key, p_label, p_is_active, p_cost_pct,
     p_cost_flat, p_notes, now(), p_updated_by,
     p_programme, p_member_tier_floor, coalesce(p_benefit_kind, 'rate_discount'),
     p_valid_from, p_valid_to)
  on conflict (property_id, channel, promo_key) do update set
    is_active         = excluded.is_active,
    cost_pct          = excluded.cost_pct,
    cost_flat         = excluded.cost_flat,
    notes             = excluded.notes,
    label             = excluded.label,
    programme         = excluded.programme,
    member_tier_floor = excluded.member_tier_floor,
    benefit_kind      = excluded.benefit_kind,
    valid_from        = excluded.valid_from,
    valid_to          = excluded.valid_to,
    updated_at        = now(),
    updated_by        = excluded.updated_by
  returning * into r;
  return r;
end $function$;

-- Invariant 3 / database.md GRANT recipe.
REVOKE ALL ON FUNCTION public.fn_channel_promotion_upsert_v2(
  bigint, text, text, text, boolean, numeric, numeric, text, text, text, text, text, date, date
) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_channel_promotion_upsert_v2(
  bigint, text, text, text, boolean, numeric, numeric, text, text, text, text, text, date, date
) TO authenticated, service_role;
