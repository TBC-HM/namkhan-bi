// app/marketing/youtube/dashboard/page.tsx
// PBS 2026-07-13 — Dashboard sub-tab. Channel identity + AnalyticsKPIs + Recent uploads + Comments.
// PBS 2026-07-13 pm — proactive fn_yt_refresh_if_expired at top of loader so PBS never has to reconnect.
// PBS 2026-07-21 — wrap fn_yt_refresh_if_expired in Promise.race with 8s timeout so a
// hung Google refresh never blocks page render (dashboard was hanging 2min).
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import Link from 'next/link';
import ChannelDashboard from '../_server/ChannelDashboard';
import YtSubTabs from '../_shared/SubTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const RPC_TIMEOUT_MS = 8000;

export default async function YouTubeDashboardPage() {
  const sb = getSupabaseAdmin();

  // Proactive auto-refresh of YT OAuth token via SECURITY DEFINER RPC.
  // No-op if token still valid; refreshes server-side using vault refresh_token + client creds.
  // Wrapped in Promise.race with 8s cap — the RPC uses pg_net which has its own timeout,
  // but a hung Google endpoint downstream shouldn't block the page loader.
  try {
    await Promise.race([
      sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('rpc_timeout_8s')), RPC_TIMEOUT_MS)),
    ]);
  } catch { /* silent */ }

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
