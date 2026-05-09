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
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X / Twitter',
  threads: 'Threads',
  pinterest: 'Pinterest',
};

// PBS 2026-05-09 #29: OTAs (booking, expedia, agoda) live under
// /sales/channels — they are NOT social. Filter them out here.
const NON_SOCIAL = new Set(['booking', 'booking_com', 'expedia', 'agoda', 'hostelworld']);

// PBS 2026-05-09 #31: brand-coloured pill before each platform name.
// Brand hex sourced from each platform's media kit, simplified to one
// dominant color per brand. Keeps the row scannable on the dark canvas.
const PLATFORM_TINT: Record<string, { bg: string; fg: string }> = {
  instagram:       { bg: '#E4405F', fg: '#fff' },
  facebook:        { bg: '#1877F2', fg: '#fff' },
  tiktok:          { bg: '#25F4EE', fg: '#000' },
  google_business: { bg: '#4285F4', fg: '#fff' },
  tripadvisor:     { bg: '#34E0A1', fg: '#000' },
  youtube:         { bg: '#FF0000', fg: '#fff' },
  linkedin:        { bg: '#0A66C2', fg: '#fff' },
  x:               { bg: '#000000', fg: '#fff' },
  threads:         { bg: '#101010', fg: '#fff' },
  pinterest:       { bg: '#E60023', fg: '#fff' },
};

function PlatformBadge({ platform }: { platform: string }) {
  const tint = PLATFORM_TINT[platform] ?? { bg: 'var(--ink-mute, #555)', fg: '#fff' };
  const label = PLATFORM_LABEL[platform] ?? platform;
  const initial = label.charAt(0).toUpperCase();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        aria-hidden
        style={{
          width: 18, height: 18, borderRadius: 4,
          background: tint.bg, color: tint.fg,
          fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
          fontSize: 11, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        {initial}
      </span>
      <strong>{label}</strong>
    </span>
  );
}

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
  const all = await getSocialAccounts();
  const accounts = all.filter((a: any) => !NON_SOCIAL.has(a.platform));

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
        <KpiBox value={accounts.length}    unit="count" label="Active channels" tooltip="Social channels with active=true (excludes OTAs). Source: marketing.social_accounts." />
        <KpiBox value={totalFollowers}     unit="count" label="Total followers" tooltip="Sum of followers across active channels. Manual until platform API sync wired." />
        <KpiBox value={totalPosts}         unit="count" label="Total posts"     tooltip="Sum of posts across active channels." />
        <KpiBox value={null} unit="text" valueText={`${synced} / ${accounts.length}`} label="Auto-synced" tooltip="Channels with last_synced_at populated · rest are manual entry." />
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
              </tr>
            </thead>
            <tbody>
              {accounts.map((a: any) => (
                <tr key={a.id}>
                  <td className="lbl">
                    {/* PBS 2026-05-09 #30: each platform now has its own
                        landing page; the badge links there, the handle
                        deep-links to the public profile. */}
                    <a
                      href={`/marketing/social/${encodeURIComponent(a.platform)}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <PlatformBadge platform={a.platform} />
                    </a>
                  </td>
                  <td className="lbl">
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--brass)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {a.handle ?? 'open ↗'} ↗
                      </a>
                    ) : (
                      <span className="text-mute">{a.handle ?? '—'}</span>
                    )}
                  </td>
                  <td className="num">{formatNum(a.followers)}</td>
                  <td className="num">{formatNum(a.posts)}</td>
                  <td className="lbl text-mute">{formatDate(a.last_synced_at)}</td>
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
