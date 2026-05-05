// app/api/checkout/session/route.ts
// POST { slug, guestInfo, partySize } -> creates a held booking, returns stub Stripe URL.
// Real Stripe wiring deferred until STRIPE_SECRET_KEY is set.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { slug, guestInfo, partySize, totalUsd } = body;
    if (!slug || !guestInfo?.email) {
      return NextResponse.json({ error: 'slug + guestInfo.email required' }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    const { data: retreat } = await admin
      .schema('web')
      .from('retreats')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (!retreat) return NextResponse.json({ error: 'retreat not found' }, { status: 404 });

    const total = Number(totalUsd ?? retreat.price_usd_from * (partySize ?? 1));
    const deposit = Math.round(total * 0.30);
    const balance = total - deposit;

    const arrival = retreat.arrival_window_from;
    const departure = retreat.arrival_window_to;

    const { data: booking, error } = await admin
      .schema('book')
      .from('bookings')
      .insert({
        retreat_slug: slug,
        variant_id: retreat.variant_id,
        guest_first_name: guestInfo.firstName ?? '—',
        guest_last_name: guestInfo.lastName ?? '—',
        guest_email: guestInfo.email,
        guest_phone: guestInfo.phone ?? null,
        guest_country: guestInfo.country ?? null,
        party_size: partySize ?? 1,
        arrival_date: arrival,
        departure_date: departure,
        total_usd: total,
        deposit_usd: deposit,
        balance_usd: balance,
        status: 'held',
      })
      .select('id, public_token')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      bookingId: booking!.id,
      publicToken: booking!.public_token,
      checkoutUrl: `/r/${slug}/thanks?token=${booking!.public_token}`,
      note: 'Stripe checkout is stubbed — booking created in held state. Wire STRIPE_SECRET_KEY to enable real payments.',
      totals: { total_usd: total, deposit_usd: deposit, balance_usd: balance },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
