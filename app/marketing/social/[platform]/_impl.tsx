// app/marketing/social/[platform]/page.tsx
// PBS 2026-07-23: YouTube + Threads dropped from SOCIAL_ALLOW (YouTube owns
//                 its own area under /marketing/digital; Threads not used).
//                 Direct hits to /marketing/social/youtube or /threads will
//                 now 404 as expected.
// PBS 2026-07-05: Migrated to new paper-white design (DashboardPage + KpiTile
// + MARKETING_SUBPAGES tabs). Same data source: marketing.social_accounts via
// getSocialAccounts().
// spec-social-media-module (2026-07-25, run 3) · A2 — landing enriched on the
// GBP pattern: per-channel guardrails (marketing.social_channel_rules),
// weekly content programs (marketing.social_programs), REAL recent posts from
// marketing.social_posts (placeholder retired), and the export queue feeding
// the A5 zip download. Insights panels stay as honest pending-integration
// placeholders until the per-channel APIs are granted.

import TenantLink from '@/components/nav/TenantLink';
import { notFound } from 'next/navigation';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSocialAccounts, getSocialChannelRules, getSocialPrograms } from '@/lib/marketing';
import { getSocialPostsForProperty } from '@/lib/marketing-social';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { MARKETING_SUBPAGES } from '../../_subpages';
import ProgramsPanel from './_programs-panel';

// Legacy /marketing/social/* surface is Namkhan-scoped by contract (§0.7);
// the tenant route delegates here until the module goes multi-property (§7).
const NAMKHAN_PID = 260955;

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
  'instagram', 'facebook', 'tiktok',
  'x', 'twitter', 'linkedin', 'pinterest',
]);

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  linkedin: 'LinkedIn', x: 'X / Twitter', twitter: 'X / Twitter', pinterest: 'Pinterest',
};

const HANDLE_TO_URL: Record<string, (h: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h.replace(/^@/, '')}/`,
  facebook:  (h) => `https://www.facebook.com/${h.replace(/^@/, '')}/`,
  tiktok:    (h) => `https://www.tiktok.com/@${h.replace(/^@/, '')}`,
  linkedin:  (h) => `https://www.linkedin.com/company/${h.replace(/^@/, '')}/`,
  x:         (h) => `https://x.com/${h.replace(/^@/, '')}`,
  twitter:   (h) => `https://x.com/${h.replace(/^@/, '')}`,
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

  const [all, rules, programs, allPosts, analyticsRes, boardsRes, postsMetricsRes] = await Promise.all([
    getSocialAccounts(),
    getSocialChannelRules(NAMKHAN_PID),
    getSocialPrograms(NAMKHAN_PID),
    getSocialPostsForProperty(NAMKHAN_PID),
    // PBS 2026-08-21 · Upload Post analytics snapshot per platform.
    getSupabaseAdmin()
      .from('v_upload_post_analytics_latest')
      .select('impressions, likes, comments, shares, reach, views, snapshot_date, raw')
      .eq('property_id', NAMKHAN_PID)
      .eq('platform', platform)
      .maybeSingle(),
    // PBS 2026-08-22 · Pinterest boards (via v_social_post_boards) — LIVE 11 boards.
    getSupabaseAdmin().from('v_social_post_boards')
      .select('board_id, board_name, pin_count')
      .eq('property_id', NAMKHAN_PID).eq('platform', platform)
      .order('board_name'),
    // PBS 2026-08-22 · Per-post metrics from Upload Post (getMedia + getCachedPostAnalytics).
    getSupabaseAdmin().from('v_social_posts_latest')
      .select('external_post_id, post_url, media_type, caption, posted_at, impressions, reach, views, likes, comments, shares, saves, pin_clicks, outbound_clicks, engagement_rate, raw')
      .eq('property_id', NAMKHAN_PID).eq('platform', platform)
      .order('posted_at', { ascending: false, nullsFirst: false })
      .limit(24),
  ]);
  const analytics = (analyticsRes?.data ?? null) as {
    impressions?: number | null; likes?: number | null; comments?: number | null;
    shares?: number | null; reach?: number | null; views?: number | null;
    snapshot_date?: string | null; raw?: Record<string, unknown> | null;
  } | null;
  // PBS 2026-08-22 · Boards + per-post metrics.
  const boards = (boardsRes?.data ?? []) as Array<{ board_id: string; board_name: string | null; pin_count: number | null }>;
  const postMetrics = (postsMetricsRes?.data ?? []) as Array<{
    external_post_id: string; post_url: string | null; media_type: string | null; caption: string | null;
    posted_at: string | null; impressions: number | null; reach: number | null; views: number | null;
    likes: number | null; comments: number | null; shares: number | null; saves: number | null;
    pin_clicks: number | null; outbound_clicks: number | null; engagement_rate: number | null;
    raw: Record<string, unknown> | null;
  }>;
  const dbRow = all.find((a: any) => a.platform.toLowerCase() === platform);
  const rule = rules.find((r) => r.platform === platform);
  const chanPrograms = programs.filter((p) => p.platform === platform);
  const posts = allPosts.filter((p) => p.platform === platform && p.status !== 'cancelled');
  const recentPosts = [...posts].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 8);
  const exportQueue = posts.filter((p) => p.status === 'ready' || p.status === 'scheduled');
  const openDrafts = posts.filter((p) => p.status === 'draft');
  const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

  // PBS 2026-08-21 · Analytics hydration from Upload Post snapshot.
  //   Followers pill prefers analytics.raw.followers if fresher than social_accounts.
  //   Engagement rate = (likes+comments+shares+saves) / impressions.
  //   Impressions + Reach tiles appear only when a snapshot exists.
  const aFollowers = Number((analytics?.raw as { followers?: number | string } | null)?.followers ?? NaN);
  const aSaves = Number((analytics?.raw as { saves?: number | string } | null)?.saves ?? 0);
  const aProfileViews = Number((analytics?.raw as { profileViews?: number | string } | null)?.profileViews ?? NaN);
  const followers = Number.isFinite(aFollowers) && aFollowers > 0
    ? aFollowers
    : Number(account.followers ?? 0);
  const engagementActs = (analytics?.likes ?? 0) + (analytics?.comments ?? 0) + (analytics?.shares ?? 0) + aSaves;
  const engagementRate = analytics?.impressions && analytics.impressions > 0
    ? (engagementActs / analytics.impressions) * 100
    : null;
  const snapshotFoot = analytics?.snapshot_date
    ? `snapshot ${analytics.snapshot_date} · upload_post_analytics`
    : 'awaiting insights API · pull /analytics/{platform}';

  const tiles: KpiTileProps[] = [
    { label: 'Followers',        value: followers.toLocaleString(), size: 'sm',
      footnote: aFollowers > 0 ? snapshotFoot : 'marketing.social_accounts' },
    { label: 'Impressions',      value: analytics?.impressions != null ? analytics.impressions.toLocaleString() : '—',
      size: 'sm', footnote: snapshotFoot },
    { label: 'Reach',            value: analytics?.reach != null ? analytics.reach.toLocaleString() : '—',
      size: 'sm', footnote: snapshotFoot },
    { label: 'Engagement rate',  value: engagementRate != null ? `${engagementRate.toFixed(2)}%` : '—',
      size: 'sm', footnote: engagementRate != null ? `${engagementActs} acts / ${analytics!.impressions!.toLocaleString()} imp` : snapshotFoot,
      status: engagementRate != null ? (engagementRate >= 3 ? 'green' : engagementRate >= 1 ? 'amber' : 'grey') : 'grey' },
    { label: 'Likes',            value: analytics?.likes != null ? analytics.likes.toLocaleString() : '—',
      size: 'sm', footnote: snapshotFoot },
    { label: 'Comments',         value: analytics?.comments != null ? analytics.comments.toLocaleString() : '—',
      size: 'sm', footnote: snapshotFoot },
    { label: 'Saves',            value: aSaves > 0 ? aSaves.toLocaleString() : '—',
      size: 'sm', footnote: snapshotFoot },
    { label: 'Profile views',    value: Number.isFinite(aProfileViews) ? aProfileViews.toLocaleString() : '—',
      size: 'sm', footnote: snapshotFoot },
    { label: 'Open drafts',      value: openDrafts.length, size: 'sm', footnote: 'marketing.social_posts' },
    { label: 'Ready to export',  value: exportQueue.length, size: 'sm', footnote: 'approved · awaiting upload' },
    { label: 'Total posts',      value: (account.posts ?? 0).toLocaleString(), size: 'sm', footnote: 'lifetime' },
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

        {/* Guardrails + weekly programs (marketing.social_channel_rules / social_programs) */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Section title="Output guardrails" note="settings › property › social_rules">
            {rule ? (
              <dl style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 8, columnGap: 14, fontSize: 13, margin: 0 }}>
                <dt style={dtSt}>Caption limit</dt>      <dd style={ddSt}>{rule.caption_max_chars != null ? `${rule.caption_max_chars.toLocaleString()} chars` : '—'}</dd>
                <dt style={dtSt}>Hashtags</dt>           <dd style={ddSt}>{rule.hashtags_allowed ? `up to ${rule.hashtag_max ?? '—'}` : 'not allowed'}</dd>
                <dt style={dtSt}>Formats</dt>            <dd style={ddSt}>{(rule.formats ?? []).length > 0 ? rule.formats.join(' · ') : '—'}</dd>
                <dt style={dtSt}>Posting frequency</dt>  <dd style={ddSt}>{rule.posting_frequency ?? '—'}</dd>
                <dt style={dtSt}>Audience</dt>           <dd style={ddSt}>{rule.audience_notes ?? '—'}</dd>
                <dt style={dtSt}>Banned topics</dt>      <dd style={ddSt}>{(rule.banned_topics ?? []).length > 0 ? rule.banned_topics.join(', ') : '—'}</dd>
                <dt style={dtSt}>Autonomy phase</dt>     <dd style={ddSt}>{rule.autonomy_phase} · {rule.active ? 'active' : 'parked'}</dd>
              </dl>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: INK_M }}>
                No guardrail row for {label} yet — add one in Property Settings → social_rules.
              </p>
            )}
          </Section>

          <Section title="Weekly content programs" note="marketing.social_programs">
            <ProgramsPanel propertyId={NAMKHAN_PID} platform={platform} initial={chanPrograms} />
          </Section>
        </div>

        {/* PBS 2026-08-22 · Pinterest Boards (LIVE from v_social_post_boards) */}
        {platform === 'pinterest' && boards.length > 0 && (
          <Section title="Pinterest Boards" note={`${boards.length} boards · pin to schedule from Quick Post`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {boards.map((b) => (
                <div key={b.board_id} style={{ padding: '10px 12px', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{b.board_name ?? b.board_id}</div>
                  <div style={{ fontSize: 10, color: INK_M }}>
                    {b.pin_count != null ? `${b.pin_count} pins` : 'board'}
                    {' · '}<span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{b.board_id.slice(0,12)}…</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* PBS 2026-08-22 · Live posts with metrics + visuals (LIVE from v_social_posts_latest) */}
        {postMetrics.length > 0 && (
          <Section title={`Published posts · ${label}`} note={`${postMetrics.length} recent · per-post metrics from Upload Post`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {postMetrics.map((pm) => {
                const raw = (pm.raw ?? {}) as Record<string, unknown>;
                const thumb = (raw.thumbnail_url ?? raw.media_url ?? raw.image_url ?? raw.picture ?? raw.cover_url) as string | undefined;
                return (
                  <div key={pm.external_post_id} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {thumb && (
                      <a href={pm.post_url ?? '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', paddingTop: '100%', background: `#F5F0E5 center/cover url(${thumb})` }} />
                    )}
                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 10.5, color: INK, lineHeight: 1.35 }}>
                        {pm.caption ? (pm.caption.length > 80 ? pm.caption.slice(0, 80) + '…' : pm.caption) : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: INK_M }}>
                        {pm.posted_at ? pm.posted_at.slice(0, 10) : ''}
                        {pm.media_type ? ` · ${pm.media_type}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: INK_S, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {pm.likes != null && <span>♥ {pm.likes}</span>}
                        {pm.comments != null && <span>💬 {pm.comments}</span>}
                        {pm.shares != null && <span>↻ {pm.shares}</span>}
                        {pm.saves != null && <span>⌘ {pm.saves}</span>}
                        {pm.pin_clicks != null && <span>◉ {pm.pin_clicks}</span>}
                        {pm.impressions != null && <span>👁 {pm.impressions}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

                {/* Recent posts + export queue */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Section title={`Recent posts · ${label}`} note="marketing.social_posts">
            {recentPosts.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                    <th style={thSt}>Date</th>
                    <th style={thSt}>Title</th>
                    <th style={thSt}>Caption</th>
                    <th style={{ ...thSt, textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPosts.map((p) => (
                    <tr key={p.post_id} style={{ borderBottom: `1px solid ${HAIR}` }}>
                      <td style={tdSt}>{(p.scheduled_at ?? p.created_at ?? '').slice(0, 10) || '—'}</td>
                      <td style={tdSt}>{p.title ?? '—'}</td>
                      <td style={tdMute}>{p.caption ? (p.caption.length > 80 ? p.caption.slice(0, 80) + '…' : p.caption) : '—'}</td>
                      <td style={{ ...tdSt, textAlign: 'right', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em', color: INK_M }}>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: INK_M }}>
                No {label} posts yet — generate a plan on the social calendar and accept slots to draft posts.
              </p>
            )}
          </Section>

          <Section title="Export queue" note="approved · awaiting upload">
            {exportQueue.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {exportQueue.slice(0, 6).map((p) => (
                  <div key={p.post_id} style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{p.title ?? '(untitled)'}</div>
                    <div style={{ fontSize: 10, color: INK_M }}>
                      {p.status}{p.scheduled_at ? ` · target ${p.scheduled_at.slice(0, 10)}` : ''}
                    </div>
                  </div>
                ))}
                <TenantLink href="/marketing/social?view=inbox" style={linkSt}>
                  Download as upload-ready zip in the inbox →
                </TenantLink>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: INK_M }}>
                Nothing approved yet — approve drafts in the{' '}
                <TenantLink href="/marketing/social?view=inbox" style={linkSt}>channel inbox</TenantLink>{' '}
                and they queue here for channel-formatted zip export.
              </p>
            )}
            <p style={{ margin: '10px 0 0', fontSize: 11, color: INK_M }}>
              Insights (reach, engagement, top post) stay pending until the {label} API integration is granted — no scraped numbers shown here.
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
