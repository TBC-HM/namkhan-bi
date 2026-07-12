// app/marketing/youtube/dashboard/page.tsx
// PBS 2026-07-13 — Dashboard sub-tab. Channel identity + AnalyticsKPIs + Recent uploads + Comments.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import Link from 'next/link';
import ChannelDashboard from '../_server/ChannelDashboard';
import YtSubTabs from '../_shared/SubTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;

export default async function YouTubeDashboardPage() {
  const sb = getSupabaseAdmin();
  const { data: connection } = await sb
    .from('v_yt_channel_connections')
    .select('id,channel_id,channel_title')
    .eq('property_id', NAMKHAN).eq('active', true).maybeSingle();

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));

  return (
    <DashboardPage title="YouTube · channel management" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="dashboard" />
        {connection ? (
          <ChannelDashboard propertyId={NAMKHAN} />
        ) : (
          <div style={{ gridColumn: '1 / -1', padding: 20, background: '#FFF9EA', border: '1px solid #E6DFCC', borderRadius: 4 }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>YouTube channel not connected.</div>
            <Link href={`/api/marketing/youtube/oauth-start?property_id=${NAMKHAN}`}
              style={{ display: 'inline-block', padding: '8px 14px', background: '#084838', color: '#fff', textDecoration: 'none', borderRadius: 3, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Connect YouTube
            </Link>
          </div>
        )}
      </div>
    </DashboardPage>
  );
}
