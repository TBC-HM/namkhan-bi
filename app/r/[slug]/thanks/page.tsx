// app/r/[slug]/thanks/page.tsx
// Booking confirmation — reads the held booking via public_token.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtIsoDate, fmtKpi } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { token?: string };
}) {
  const token = searchParams.token;
  if (!token) notFound();

  const admin = getSupabaseAdmin();
  const { data: booking } = await admin
    .schema('book')
    .from('bookings')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();
  if (!booking) notFound();

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '80px 24px', fontFamily: 'var(--sans)', color: 'var(--ink)', textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', fontFamily: 'var(--mono)', marginBottom: 12 }}>
        The Namkhan · booking held
      </div>
      <h1 style={{
        fontFamily: 'var(--serif)', fontSize: 'var(--t-3xl, 36px)', fontWeight: 500,
        fontStyle: 'italic', margin: '0 0 16px',
      }}>
        Quiet days ahead.
      </h1>
      <div style={{ fontSize: 'var(--t-base)', color: 'var(--ink-soft)', marginBottom: 28 }}>
        We've held your spot for <strong>{booking.guest_first_name} {booking.guest_last_name}</strong> ({booking.party_size} pax) from {fmtIsoDate(booking.arrival_date)} to {fmtIsoDate(booking.departure_date)}.
      </div>

      <div style={{
        padding: 20, background: 'var(--paper-deep, #f5efdf)', borderRadius: 4,
        marginBottom: 28, textAlign: 'left', fontSize: 'var(--t-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span>Total</span><strong style={{ fontFamily: 'var(--mono)' }}>{fmtKpi(booking.total_usd, 'usd', 0)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span>Deposit due</span><strong style={{ fontFamily: 'var(--mono)' }}>{fmtKpi(booking.deposit_usd, 'usd', 0)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--ink-mute)' }}>
          <span>Balance</span><span style={{ fontFamily: 'var(--mono)' }}>{fmtKpi(booking.balance_usd, 'usd', 0)}</span>
        </div>
      </div>

      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', marginBottom: 12 }}>
        Status: <strong style={{ color: 'var(--brass)' }}>{booking.status}</strong>
      </div>
      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginBottom: 32 }}>
        Booking token: <code style={{ fontFamily: 'var(--mono)' }}>{booking.public_token}</code>
      </div>

      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
        v1: Payment integration pending. We'll reach out within 24 hours to confirm the deposit.
      </div>
      <Link href={`/r/${params.slug}`} style={{ display: 'inline-block', marginTop: 24, fontSize: 'var(--t-sm)', color: 'var(--brass)' }}>
        ← Back to retreat
      </Link>
    </main>
  );
}
