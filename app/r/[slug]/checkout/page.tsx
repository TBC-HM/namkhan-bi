// app/r/[slug]/checkout/page.tsx
// Checkout — calls /api/checkout/session (which creates a held booking; Stripe stub).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtKpi, fmtIsoDate } from '@/lib/format';
import CheckoutForm from './_components/CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: { slug: string } }) {
  const admin = getSupabaseAdmin();
  const { data: retreat } = await admin
    .schema('web')
    .from('retreats')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!retreat) notFound();

  const { data: variant } = await admin
    .schema('compiler')
    .from('variants')
    .select('total_usd, per_pax_usd, room_category, fnb_mode')
    .eq('id', retreat.variant_id)
    .maybeSingle();

  const total = Number(variant?.total_usd ?? retreat.price_usd_from * (retreat.spots_total ?? 1));
  const deposit = Math.round(total * 0.30);
  const balance = total - deposit;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 100px', fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <div style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
        The Namkhan · book
      </div>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-2xl)', fontStyle: 'italic', margin: '0 0 6px' }}>
        {retreat.name}
      </h1>
      <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-sm)', marginBottom: 24 }}>
        {fmtIsoDate(retreat.arrival_window_from)} → {fmtIsoDate(retreat.arrival_window_to)} · {variant?.room_category ?? '—'} · {variant?.fnb_mode ?? '—'}
      </div>

      <div style={{
        padding: 18, background: 'var(--paper-deep, #f5efdf)', borderRadius: 4, marginBottom: 28,
        fontSize: 'var(--t-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span>Total</span><strong style={{ fontFamily: 'var(--mono)' }}>{fmtKpi(total, 'usd', 0)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span>Deposit (30%) — due now</span><strong style={{ fontFamily: 'var(--mono)' }}>{fmtKpi(deposit, 'usd', 0)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--ink-mute)' }}>
          <span>Balance (70%) — 30 days pre-arrival</span><span style={{ fontFamily: 'var(--mono)' }}>{fmtKpi(balance, 'usd', 0)}</span>
        </div>
      </div>

      <CheckoutForm slug={params.slug} totalUsd={total} maxPax={retreat.spots_remaining} />

      <div style={{ marginTop: 24, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
        v1: Stripe checkout is stubbed. Submitting creates a held booking only — no card is charged. Wire <code style={{ background: 'var(--paper-deep, #f5efdf)', padding: '1px 4px' }}>STRIPE_SECRET_KEY</code> in Vercel to enable real payments.
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--t-xs)' }}>
        <Link href={`/r/${params.slug}`} style={{ color: 'var(--brass)' }}>← Back to {retreat.name}</Link>
      </div>
    </main>
  );
}
