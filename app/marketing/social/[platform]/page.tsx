// app/marketing/social/[platform]/page.tsx
// PBS 2026-07-05: Migrated to new paper-white design (DashboardPage + KpiTile
// + MARKETING_SUBPAGES tabs). Same data source: marketing.social_accounts via
// getSocialAccounts(). 8-platform allow-list preserved.

import TenantLink from '@/components/nav/TenantLink';
import { notFound } from 'next/navigation';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSocialAccounts } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#084838';
const CREAM = '#F5F0E1';

const SOCIAL_ALLOW = new Set([
  'instagram', 'facebook', 'tiktok', 'youtube',
  'x', 'twitter', 'linkedin', 'pinterest', 'threads',
]);

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube',
  linkedin: 'LinkedIn', x: 'X / Twitter', twitter: 'X / Twitter', threads: 'Threads', pinterest: 'Pinterest',
};

const HANDLE_TO_URL: Record<string, (h: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h.replace(/^@/, '')}/`,
  facebook:  (h) => `https://www.facebook.com/${h.replace(/^@/, '')}/`,
  tiktok:    (h) => `https://www.tiktok.com/@${h.replace(/^@/, '')}`,
  youtube:   (h) => h.startsWith('@') ? `https://www.youtube.com/${h}` : `https://www.youtube.com/@${h}`,
  linkedin:  (h) => `https://www.linkedin.com/company/${h.replace(/^@/, '')}/`,
  x:         (h) => `https://x.com/${h.replace(/^@/, '')}`,
  twitter:   (h) => `https://x.com/${h.replace(/^@/, '')}`,
  threads:   (h) => `https://www.threads.net/@${h.replace(/^@/, '')}`,
  pinterest: (h) => `https://www.pinterest.com/${h.replace(/^@/, '')}/`,
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Props { params: { platform: string } }

export default async function SocialPlatformPage({ params }: Props) {
  const platform = decodeURIComponent(params.platform).toLowerCase();
  if (!SOCIAL_ALLOW.has(platform)) notFound();

  const all = await getSocialAccounts();
  const dbRow = all.find((a: any) => a.platform.toLowerCase() === platform);

  const account: any = dbRow ?? {
    id: `stub-${platform}`, platform, handle: null, url: null, display_name: null,
    followers: 0, posts: 0, last_synced_at: null, last_sync_status: null, last_sync_error: null,
    active: false, _stub: true,
  };

  const label = PLATFORM_LABEL[account.platform] ?? account.platform;
  const builder = HANDLE_TO_URL[account.platform];
  const profileUrl: string | null =
    account.url ?? (account.handle && builder ? builder(account.handle) : null);

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/social',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Followers',       value: (account.followers ?? 0).toLocaleString(), size: 'sm', footnote: 'marketing.social_accounts' },
    { label: 'Engagement rate', value: '—', size: 'sm', footnote: 'awaiting insights API' },
    { label: 'Reach · 30d',     value: '—', size: 'sm', footnote: 'awaiting insights API' },
    { label: 'Posts · 30d',     value: '—', size: 'sm', footnote: 'lifetime below' },
    { label: 'Total posts',     value: (account.posts ?? 0).toLocaleString(), size: 'sm', footnote: 'lifetime' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title={`Marketing · Social · ${label}`}
        subtitle={`${account.handle ?? 'handle not set'} · profile detail from marketing.social_accounts`}
        tabs={tabs}
      >
        {/* Header row: profile link + back link */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {profileUrl ? (
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={btnPrimary}>
              Open public profile →
            </a>
          ) : (
            <a href="https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/editor"
               target="_blank" rel="noopener noreferrer" style={btnSecondary}>
              Set handle →
            </a>
          )}
          <TenantLink href="/marketing/social" style={{ ...btnGhost, textDecoration: 'none' }}>
            ← all channels
          </TenantLink>
        </div>

        {/* KPI band */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Profile panel */}
        <Section title="Profile" note="marketing.social_accounts">
          <dl style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 8, columnGap: 14, fontSize: 13, margin: 0 }}>
            <dt style={dtSt}>Platform</dt>           <dd style={ddSt}>{label}</dd>
            <dt style={dtSt}>Handle</dt>             <dd style={ddSt}>{account.handle ?? '—'}</dd>
            <dt style={dtSt}>Display name</dt>       <dd style={ddSt}>{account.display_name ?? '—'}</dd>
            <dt style={dtSt}>URL</dt>
            <dd style={ddSt}>
              {profileUrl ? <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={{ color: FOREST }}>{profileUrl}</a> : '—'}
            </dd>
            <dt style={dtSt}>Followers</dt>          <dd style={ddSt}>{(account.followers ?? 0).toLocaleString()}</dd>
            <dt style={dtSt}>Posts</dt>              <dd style={ddSt}>{(account.posts ?? 0).toLocaleString()}</dd>
            <dt style={dtSt}>Last sync</dt>          <dd style={ddSt}>{fmtDate(account.last_synced_at)}</dd>
            <dt style={dtSt}>Last sync status</dt>   <dd style={ddSt}>{account.last_sync_status ?? '—'}</dd>
            <dt style={dtSt}>Last sync error</dt>    <dd style={ddSt}>{account.last_sync_error ?? '—'}</dd>
            <dt style={dtSt}>Notes</dt>              <dd style={ddSt}>{(account as any).notes ?? '—'}</dd>
          </dl>
        </Section>

        {/* Recent posts + Top performing */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Section title={`Recent posts · ${label}`} note="awaiting marketing.v_social_posts">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                  <th style={thSt}>Date</th>
                  <th style={thSt}>Type</th>
                  <th style={thSt}>Caption</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>Engagement</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${HAIR}` }}>
                    <td style={tdMute}>—</td>
                    <td style={tdMute}>—</td>
                    <td style={tdMute}>awaiting marketing.v_social_posts ({label})</td>
                    <td style={{ ...tdSt, textAlign: 'right', color: INK_M }}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Top performing · 30d" note="awaiting marketing.v_social_top_post">
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 6, fontSize: 13, margin: 0 }}>
              <dt style={dtSt}>Posted</dt><dd style={ddSt}>—</dd>
              <dt style={dtSt}>Type</dt><dd style={ddSt}>—</dd>
              <dt style={dtSt}>Caption</dt><dd style={ddSt}>—</dd>
              <dt style={dtSt}>Reach</dt><dd style={ddSt}>—</dd>
              <dt style={dtSt}>Engagement</dt><dd style={ddSt}>—</dd>
            </dl>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: INK_M }}>
              Wires up automatically once <em>marketing.v_social_top_post</em> is created and the {label} insights ingestion is live.
            </p>
          </Section>
        </div>

        {/* Content actions */}
        <Section title="Content actions" note="quick links">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: INK_S, lineHeight: 1.7 }}>
            <li>
              <TenantLink href={`/marketing/library?tag=${encodeURIComponent(account.platform)}`} style={linkSt}>
                Browse media library tagged for {label} →
              </TenantLink>
            </li>
            <li>
              <TenantLink href={`/marketing/campaigns?channel=${encodeURIComponent(account.platform)}`} style={linkSt}>
                Open {label} campaigns →
              </TenantLink>
            </li>
            <li>
              <TenantLink href="/marketing/social" style={linkSt}>
                Back to all social channels →
              </TenantLink>
            </li>
          </ul>
        </Section>
      </DashboardPage>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{title}</div>
        {note && <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M }}>{note}</div>}
      </div>
      {children}
    </div>
  );
}

const dtSt: React.CSSProperties = { color: INK_M, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 };
const ddSt: React.CSSProperties = { color: INK, margin: 0 };
const thSt: React.CSSProperties = { textAlign: 'left', padding: '8px 6px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M, fontWeight: 600 };
const tdSt: React.CSSProperties = { padding: '6px', color: INK };
const tdMute: React.CSSProperties = { padding: '6px', color: INK_M };
const linkSt: React.CSSProperties = { color: FOREST, textDecoration: 'none', fontWeight: 600 };
const btnPrimary: React.CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 4, textDecoration: 'none' };
const btnSecondary: React.CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 600, background: WHITE, color: FOREST, border: `1px dashed ${FOREST}`, borderRadius: 4, textDecoration: 'none' };
const btnGhost: React.CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 500, color: INK_M, borderRadius: 4 };
