// app/marketing/social/page.tsx
// Marketing · Social channels.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import Insight from '@/components/sections/Insight';
import { getSocialAccounts } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google_business: 'Google Business',
  tripadvisor: 'TripAdvisor',
  booking: 'Booking.com',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X / Twitter',
  threads: 'Threads',
  pinterest: 'Pinterest',
};

function formatNum(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function SocialPage() {
  const accounts = await getSocialAccounts();

  const totalFollowers = accounts.reduce((sum: number, a: any) => sum + (a.followers ?? 0), 0);
  const totalPosts = accounts.reduce((sum: number, a: any) => sum + (a.posts ?? 0), 0);
  const synced = accounts.filter((a: any) => a.last_synced_at).length;

  return (
    <Page
      eyebrow="Marketing · Social"
      title={<>Social <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>presence</em>.</>}
      subPages={MARKETING_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={accounts.length}    unit="count" label="Active channels" />
        <KpiBox value={totalFollowers}     unit="count" label="Total followers" />
        <KpiBox value={totalPosts}         unit="count" label="Total posts" />
        <KpiBox value={null} unit="text" valueText={`${synced} / ${accounts.length}`} label="Auto-synced" tooltip="API · rest manual" />
      </div>

      <Panel title="Channels · all platforms" eyebrow="marketing.social_accounts" actions={<ArtifactActions context={{ kind: 'table', title: 'Social channels', dept: 'marketing' }} />}>
        {accounts.length === 0 ? (
          <div className="stub" style={{ padding: 32 }}>
            <h3>No accounts configured</h3>
            <p>Add accounts via SQL or Supabase dashboard.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Handle</th>
                <th className="num">Followers</th>
                <th className="num">Posts</th>
                <th>Last Synced</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a: any) => (
                <tr key={a.id}>
                  <td className="lbl"><strong>{PLATFORM_LABEL[a.platform] ?? a.platform}</strong></td>
                  <td className="lbl text-mute">{a.handle ?? '—'}</td>
                  <td className="num">{formatNum(a.followers)}</td>
                  <td className="num">{formatNum(a.posts)}</td>
                  <td className="lbl text-mute">{formatDate(a.last_synced_at)}</td>
                  <td>
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-mono"
                        style={{ color: 'var(--brass)', fontSize: "var(--t-sm)" }}
                      >
                        Open ↗
                      </a>
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div style={{ marginTop: 14 }}>
        <Insight tone="info" eye="Manual entry">
          <strong>Follower counts and last-synced timestamps are manual</strong> until platform APIs
          are wired (Phase 2). To update, run SQL on <em>marketing.social_accounts</em> or edit via
          the Supabase dashboard.
        </Insight>
      </div>
    </Page>
  );
}
