// app/marketing/social/[platform]/page.tsx
// PBS 2026-05-09 #30: "Make a landing page for every social media profile we
// have (like the other landing pages we have for channels f.e.)". Dynamic
// route that re-uses marketing.social_accounts as the data source.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSocialAccounts } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// PBS repair 2026-05-09 #4: strict 8-platform social allow-list. TripAdvisor
// and Google Business are review platforms — they live under /marketing/reviews
// not here. OTAs (Booking, Expedia) live under /sales/channels.
const SOCIAL_ALLOW = new Set([
  'instagram', 'facebook', 'tiktok', 'youtube',
  'x', 'twitter', 'linkedin', 'pinterest', 'threads',
]);

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X / Twitter',
  twitter: 'X / Twitter',
  threads: 'Threads',
  pinterest: 'Pinterest',
};

const PLATFORM_TINT: Record<string, { bg: string; fg: string }> = {
  instagram: { bg: '#E4405F', fg: '#fff' },
  facebook:  { bg: '#1877F2', fg: '#fff' },
  tiktok:    { bg: '#25F4EE', fg: '#000' },
  youtube:   { bg: '#FF0000', fg: '#fff' },
  linkedin:  { bg: '#0A66C2', fg: '#fff' },
  x:         { bg: '#000000', fg: '#fff' },
  twitter:   { bg: '#000000', fg: '#fff' },
  threads:   { bg: '#101010', fg: '#fff' },
  pinterest: { bg: '#E60023', fg: '#fff' },
};

// Public profile URL builders. Used when DB row has a handle but no URL,
// or when we want to deep-link from the platform name. We NEVER fabricate
// handles — these only run when a real handle string is present.
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

interface Props {
  params: { platform: string };
}

export default async function SocialPlatformPage({ params }: Props) {
  const platform = decodeURIComponent(params.platform).toLowerCase();

  // 404 on anything outside the 8-platform allow-list. Reviews platforms
  // and OTAs have their own surfaces.
  if (!SOCIAL_ALLOW.has(platform)) {
    notFound();
  }

  const all = await getSocialAccounts();
  const dbRow = all.find((a: any) => a.platform.toLowerCase() === platform);

  // If the DB has no row for this platform we still render the structure
  // (followers/posts/reach KPIs as em-dash, "Set handle" CTA in profile
  // panel) so the IA matches the channels-style landing page pattern.
  const account: any = dbRow ?? {
    id: `stub-${platform}`,
    platform,
    handle: null,
    url: null,
    display_name: null,
    followers: 0,
    posts: 0,
    last_synced_at: null,
    last_sync_status: null,
    last_sync_error: null,
    active: false,
    _stub: true,
  };

  const label = PLATFORM_LABEL[account.platform] ?? account.platform;
  const tint = PLATFORM_TINT[account.platform] ?? { bg: '#a8854a', fg: '#0a0a0a' };

  // Build a public profile URL: prefer stored URL, otherwise derive from
  // handle if we have one. NEVER fabricate from thin air.
  const builder = HANDLE_TO_URL[account.platform];
  const profileUrl: string | null =
    account.url ?? (account.handle && builder ? builder(account.handle) : null);

  const eyebrow = `Marketing · Social · ${label}`;
  const title = (
    <>
      {label} <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{account.handle ?? '—'}</em>
    </>
  );

  return (
    <Page eyebrow={eyebrow} title={title} subPages={MARKETING_SUBPAGES}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span aria-hidden style={{
          width: 36, height: 36, borderRadius: 8,
          background: tint.bg, color: tint.fg,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 18, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{label.charAt(0).toUpperCase()}</span>
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--brass)',
              border: '1px solid #2a2520',
              padding: '6px 12px',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Open public profile ↗
          </a>
        ) : (
          <a
            href="https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/editor"
            target="_blank"
            rel="noopener noreferrer"
            title="No handle stored — opens marketing.social_accounts in Supabase"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--brass-soft)',
              border: '1px dashed #2a2520',
              padding: '6px 12px',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Set handle ↗
          </a>
        )}
        <Link
          href="/marketing/social"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11, color: 'var(--ink-mute)', textDecoration: 'none',
          }}
        >
          ← all channels
        </Link>
      </div>

      {/* PBS repair 2026-05-09 #4: KPI strip mirrors the channels landing
          page — Followers / Engagement rate / Reach 30d / Posts 30d. We
          render em-dash for every metric we don't yet have wired (no
          insights API), with explicit "awaiting <source>" tooltips so PBS
          can see exactly which view needs to ship next. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox
          value={account.followers ?? 0}
          unit="count"
          label="Followers"
          tooltip={`Followers from marketing.social_accounts.followers. Manual until ${label} insights API is wired.`}
        />
        <KpiBox
          value={null}
          unit="text"
          valueText="—"
          label="Engagement rate"
          tooltip={`Awaiting marketing.v_social_engagement_30d (${label}). Not yet wired — manual entry only.`}
        />
        <KpiBox
          value={null}
          unit="text"
          valueText="—"
          label="Reach · 30d"
          tooltip={`Awaiting marketing.v_social_reach_30d (${label}). Not yet wired.`}
        />
        <KpiBox
          value={null}
          unit="text"
          valueText="—"
          label="Posts · 30d"
          tooltip={`Awaiting marketing.v_social_posts_30d (${label}). Total posts (lifetime) is on the Profile panel below.`}
        />
      </div>

      <Panel
        title="Profile"
        eyebrow="marketing.social_accounts"
        actions={<ArtifactActions context={{ kind: 'panel', title: `${label} profile`, dept: 'marketing' }} />}
      >
        <dl style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 8, columnGap: 14, fontSize: 13, margin: 0 }}>
          <dt style={S.dt}>Platform</dt>           <dd style={S.dd}>{label}</dd>
          <dt style={S.dt}>Handle</dt>             <dd style={S.dd}>{account.handle ?? '—'}</dd>
          <dt style={S.dt}>Display name</dt>       <dd style={S.dd}>{account.display_name ?? '—'}</dd>
          <dt style={S.dt}>URL</dt>
          <dd style={S.dd}>
            {profileUrl ? <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)' }}>{profileUrl}</a> : '—'}
          </dd>
          <dt style={S.dt}>Followers</dt>          <dd style={S.dd}>{(account.followers ?? 0).toLocaleString()}</dd>
          <dt style={S.dt}>Posts</dt>              <dd style={S.dd}>{(account.posts ?? 0).toLocaleString()}</dd>
          <dt style={S.dt}>Last sync</dt>          <dd style={S.dd}>{fmtDate(account.last_synced_at)}</dd>
          <dt style={S.dt}>Last sync status</dt>   <dd style={S.dd}>{account.last_sync_status ?? '—'}</dd>
          <dt style={S.dt}>Last sync error</dt>    <dd style={S.dd}>{account.last_sync_error ?? '—'}</dd>
          <dt style={S.dt}>Notes</dt>              <dd style={S.dd}>{(account as any).notes ?? '—'}</dd>
        </dl>
      </Panel>

      <div style={{ height: 14 }} />

      {/* PBS repair 2026-05-09 #4: Recent posts panel + Top performing post.
          Mirrors the channels landing page layout. Empty until a posts
          ingestion view exists; renders structure with em-dash + a clear
          "awaiting" hint so PBS can see the gap, not a blank screen. */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Panel
          title={`Recent posts · ${label}`}
          eyebrow="awaiting marketing.v_social_posts"
          actions={<ArtifactActions context={{ kind: 'table', title: `${label} recent posts`, dept: 'marketing' }} />}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Caption</th>
                <th className="num">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td className="lbl text-mute">—</td>
                  <td className="lbl text-mute">—</td>
                  <td className="lbl text-mute">awaiting marketing.v_social_posts ({label})</td>
                  <td className="num">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Top performing · 30d"
          eyebrow="awaiting marketing.v_social_top_post"
          actions={<ArtifactActions context={{ kind: 'panel', title: `${label} top post`, dept: 'marketing' }} />}
        >
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 6, fontSize: 13, margin: 0 }}>
            <dt style={S.dt}>Posted</dt><dd style={S.dd}>—</dd>
            <dt style={S.dt}>Type</dt><dd style={S.dd}>—</dd>
            <dt style={S.dt}>Caption</dt><dd style={S.dd}>—</dd>
            <dt style={S.dt}>Reach</dt><dd style={S.dd}>—</dd>
            <dt style={S.dt}>Engagement</dt><dd style={S.dd}>—</dd>
          </dl>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-mute)' }}>
            Wires up automatically once <em>marketing.v_social_top_post</em> is created and the {label} insights ingestion is live.
          </p>
        </Panel>
      </div>

      <div style={{ height: 14 }} />

      <Panel
        title="Content actions"
        eyebrow="quick links"
        actions={<ArtifactActions context={{ kind: 'panel', title: `${label} content actions`, dept: 'marketing' }} />}
      >
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--line-soft)', lineHeight: 1.7 }}>
          <li>
            <Link href={`/marketing/library?tag=${encodeURIComponent(account.platform)}`} style={S.link}>
              Browse media library tagged for {label} →
            </Link>
          </li>
          <li>
            <Link href={`/marketing/campaigns?channel=${encodeURIComponent(account.platform)}`} style={S.link}>
              Open {label} campaigns →
            </Link>
          </li>
          <li>
            <Link href="/marketing/social" style={S.link}>
              Back to all social channels →
            </Link>
          </li>
        </ul>
      </Panel>
    </Page>
  );
}

const S: Record<string, React.CSSProperties> = {
  dt: { color: '#7d7565', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.10em' },
  dd: { color: 'var(--ink)', margin: 0 },
  link: { color: 'var(--brass)', textDecoration: 'none', fontWeight: 600 },
};
