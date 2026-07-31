/* eslint-disable @next/next/no-img-element */
// app/marketing/youtube/videos/page.tsx
// v2: cumulative audit coverage — merges ALL audit runs (most recent verdict
// per video). Run the audit multiple times to cover all 177 videos progressively.
// Applied changes sink to the bottom of the list on next re-load.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchRecentVideos, isErr } from '@/lib/youtube/data';
import YtSubTabs from '../_shared/SubTabs';
import ApplyAuditButton from '../analytics/_client/ApplyAuditButton';
import RunAuditButton from '../analytics/_client/RunAuditButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const FOREST = '#084838'; const RED = '#B03826';
const AMBER = '#B48A3A'; const OK = '#0E7A4B'; const CREAM = '#F5F0E1';

const GRADE_ORDER: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };

function gradeColor(g: string | null) {
  if (g === 'A') return OK; if (g === 'B') return FOREST;
  if (g === 'C') return AMBER; if (g === 'D' || g === 'F') return RED;
  return INK_M;
}
function gradeBg(g: string | null) {
  if (g === 'A') return '#E8F5E9'; if (g === 'B') return '#E4F1E0';
  if (g === 'C') return '#FFF8E6'; if (g === 'D' || g === 'F') return '#FDECEA';
  return CREAM;
}
function gradeLabel(g: string | null) {
  if (g === 'A') return 'Optimized'; if (g === 'B') return 'Good';
  if (g === 'C') return 'Needs work'; if (g === 'D') return 'Urgent';
  if (g === 'F') return 'Critical'; return 'Not audited';
}

interface AuditRow {
  video_id: string; run_id: string;
  current_grade: string | null; title_verdict: string | null;
  suggested_title: string | null; description_verdict: string | null;
  suggested_description: string | null; suggested_tags: string[] | null;
  suggested_playlist: string | null; playlist_fit_score: number | null;
  issues: string[] | null;
}

export default async function YtVideosPage() {
  const sb = getSupabaseAdmin();
  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }

  const tok = await getFreshAccessToken(NAMKHAN);
  const tabs = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href }));

  if (!tok.ok || !tok.access_token || !tok.channel_id) {
    return (
      <DashboardPage title="YouTube · Videos" tabs={tabs}>
        <div style={{ padding: 24, background: '#FDECEA', border: `1px solid ${RED}`, borderRadius: 4, color: RED, fontSize: 13 }}>
          Session expired — reconnect YouTube on the Dashboard tab.
        </div>
      </DashboardPage>
    );
  }

  // Fetch all 200 channel videos + ALL audit results (cumulative, all runs)
  const [vidRes, allRunsRes, allAuditRes] = await Promise.all([
    fetchRecentVideos(tok.access_token, tok.channel_id, 200),
    sb.from('v_yt_channel_audit_runs')
      .select('id, generated_at, video_count, overall_grade')
      .eq('property_id', NAMKHAN)
      .order('generated_at', { ascending: false }),
    sb.from('v_yt_channel_audit_videos')
      .select('video_id, run_id, current_grade, title_verdict, suggested_title, description_verdict, suggested_description, suggested_tags, suggested_playlist, playlist_fit_score, issues'),
  ]);

  const videos = isErr(vidRes) ? [] : (Array.isArray(vidRes.data) ? vidRes.data : []);
  const runs = (allRunsRes.data ?? []) as Array<{ id: string; generated_at: string; video_count: number | null; overall_grade: string | null }>;
  const latestRun = runs[0] ?? null;

  // Build run date map for recency comparison
  const runDateMap = new Map<string, string>();
  for (const r of runs) runDateMap.set(r.id, r.generated_at);

  // Build cumulative auditMap: most recent verdict per video_id across ALL runs
  const auditMap = new Map<string, AuditRow>();
  for (const row of (allAuditRes.data ?? []) as AuditRow[]) {
    const existing = auditMap.get(row.video_id);
    if (!existing) {
      auditMap.set(row.video_id, row);
    } else {
      const existDate = runDateMap.get(existing.run_id) ?? '';
      const newDate = runDateMap.get(row.run_id) ?? '';
      if (newDate > existDate) auditMap.set(row.video_id, row);
    }
  }

  // Merge and sort: worst grade first, unaudited after graded, A/B at bottom
  const merged = videos.map(v => ({ ...v, audit: auditMap.get(v.id) ?? null }));
  merged.sort((a, b) => {
    const ag = a.audit?.current_grade ?? null;
    const bg = b.audit?.current_grade ?? null;
    const ao = ag != null ? (GRADE_ORDER[ag] ?? 99) : 3.5;
    const bo = bg != null ? (GRADE_ORDER[bg] ?? 99) : 3.5;
    return ao - bo;
  });

  const audited = merged.filter(v => v.audit?.current_grade).length;
  const total = videos.length;
  const optimized = merged.filter(v => v.audit?.current_grade === 'A' || v.audit?.current_grade === 'B').length;
  const urgent = merged.filter(v => v.audit?.current_grade === 'D' || v.audit?.current_grade === 'F').length;

  function bestThumb(t: typeof videos[0]['thumbnails'] | undefined): string | null {
    return t?.maxres?.url ?? t?.standard?.url ?? t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null;
  }

  return (
    <DashboardPage title="YouTube · Videos" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="videos" />

        {/* Progress + Run button */}
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 6 }}>
              Audit coverage: {audited} of {total} videos
            </div>
            <div style={{ height: 6, background: HAIR, borderRadius: 3, width: 280, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(audited / Math.max(total, 1) * 100)}%`, background: FOREST, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: INK_M, marginTop: 6 }}>
              Each audit run covers 25 videos · {runs.length} run{runs.length === 1 ? '' : 's'} completed
              {latestRun ? ` · last run ${new Date(latestRun.generated_at).toISOString().slice(0, 16).replace('T', ' ')} UTC · overall ${latestRun.overall_grade ?? '—'}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <RunAuditButton />
            <div style={{ fontSize: 10, color: INK_M, textAlign: 'right', maxWidth: 200 }}>
              Audits 25 most recent unreviewed videos. Run multiple times to cover all {total}.
            </div>
          </div>
        </div>

        {/* Summary tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {[
            { label: 'Total', value: total, color: INK },
            { label: 'Audited', value: audited, color: FOREST },
            { label: 'Optimized A/B', value: optimized, color: OK },
            { label: 'Needs work C', value: merged.filter(v => v.audit?.current_grade === 'C').length, color: AMBER },
            { label: 'Urgent D/F', value: urgent, color: RED },
            { label: 'Not audited', value: total - audited, color: INK_M },
          ].map(t => (
            <div key={t.label} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: INK_M, marginBottom: 3 }}>{t.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.color, fontVariantNumeric: 'tabular-nums' }}>{t.value}</div>
            </div>
          ))}
        </div>

        {/* Video list */}
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${HAIR}`, fontSize: 12, fontWeight: 600, color: INK }}>
            All videos · sorted worst grade first · applied changes sink to bottom after next audit
          </div>
          {merged.map(v => {
            const audit = v.audit;
            const grade = audit?.current_grade ?? null;
            const thumb = bestThumb(v.thumbnails);
            return (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '88px 1fr auto', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${HAIR}`, alignItems: 'flex-start' }}>
                {/* Thumb */}
                <div style={{ width: 88, height: 50, background: CREAM, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                  {thumb
                    ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: INK_M }}>No thumb</div>}
                </div>

                {/* Content */}
                <div>
                  <a href={'https://youtube.com/watch?v=' + v.id} target="_blank" rel="noreferrer noopener"
                    style={{ fontSize: 12.5, fontWeight: 500, color: INK, textDecoration: 'none', display: 'block', marginBottom: 3, lineHeight: 1.3 }}>
                    {v.title ?? v.id}
                  </a>
                  <div style={{ fontSize: 10, color: INK_M, marginBottom: 5 }}>
                    {v.views != null ? v.views.toLocaleString() + ' views' : ''}{v.publishedAt ? ' · ' + v.publishedAt.slice(0, 10) : ''}
                  </div>
                  {audit ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontSize: 11 }}>
                      {audit.title_verdict && <><span style={{ color: INK_M, whiteSpace: 'nowrap' }}>Title</span><span style={{ color: INK }}>{audit.title_verdict}</span></>}
                      {audit.suggested_title && <><span style={{ color: INK_M }}>→</span><span style={{ color: FOREST, fontWeight: 500 }}>{audit.suggested_title}</span></>}
                      {audit.description_verdict && <><span style={{ color: INK_M, whiteSpace: 'nowrap' }}>Desc</span><span style={{ color: INK }}>{audit.description_verdict}</span></>}
                      {audit.suggested_description && <><span style={{ color: INK_M }}>→</span><span style={{ color: FOREST, fontWeight: 500, display: '-webkit-box', overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{audit.suggested_description}</span></>}
                      {audit.suggested_playlist && <><span style={{ color: INK_M, whiteSpace: 'nowrap' }}>Playlist</span><span style={{ color: AMBER }}>fit {audit.playlist_fit_score ?? '—'}/10 → {audit.suggested_playlist}</span></>}
                      {Array.isArray(audit.issues) && audit.issues.length > 0 && <><span style={{ color: INK_M }}>Flags</span><span style={{ color: RED, fontSize: 10 }}>{audit.issues.join(' · ')}</span></>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: INK_M, fontStyle: 'italic' }}>Not yet audited — press "Run audit" above to include this video.</div>
                  )}
                </div>

                {/* Grade + Apply */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 80 }}>
                  <div style={{ textAlign: 'center', padding: '3px 8px', background: gradeBg(grade), border: `1px solid ${HAIR}`, borderRadius: 3, minWidth: 52 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: gradeColor(grade), lineHeight: 1 }}>{grade ?? '?'}</div>
                    <div style={{ fontSize: 8, color: gradeColor(grade), fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{gradeLabel(grade)}</div>
                  </div>
                  {audit && (
                    <ApplyAuditButton
                      videoId={v.id}
                      suggestedTitle={audit.suggested_title}
                      suggestedDescription={audit.suggested_description}
                      suggestedTags={audit.suggested_tags}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardPage>
  );
}
