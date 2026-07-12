// app/marketing/youtube/planning/page.tsx
// PBS 2026-07-13 — Planning sub-tab: programs (pillars) + trend briefs + scheduled + recently published.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import YtSubTabs from '../_shared/SubTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#B48A3A';

interface PubRow { publication_id: string; title: string | null; scheduled_publish_utc: string | null; actual_publish_utc: string | null; youtube_video_id: string | null }
interface BriefRow { brief_id: string; generated_at_utc: string | null; activation_score: number | null; keyword_seeds: string[] | null }

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return String(d); }
}

export default async function YouTubePlanningPage() {
  const sb = getSupabaseAdmin();
  const [pillarsRes, pubsRes, briefsRes] = await Promise.all([
    sb.from('v_yt_content_pillars')
      .select('id,pillar_key,label,description,target_cadence,youtube_playlist_id,sort_order')
      .eq('property_id', NAMKHAN).eq('active', true).order('sort_order'),
    sb.from('v_yt_publications')
      .select('publication_id,title,scheduled_publish_utc,actual_publish_utc,youtube_video_id')
      .eq('property_id', NAMKHAN).order('created_at', { ascending: false }).limit(40),
    sb.from('v_yt_trend_briefs')
      .select('brief_id,generated_at_utc,activation_score,keyword_seeds')
      .eq('property_id', NAMKHAN).order('generated_at_utc', { ascending: false }).limit(10),
  ]);
  const pillars = (pillarsRes.data ?? []) as Array<{ id: string; pillar_key: string; label: string; description: string | null; target_cadence: string | null; youtube_playlist_id: string | null }>;
  const pubs = (pubsRes.data ?? []) as PubRow[];
  const briefs = (briefsRes.data ?? []) as BriefRow[];
  const now = Date.now();
  const scheduled = pubs.filter((p) => p.scheduled_publish_utc && !p.actual_publish_utc && new Date(p.scheduled_publish_utc).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_publish_utc!).getTime() - new Date(b.scheduled_publish_utc!).getTime());
  const recent = pubs.filter((p) => p.actual_publish_utc)
    .sort((a, b) => new Date(b.actual_publish_utc!).getTime() - new Date(a.actual_publish_utc!).getTime())
    .slice(0, 10);

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));

  const cardStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, gridColumn: '1 / -1' };
  const sectionH: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };

  return (
    <DashboardPage title="YouTube · channel management" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="planning" />

        {/* Programs / pillars */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ ...sectionH, marginBottom: 0 }}>Content programs ({pillars.length})</div>
            <div style={{ fontSize: 11, color: INK_M }}>Planned series &amp; target cadence</div>
          </div>
          {pillars.length === 0 ? <div style={{ fontSize: 13, color: INK_M }}>No programs defined.</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {pillars.map((p) => (
                <div key={p.id} style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 12, background: WHITE }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontSize: 13, color: INK, fontWeight: 600 }}>{p.label}</div>
                    <span style={{
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', padding: '2px 6px', borderRadius: 2, fontWeight: 600,
                      background: p.target_cadence === 'weekly' ? '#E8F0EC' : CREAM,
                      color: p.target_cadence === 'weekly' ? FOREST : INK_S, whiteSpace: 'nowrap',
                    }}>{p.target_cadence ?? 'ad hoc'}</span>
                  </div>
                  {p.description && <div style={{ fontSize: 11, color: INK_M, marginTop: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>}
                  <div style={{ marginTop: 8, fontSize: 11, color: p.youtube_playlist_id ? FOREST : AMBER }}>
                    {p.youtube_playlist_id ? '🎬 playlist linked' : '⚠ no playlist linked'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trend briefs */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ ...sectionH, marginBottom: 0 }}>Research briefs ({briefs.length})</div>
            <form method="POST" action={`/api/marketing/youtube/scan-trends`}>
              <button type="submit" style={{ padding: '6px 12px', fontSize: 11, background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Scan trends
              </button>
            </form>
          </div>
          {briefs.length === 0 ? (
            <div style={{ fontSize: 13, color: INK_M }}>No briefs yet. Click Scan trends to generate one.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK_M, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>Generated</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK_M, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>Seeds</th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK_M, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>Score</th>
              </tr></thead>
              <tbody>{briefs.map((b) => (
                <tr key={b.brief_id}>
                  <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK }}>{fmtDate(b.generated_at_utc)}</td>
                  <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK_M }}>{(b.keyword_seeds ?? []).join(', ')}</td>
                  <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK, textAlign: 'right' }}>{b.activation_score ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {/* Scheduled / recent */}
        <div style={cardStyle}>
          <div style={sectionH}>Upcoming ({scheduled.length}) · Recently published ({recent.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: INK_M, marginBottom: 6 }}>Upcoming</div>
              {scheduled.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>Nothing scheduled.</div> : scheduled.map((p) => (
                <div key={p.publication_id} style={{ fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${HAIR}` }}>
                  <span style={{ color: FOREST }}>{fmtDate(p.scheduled_publish_utc)}</span> · {p.title ?? '(untitled)'}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: INK_M, marginBottom: 6 }}>Recently published</div>
              {recent.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>None yet.</div> : recent.map((p) => (
                <div key={p.publication_id} style={{ fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${HAIR}` }}>
                  <span style={{ color: INK_M }}>{fmtDate(p.actual_publish_utc)}</span> · {p.youtube_video_id ? (
                    <a href={`https://youtube.com/watch?v=${p.youtube_video_id}`} target="_blank" rel="noreferrer noopener" style={{ color: FOREST }}>{p.title ?? '(untitled)'}</a>
                  ) : (p.title ?? '(untitled)')}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
