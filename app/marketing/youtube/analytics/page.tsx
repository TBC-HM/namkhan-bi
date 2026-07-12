// app/marketing/youtube/analytics/page.tsx
// PBS 2026-07-13 — Analytics · Channel Audit. Renders the latest Lens audit run
// with per-video grades + playlist verdicts + top wins/fixes. "Run new audit" button.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchChannel, isErr } from '@/lib/youtube/data';
import YtSubTabs from '../_shared/SubTabs';
import AnalyticsKPIs from '../_server/AnalyticsKPIs';
import RunAuditButton from './_client/RunAuditButton';

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
const RED    = '#B03826';
const OK     = '#0E7A4B';

interface RunRow {
  id: string;
  generated_at: string;
  model: string | null;
  video_count: number | null;
  overall_grade: string | null;
  channel_summary: string | null;
  brand_voice_notes: string | null;
  top_wins: string[] | null;
  top_fixes: string[] | null;
  playlist_verdicts: any;
}
interface VidRow {
  id: number;
  run_id: string;
  video_id: string;
  video_title: string | null;
  video_views: number | null;
  current_grade: string | null;
  title_verdict: string | null;
  suggested_title: string | null;
  description_verdict: string | null;
  suggested_description: string | null;
  tag_verdict: string | null;
  suggested_tags: string[] | null;
  playlist_fit_score: number | null;
  suggested_playlist: string | null;
  issues: any;
}

function gradeColor(g: string | null): string {
  const x = (g ?? '').toUpperCase();
  if (x === 'A') return OK;
  if (x === 'B') return FOREST;
  if (x === 'C') return AMBER;
  if (x === 'D' || x === 'F') return RED;
  return INK_M;
}

export default async function YtAnalyticsPage() {
  const sb = getSupabaseAdmin();

  // Historical analytics — token + channel identity for AnalyticsKPIs
  const tok = await getFreshAccessToken(NAMKHAN);
  let channelStats: { subs: number; views: number; videos: number; ok: boolean; access_token?: string } = { subs: 0, views: 0, videos: 0, ok: false };
  if (tok.ok && tok.access_token) {
    const ch = await fetchChannel(tok.access_token);
    if (!isErr(ch)) {
      channelStats = { subs: ch.data.subscriberCount, views: ch.data.viewCount, videos: ch.data.videoCount, ok: true, access_token: tok.access_token };
    }
  }

  const { data: latestRunRaw } = await sb
    .from('v_yt_channel_audit_runs')
    .select('*').eq('property_id', NAMKHAN).order('generated_at', { ascending: false }).limit(1).maybeSingle();
  const latest = (latestRunRaw as RunRow | null) ?? null;

  let videos: VidRow[] = [];
  if (latest?.id) {
    const { data } = await sb.from('v_yt_channel_audit_videos')
      .select('*').eq('run_id', latest.id).order('current_grade');
    videos = (data ?? []) as VidRow[];
  }

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));
  const cardStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, gridColumn: '1 / -1' };
  const sectionH: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };

  return (
    <DashboardPage title="YouTube · channel management" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="analytics" />

        {/* PBS 2026-07-13: historical analytics + KPI dashboard lives at top of Analytics tab.
            Falls back to a reconnect banner when the yt-analytics.readonly scope is missing. */}
        {channelStats.ok && channelStats.access_token && (
          <AnalyticsKPIs
            accessToken={channelStats.access_token}
            totalSubscribers={channelStats.subs}
            totalViews={channelStats.views}
            totalVideos={channelStats.videos}
          />
        )}

        {/* Header: latest run + button */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: INK, marginBottom: 4 }}>Lens · Channel Audit</div>
              <div style={{ fontSize: 12, color: INK_M, maxWidth: 640 }}>
                Lens reads every recent video + every playlist, grades each against Namkhan brand voice + the 8 content pillars + the vocabulary matrix, and returns per-video fixes.
              </div>
              {latest && (
                <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
                  Last run: {new Date(latest.generated_at).toISOString().slice(0, 16).replace('T', ' ')} UTC · {latest.video_count ?? '?'} videos · model {latest.model ?? '—'}
                </div>
              )}
            </div>
            <RunAuditButton />
          </div>
        </div>

        {!latest ? (
          <div style={{ ...cardStyle, background: CREAM }}>
            <div style={{ fontSize: 13, color: INK_S }}>
              No audit runs yet. Click <strong>Run audit</strong> above — Lens will inspect the channel, grade every video and every playlist, and store results here.
            </div>
          </div>
        ) : (
          <>
            {/* Overall grade + summary */}
            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em' }}>Overall</div>
                  <div style={{ fontSize: 60, fontWeight: 700, color: gradeColor(latest.overall_grade), lineHeight: 1 }}>{latest.overall_grade ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: INK, lineHeight: 1.55, marginBottom: 8 }}>{latest.channel_summary ?? '(no summary)'}</div>
                  {latest.brand_voice_notes && <div style={{ fontSize: 12, color: INK_S, lineHeight: 1.5 }}>{latest.brand_voice_notes}</div>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
                <div>
                  <div style={sectionH}>Top wins</div>
                  {(latest.top_wins ?? []).map((w, i) => <div key={i} style={{ fontSize: 12, color: INK, padding: '4px 0', borderBottom: `1px dashed ${HAIR}` }}>✓ {w}</div>)}
                </div>
                <div>
                  <div style={sectionH}>Top fixes</div>
                  {(latest.top_fixes ?? []).map((f, i) => <div key={i} style={{ fontSize: 12, color: INK, padding: '4px 0', borderBottom: `1px dashed ${HAIR}` }}>→ {f}</div>)}
                </div>
              </div>
            </div>

            {/* Playlist verdicts */}
            {Array.isArray(latest.playlist_verdicts) && latest.playlist_verdicts.length > 0 && (
              <div style={cardStyle}>
                <div style={sectionH}>Playlist verdicts ({latest.playlist_verdicts.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {(latest.playlist_verdicts as any[]).map((p, i) => (
                    <div key={i} style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.playlist_title ?? p.playlist_id}</div>
                        <span style={{ fontSize: 22, fontWeight: 700, color: gradeColor(p.current_grade) }}>{p.current_grade ?? '—'}</span>
                      </div>
                      <div style={{ fontSize: 10, color: INK_M, marginTop: 4, display: 'flex', gap: 10 }}>
                        <span>Coherence {p.thematic_coherence ?? '—'}/10</span>
                        <span>Performance {p.performance_score ?? '—'}/10</span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color:
                        p.verdict === 'keep' ? OK : p.verdict === 'kill' ? RED : AMBER,
                        fontWeight: 600 }}>{p.verdict ?? '—'}</div>
                      {p.notes && <div style={{ fontSize: 11, color: INK_S, marginTop: 6, lineHeight: 1.4 }}>{p.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-video audit table */}
            <div style={cardStyle}>
              <div style={sectionH}>Video-by-video audit ({videos.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {videos.map((v) => (
                  <div key={v.id} style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 40, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: gradeColor(v.current_grade), lineHeight: 1 }}>{v.current_grade ?? '—'}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <a href={`https://youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noreferrer noopener" style={{ fontSize: 13, fontWeight: 500, color: INK, textDecoration: 'none' }}>{v.video_title ?? v.video_id}</a>
                        <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>{v.video_views != null ? `${v.video_views.toLocaleString()} views` : ''}</div>
                        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 11, color: INK }}>
                          {v.title_verdict && <><span style={{ color: INK_M }}>Title</span><span>{v.title_verdict}</span></>}
                          {v.suggested_title && <><span style={{ color: INK_M }}>→ suggest</span><span style={{ color: FOREST }}>{v.suggested_title}</span></>}
                          {v.description_verdict && <><span style={{ color: INK_M }}>Desc</span><span>{v.description_verdict}</span></>}
                          {v.tag_verdict && <><span style={{ color: INK_M }}>Tags</span><span>{v.tag_verdict}</span></>}
                          {Array.isArray(v.suggested_tags) && v.suggested_tags.length > 0 && (
                            <><span style={{ color: INK_M }}>→ tags</span><span style={{ color: FOREST }}>{v.suggested_tags.join(', ')}</span></>
                          )}
                          {v.suggested_playlist && <><span style={{ color: INK_M }}>Playlist</span><span>fit {v.playlist_fit_score ?? '—'}/10 → <span style={{ color: FOREST }}>{v.suggested_playlist}</span></span></>}
                          {Array.isArray(v.issues) && v.issues.length > 0 && (
                            <><span style={{ color: INK_M }}>Flags</span><span style={{ color: RED }}>{v.issues.join(' · ')}</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardPage>
  );
}
