// app/guest/directory/page.tsx — wired to <Page> shell + dark theme.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { supabase as anonClient, PROPERTY_ID } from '@/lib/supabase';
import { DirectoryShell } from './_components/DirectoryShell';
import Page from '@/components/page/Page';
import { GUEST_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export default async function GuestDirectoryPage() {
  const sb = createClient();

  const [{ data: facets }, { data: headlineRows }, messyR] = await Promise.all([
    sb.schema('guest').from('v_directory_facets')
      .select('country, guest_count, total_revenue, total_stays, repeat_guests, contactable_email, contactable_phone, arriving_30d')
      .limit(60),
    sb.schema('guest').rpc('directory_headline'),
    anonClient.schema('guest').from('mv_guest_profile')
      .select('guest_id', { count: 'exact', head: true })
      .eq('property_id', PROPERTY_ID).is('email', null).is('phone', null),
  ]);

  const headline = (headlineRows as Array<{
    total: number; repeat_guests: number; upcoming_total: number;
    next_7: number; next_30: number; next_90: number; contactable: number;
  }>)?.[0] ?? {
    total: 0, repeat_guests: 0, upcoming_total: 0, next_7: 0, next_30: 0, next_90: 0, contactable: 0,
  };
  const noContactCount = messyR.count ?? 0;

  return (
    <Page
      eyebrow="Guest · Directory"
      title={<>Guest <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>directory</em></>}
      subPages={GUEST_SUBPAGES}
    >
      {noContactCount > 0 && (
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: '#1f0e0c', border: '1px solid #5a2825', borderLeft: '3px solid #c0584c',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, color: 'var(--st-bad-bd)' }}>
            <strong style={{ color: '#fff' }}>{noContactCount.toLocaleString()}</strong>{' '}
            guest profile{noContactCount === 1 ? ' is' : 's are'} <em>unreachable</em> — no email + no phone.
          </div>
          <Link href="/guest/messy-data" style={{
            padding: '4px 10px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10,
            letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
            background: '#c0584c', color: '#fff',
            border: '1px solid #c0584c', borderRadius: 4, textDecoration: 'none',
          }}>
            OPEN MESSY DATA →
          </Link>
        </div>
      )}

      {/* Force dark-friendly text inside DirectoryShell (it uses Tailwind
          stone-* light tokens which are invisible on the dark canvas).
          Wrap in a div with the .gst-dir-dark class — see globals.css overrides. */}
      <div className="gst-dir-dark" style={{ marginTop: 14, color: 'var(--ink)' }}>
        <DirectoryShell facets={(facets as Parameters<typeof DirectoryShell>[0]['facets']) ?? []} headline={headline} />
      </div>
    </Page>
  );
}
