// app/r/[slug]/lead/page.tsx
// Lead magnet page — captures email via /api/lead/capture.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import LeadForm from './_components/LeadForm';

export const dynamic = 'force-dynamic';

export default async function LeadPage({ params }: { params: { slug: string } }) {
  const admin = getSupabaseAdmin();
  const { data: retreat } = await admin
    .from('v_retreats')
    .select('slug, name, tagline, series_slug')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!retreat) notFound();

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px', fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <div style={{
        fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)',
        color: 'var(--brass)', fontFamily: 'var(--mono)', marginBottom: 12,
      }}>
        The Namkhan · subscribe
      </div>
      <h1 style={{
        fontFamily: 'var(--serif)', fontSize: 'var(--t-3xl, 36px)', fontWeight: 500,
        fontStyle: 'italic', margin: '0 0 12px', lineHeight: 1.15,
      }}>
        Quiet days on the river.
      </h1>
      <div style={{ fontSize: 'var(--t-base)', color: 'var(--ink-soft)', marginBottom: 28 }}>
        Subscribe and receive the lunar calendar, our retreat schedule, and one essay each month from the river.
      </div>

      <LeadForm slug={retreat.slug} />

      <div style={{ marginTop: 36, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
        We send one email a month and never share your email.{' '}
        <Link href="/privacy" style={{ color: 'var(--brass)' }}>Privacy</Link>
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--t-xs)' }}>
        <Link href={`/r/${retreat.slug}`} style={{ color: 'var(--brass)' }}>← Back to {retreat.name}</Link>
      </div>
    </main>
  );
}
