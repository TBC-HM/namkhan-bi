// app/api/channel-promotions/upsert/route.ts
// PBS 2026-08-25 (L22 / invariant 4): property_id arriving in the request body
// is UNTRUSTED. Before this fix any authenticated user could write promotion
// state for any property — the body value went straight into a SECURITY
// DEFINER RPC. It is now verified with requirePropertyAccess() and the channel
// is checked against the registry so unknown channels cannot be seeded.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';
import { getSessionScope } from '@/lib/session-scope';
import { otaChannelForKey, BENEFIT_KINDS } from '@/lib/ota-promotions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  // L22: verify the caller actually holds a grant on this property. Throws a
  // Response (400/403) — return it rather than letting it fall into the 500
  // handler below, which would stringify it as "[object Response]".
  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, b.property_id as string | number | null);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'authorization_check_failed' }, { status: 403 });
  }

  const channel = String(b.channel ?? '');
  const cfg = otaChannelForKey(channel);
  if (!cfg) {
    return NextResponse.json({ error: `unknown channel "${channel}"` }, { status: 400 });
  }

  // ota-promotions-tiers-v1: validate the new dimensions against the registry
  // so a bad client cannot trip the CHECK constraints with a 500.
  const benefitKind = String(b.benefit_kind ?? 'rate_discount');
  if (!BENEFIT_KINDS.some((k) => k.key === benefitKind)) {
    return NextResponse.json({ error: `unknown benefit_kind "${benefitKind}"` }, { status: 400 });
  }

  const tierFloor = b.member_tier_floor == null || b.member_tier_floor === ''
    ? null
    : String(b.member_tier_floor);
  if (tierFloor && !cfg.memberTiers.some((t) => t.key === tierFloor)) {
    return NextResponse.json(
      { error: `"${tierFloor}" is not a ${cfg.display} member tier` },
      { status: 400 },
    );
  }

  const validFrom = b.valid_from ? String(b.valid_from) : null;
  const validTo   = b.valid_to   ? String(b.valid_to)   : null;
  if (validFrom && validTo && validTo < validFrom) {
    return NextResponse.json({ error: 'valid_to is before valid_from' }, { status: 400 });
  }

  const promoKey = String(b.promo_key ?? '').trim();
  if (!promoKey) return NextResponse.json({ error: 'promo_key required' }, { status: 400 });

  const label = String(b.label ?? '').trim();
  if (!label) return NextResponse.json({ error: 'label required' }, { status: 400 });

  // Audit the actual operator instead of the literal 'ui' the client sent.
  const scope = await getSessionScope().catch(() => null);
  const updatedBy = scope?.email ?? 'ui';

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_channel_promotion_upsert_v2', {
      p_property_id: propertyId,
      p_channel:     channel,
      p_promo_key:   promoKey,
      p_label:       label,
      p_is_active:   !!b.is_active,
      p_cost_pct:    b.cost_pct == null ? null : Number(b.cost_pct),
      p_cost_flat:   b.cost_flat == null ? null : Number(b.cost_flat),
      p_notes:       b.notes ?? '',
      p_updated_by:  updatedBy,
      p_programme:         b.programme == null || b.programme === '' ? null : String(b.programme),
      p_member_tier_floor: tierFloor,
      p_benefit_kind:      benefitKind,
      p_valid_from:        validFrom,
      p_valid_to:          validTo,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, row: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
