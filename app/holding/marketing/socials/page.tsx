// app/holding/marketing/socials/page.tsx
// Holding-level social marketing — cross-property view.
// Shows connected Upload Post accounts per property + recent posts.
// One Upload Post account; profile slugs: bc260955, bc1000001, bc{N}.
// Connect flow: POST /api/marketing/social/connect → redirect to authorize_url.

import { DashboardPage, Container, KpiTile } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ProfileRow {
  property_id: number;
  platform: string;
  up_user_id: string;
  display_name: string | null;
  handle: string | null;
  active: boolean;
}
interface PostRow {
  post_id: string;
  property_id: number;
  platform: string;
  title: string | null;
  status: string;
  scheduled_at: string | null;
  up_status: string | null;
}

const PROPERTY_NAMES: Record<number, string> = {
  260955:  'Namkhan',
  1000001: 'Donna',
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

const PLATFORM_ICON: Record<string, string> = {
  instagram: 'IG', facebook: 'FB', tiktok: 'TT', youtube: 'YT',
  linkedin: 'LI', x: 'X', pinterest: 'PI', google_business: 'GB',
};

export default async function HoldingSocialsPage() {
  const sb = getSupabaseAdmin();

  const [{ data: profiles }, { data: posts }] = await Promise.all([
    sb.rpc('fn_social_profiles_list', { p_property_id: null }),
    sb.from('v_social_posts_full')
      .select('post_id,property_id,platform,title,status,scheduled_at,up_status')
      .order('scheduled_at', { ascending: false })
      .limit(50),
  ]);

  const typedProfiles = (profiles ?? []) as ProfileRow[];
  const typedPosts    = (posts ?? []) as PostRow[];

  const connectedCount    = typedProfiles.length;
  const scheduledCount    = typedPosts.filter(p => p.status === 'scheduled').length;
  const pushedCount       = typedPosts.filter(p => p.status === 'pushed').length;
  const propertiesLinked  = new Set(typedProfiles.map(p => p.property_id)).size;

  const kpis: { label: string; value: string | number; sub?: string }[] = [
    { label: 'Connected accounts', value: connectedCount, sub: `${propertiesLinked} properties` },
    { label: 'Scheduled posts',    value: scheduledCount },
    { label: 'Published',          value: pushedCount },
    { label: 'Total drafts',       value: typedPosts.filter(p => p.status === 'draft').length },
  ];

  const CELL: React.CSSProperties = {
    padding: '10px 14px', borderBottom: '1px solid var(--hairline,#E6DFCC)',
    fontSize: 13, color: 'var(--ink,#1B1B1B)', whiteSpace: 'nowrap',
  };
  const TH: React.CSSProperties = {
    ...CELL, fontWeight: 600, color: 'var(--ink-mute,#5A5A5A)',
    background: 'var(--surf-2,#FAFAF7)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  return (
    <DashboardPage title="Marketing · Socials" sub="Cross-property social publishing">
      {/* KPI row */}
      <Container>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {kpis.map(k => (
            <KpiTile key={k.label} label={k.label} value={String(k.value)} sub={k.sub} />
          ))}
        </div>
      </Container>

      {/* Connected accounts per property */}
      <Container title="Connected accounts" style={{ marginTop: 24 }}>
        {typedProfiles.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute,#5A5A5A)', fontSize: 14 }}>
            No accounts connected yet. Use the Connect flow per property.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Property','Platform','Profile','Handle','Status'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {typedProfiles.map(p => (
                <tr key={`${p.property_id}-${p.platform}`}>
                  <td style={CELL}>{PROPERTY_NAMES[p.property_id] ?? `Property ${p.property_id}`}</td>
                  <td style={CELL}>{PLATFORM_ICON[p.platform] ?? p.platform}</td>
                  <td style={{ ...CELL, fontFamily: 'monospace', fontSize: 12 }}>{p.up_user_id}</td>
                  <td style={CELL}>{p.handle ?? p.display_name ?? '—'}</td>
                  <td style={CELL}>
                    <span style={{
                      background: p.active ? '#E6F4EA' : '#FEE',
                      color: p.active ? '#2D6A4F' : '#B04A2F',
                      borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                    }}>
                      {p.active ? 'Connected' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: '16px 0 4px', fontSize: 12, color: 'var(--ink-mute,#5A5A5A)' }}>
          To connect an account: <code style={{ fontSize: 11 }}>POST /api/marketing/social/connect</code> with <code style={{ fontSize: 11 }}>{'{ property_id, platform }'}</code> → open the returned authorize_url.
        </div>
      </Container>

      {/* Recent posts across all properties */}
      <Container title="Recent posts — all properties" style={{ marginTop: 24 }}>
        {typedPosts.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute,#5A5A5A)', fontSize: 14 }}>
            No posts yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Property','Platform','Title','Scheduled','Status','Upload Post'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {typedPosts.map(p => (
                <tr key={p.post_id}>
                  <td style={CELL}>{PROPERTY_NAMES[p.property_id] ?? `P${p.property_id}`}</td>
                  <td style={CELL}>{PLATFORM_ICON[p.platform] ?? p.platform}</td>
                  <td style={{ ...CELL, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.title ?? '—'}
                  </td>
                  <td style={CELL}>{fmtDate(p.scheduled_at)}</td>
                  <td style={CELL}>
                    <span style={{
                      background: p.status === 'pushed' ? '#E6F4EA' : p.status === 'draft' ? '#F5F0E1' : '#E8F0FE',
                      color: p.status === 'pushed' ? '#2D6A4F' : p.status === 'draft' ? '#5A5A5A' : '#1A56DB',
                      borderRadius: 4, padding: '2px 7px', fontSize: 12, fontWeight: 600,
                    }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ ...CELL, fontSize: 12, color: 'var(--ink-mute,#5A5A5A)' }}>
                    {p.up_status ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Container>
    </DashboardPage>
  );
}
