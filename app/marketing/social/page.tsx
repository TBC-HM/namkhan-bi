// app/marketing/social/page.tsx

import { getSocialAccounts } from '@/lib/marketing';

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
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default async function SocialPage() {
  const accounts = await getSocialAccounts();

  const totalFollowers = accounts.reduce((sum, a) => sum + (a.followers ?? 0), 0);
  const synced = accounts.filter(a => a.last_synced_at).length;

  return (
    <>
      <div className="kpi-strip cols-3">
        <div className="kpi-tile">
          <div className="kpi-label">Active Channels</div>
          <div className="kpi-value">{accounts.length}</div>
          <div className="kpi-deltas">configured platforms</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Total Followers</div>
          <div className="kpi-value">{formatNum(totalFollowers)}</div>
          <div className="kpi-deltas">across all platforms (manual entry)</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Auto-Synced</div>
          <div className="kpi-value">{synced} / {accounts.length}</div>
          <div className="kpi-deltas">via API · rest manual</div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Channels</div>
          <div className="section-tag">click handle to open profile</div>
        </div>
        {accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No accounts configured</div>
            <div className="empty-body">Add accounts via SQL or Supabase dashboard.</div>
          </div>
        ) : (
          <table>
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
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="label">{PLATFORM_LABEL[a.platform] ?? a.platform}</td>
                  <td>{a.handle ?? <span className="muted">—</span>}</td>
                  <td className="num">{formatNum(a.followers)}</td>
                  <td className="num">{formatNum(a.posts)}</td>
                  <td className="muted">{formatDate(a.last_synced_at)}</td>
                  <td>
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="link-out">
                        Open ↗
                      </a>
                    ) : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Editing</div>
        </div>
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
          Follower counts and last-synced timestamps are manual until platform APIs are connected (Phase 2).
          To update an account, run SQL on the <code>marketing.social_accounts</code> table or edit via Supabase dashboard.
        </div>
      </div>
    </>
  );
}
