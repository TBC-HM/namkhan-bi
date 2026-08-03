// app/marketing/youtube/analytics/page.tsx
// PBS 2026-07-13 — Analytics · Channel Audit. Renders the latest Lens audit run
// with per-video grades + playlist verdicts + top wins/fixes. "Run new audit" button.
// Fix 2026-08-03: top-fixes rows now have CTA links (anchor to playlist or video section).
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchChannel, isErr } from '@/lib/youtube/data';
import YtSubTabs from '../_shared/SubTabs';
import AnalyticsKPIs from '../_server/AnalyticsKPIs';
import RunAuditButton from './_client/RunAuditButton';
import ApplyAuditButton from './_client/ApplyAuditButton';
import PlaylistVerdictActions from './_client/PlaylistVerdictActions';

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
  next_page_token: string | null;
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

function extractSuggestedTitle(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/rename(?:\s+(?:this\s+)?to)?\s+['\"'']([^'\"'']{3,})['\"'']/i);
  return m?.[1]?.trim() ?? null;
}

function gradeColor(g: string | null): string {
  const x = (g ?? '').toUpperCase();
  if (x === 'A') return OK;
  if (x === 'B') return FOREST;
  if (x === 'C') return AMBER;
  if (x === 'D' || x === 'F') return RED;
  return INK_M;
}

// Heuristic: does this fix relate to playlists or video-level changes?
function fixAnchor(fix: string): string {
  return /playlist/i.test(fix) ? '#playlist-verdicts' : '#video-audit';
}
function fixLabel(fix: string): string {
  return /playlist/i.test(fix) ? '↓ Playlists' : '↓ Videos';
}

export default async function YtAnalyticsPage() {
  const sb = getSupabaseAdmin();

  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }

  const tok = await getFreshAccessToken(NAMKHAN);
  let channelStats: { subs: number; views: number; videos: number; ok: boolean; access_token?: string; channel_id?: string } = { subs: 0, views: 0, videos: 0, ok: false };
  if (tok.ok && tok.access_token && tok.channel_id) {
    const ch = await fetchChannel(tok.access_token, tok.channel_id);
    if (!isErr(ch)) {
      channelStats = { subs: ch.data.subscriberCount, views: ch.data.viewCount, videos: ch.data.videoCount, ok: true, access_token: tok.access_token, channel_id: tok.channel_id };
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

  const { data: actionLogData } = await sb.from('yt_action_log')
    .select('entity_id, action, new_value')
    .eq('property_id', NAMKHAN).eq('entity_type', 'playlist');
  const doneMap = new Map((actionLogData ?? []).map(r => [r.entity_id, r.action + (r.new_value ? ' → ' + r.new_value : '')]));

  const { data: videoLogData } = await sb.from('yt_action_log')
    .select('entity_id')
    .eq('property_id', NAMKHAN).eq('entity_type', 'video').eq('action', 'applied');
  const addedByPlaylist = new Map<string, string[]>();
  for (const r of (actionLogData ?? [])) {
    if (r.action === 'video_added' && r.new_value) {
      const existing = addedByPlaylist.get(r.entity_id) ?? [];
      addedByPlaylist.set(r.entity_id, [...existing, r.new_value]);
    }
  }
  const appliedVideos = new Set((videoLogData ?? []).map(r => r.entity_id));

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));
  const cardStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, gridColumn: '1 / -1' };
  const sectionH: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };
  const ctaLink: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: FOREST, textDecoration: 'none',
    border: `1px solid ${FOREST}`, borderRadius: 2, padding: '2px 7px',
    whiteSpace: 'nowrap', flexShrink: 0,
  };

  return (
    <DashboardPage title="YouTube · channel management" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="analytics" />

        {channelStats.ok && channelStats.access_token && channelStats.channel_id && (
          <AnalyticsKPIs
            accessToken={channelStats.access_token}
            channelId={channelStats.channel_id}
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
            <RunAuditButton
              initialNextToken={latest?.next_page_token ?? null}
            />
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
                {/* Wins — no CTAs needed, already good */}
                <div>
                  <div style={sectionH}>Top wins</div>
                  {(latest.top_wins ?? []).map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: INK, padding: '6px 0', borderBottom: `1px dashed ${HAIR}` }}>
                      ✓ {w}
                    </div>
                  ))}
                </div>

                {/* Fixes — each row gets a jump CTA to the relevant section */}
                <div>
                  <div style={sectionH}>Top fixes</div>
                  {(latest.top_fixes ?? []).map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: `1px dashed ${HAIR}` }}>
                      <span style={{ fontSize: 12, color: INK }}>→ {f}</span>
                      <a href={fixAnchor(f)} style={ctaLink}>{fixLabel(f)}</a>
                    </div>
                  ))}
                  {(latest.top_fixes ?? []).length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: INK_M }}>
                      {videos.filter(v => v.current_grade && ['C','D','F'].includes(v.current_grade)).length} videos graded C or below · use Apply per row
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Playlist verdicts */}
            {Array.isArray(latest.playlist_verdicts) && latest.playlist_verdicts.length > 0 && (
              <div id="playlist-verdicts" style={cardStyle}>
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
                      <PlaylistVerdictActions
                        playlistId={p.playlist_id ?? ''}
                        verdict={p.verdict ?? ''}
                        currentTitle={p.playlist_title ?? p.playlist_id ?? ''}
                        suggestedTitle={p.verdict === 'rename' ? extractSuggestedTitle(p.notes) : null}
                        notes={p.notes}
                        initialAddedVideos={addedByPlaylist.get(p.playlist_id ?? '') ?? []}
                        initialDone={doneMap.has(p.playlist_id ?? '')}
                        initialAction={doneMap.get(p.playlist_id ?? '')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-video audit table */}
            <div id="video-audit" style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={sectionH}>Video-by-video audit ({videos.length})</div>
                <div style={{ fontSize: 11, color: INK_M }}>
                  {videos.filter(v => appliedVideos.has(v.video_id)).length} applied · {videos.filter(v => v.current_grade === 'A').length} already grade A
                </div>
              </div>
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
                      <div style={{ flexShrink: 0, paddingTop: 2 }}>
                        <ApplyAuditButton
                          videoId={v.video_id}
                          suggestedTitle={v.suggested_title}
                          suggestedDescription={v.suggested_description}
                          suggestedTags={v.suggested_tags}
                          currentGrade={v.current_grade}
                        initialApplied={appliedVideos.has(v.video_id)}
                        />
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
