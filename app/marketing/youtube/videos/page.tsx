// app/marketing/youtube/videos/page.tsx
// All-videos optimization status. Merges YouTube API (live, up to 200 videos)
// with latest Lens audit results (DB). Shows every video's optimization grade.
// Sorted: unoptimized (D/F) first, then C, B, A, then unaudited.
// "Optimized" = grade A or B. Once accepted+applied → grade improves on next audit.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchRecentVideos, isErr } from '@/lib/youtube/data';
import YtSubTabs from '../_shared/SubTabs';
import ApplyAuditButton from '../analytics/_client/ApplyAuditButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const FOREST = '#084838'; const RED = '#B03826';
const AMBER = '#B48A3A'; const OK = '#0E7A4B'; const CREAM = '#F5F0E1';

const GRADE_ORDER: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };

function gradeColor(g: string | null): string {
  if (g === 'A') return OK;
  if (g === 'B') return FOREST;
  if (g === 'C') return AMBER;
  if (g === 'D' || g === 'F') return RED;
  return INK_M;
}

function gradeBg(g: string | null): string {
  if (g === 'A') return '#E8F5E9';
  if (g === 'B') return '#E4F1E0';
  if (g === 'C') return '#FFF8E6';
  if (g === 'D' || g === 'F') return '#FDECEA';
  return CREAM;
}

function gradeLabel(g: string | null): string {
  if (g === 'A') return 'Optimized';
  if (g === 'B') return 'Good';
  if (g === 'C') return 'Needs work';
  if (g === 'D') return 'Urgent';
  if (g === 'F') return 'Critical';
  return 'Not audited';
}

interface AuditRow {
  video_id: string;
  current_grade: string | null;
  title_verdict: string | null;
  suggested_title: string | null;
  description_verdict: string | null;
  suggested_description: string | null;
  suggested_tags: string[] | null;
  suggested_playlist: string | null;
  playlist_fit_score: number | null;
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

  // Fetch all videos (up to 200) + latest audit results in parallel
  const [vidRes, auditRes, runRes] = await Promise.all([
    fetchRecentVideos(tok.access_token, tok.channel_id, 200),
    sb.from('v_yt_channel_audit_videos').select(
      'video_id, current_grade, title_verdict, suggested_title, description_verdict, suggested_description, suggested_tags, suggested_playlist, playlist_fit_score, issues'
    ).eq('run_id',
      // Latest run sub-query via ordering
      sb.from('v_yt_channel_audit_runs').select('id').eq('property_id', NAMKHAN)
        .order('generated_at', { ascending: false }).limit(1).single().then(r => r.data?.id ?? '')
    ),
    sb.from('v_yt_channel_audit_runs').select('id, generated_at, video_count, overall_grade')
      .eq('property_id', NAMKHAN).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const videos = isErr(vidRes) ? [] : vidRes.data;
  const latestRun = runRes.data as { id: string; generated_at: string; video_count: number | null; overall_grade: string | null } | null;

  // Build audit map by video_id
  const auditMap = new Map<string, AuditRow>();
  // Re-fetch audit directly with the run id to avoid nested query issues
  if (latestRun?.id) {
    const { data: auditData } = await sb.from('v_yt_channel_audit_videos').select(
      'video_id, current_grade, title_verdict, suggested_title, description_verdict, suggested_description, suggested_tags, suggested_playlist, playlist_fit_score, issues'
    ).eq('run_id', latestRun.id);
    for (const r of (auditData ?? []) as AuditRow[]) {
      auditMap.set(r.video_id, r);
    }
  }

  // Merge and sort
  const merged = videos.map(v => ({
    ...v,
    audit: auditMap.get(v.id) ?? null,
  }));
  merged.sort((a, b) => {
    const ag = a.audit?.current_grade ?? null;
    const bg = b.audit?.current_grade ?? null;
    // Unaudited sorts after all graded, but before A
    const ao = ag != null ? (GRADE_ORDER[ag] ?? 99) : 3.5;
    const bo = bg != null ? (GRADE_ORDER[bg] ?? 99) : 3.5;
    return ao - bo;
  });

  const graded = merged.filter(v => v.audit?.current_grade);
  const unaudited = merged.filter(v => !v.audit?.current_grade);
  const optimized = graded.filter(v => v.audit?.current_grade === 'A' || v.audit?.current_grade === 'B').length;
  const urgent = graded.filter(v => v.audit?.current_grade === 'D' || v.audit?.current_grade === 'F').length;

  function bestThumb(t: typeof videos[0]['thumbnails'] | undefined): string | null {
    return t?.maxres?.url ?? t?.standard?.url ?? t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null;
  }

  return (
    <DashboardPage title="YouTube · Videos" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="videos" />

        {/* Summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {[
            { label: 'Total videos', value: videos.length, color: INK },
            { label: 'Audited', value: graded.length, color: FOREST },
            { label: 'Optimized (A/B)', value: optimized, color: OK },
            { label: 'Needs work (C)', value: graded.filter(v => v.audit?.current_grade === 'C').length, color: AMBER },
            { label: 'Urgent (D/F)', value: urgent, color: RED },
            { label: 'Not yet audited', value: unaudited.length, color: INK_M },
          ].map(t => (
            <div key={t.label} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: t.color, fontVariantNumeric: 'tabular-nums' }}>{t.value}</div>
            </div>
          ))}
        </div>

        {latestRun && (
          <div style={{ fontSize: 11, color: INK_M, padding: '0 2px' }}>
            Last audit: {new Date(latestRun.generated_at).toISOString().slice(0, 16).replace('T', ' ')} UTC · {latestRun.video_count ?? '?'} videos scored · overall {latestRun.overall_grade ?? '—'} ·{' '}
            <a href="/marketing/youtube/analytics" style={{ color: FOREST }}>Run new audit →</a>
          </div>
        )}

        {/* Video list */}
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${HAIR}`, fontSize: 12, fontWeight: 600, color: INK }}>
            All videos · sorted by optimization need (worst first)
          </div>
          {merged.map(v => {
            const audit = v.audit;
            const grade = audit?.current_grade ?? null;
            const thumb = bestThumb(v.thumbnails);
            return (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto', gap: 14, padding: '12px 16px', borderBottom: `1px solid ${HAIR}`, alignItems: 'flex-start' }}>
                {/* Thumbnail */}
                <div style={{ width: 100, height: 56, background: CREAM, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: INK_M }}>No thumb</div>
                  )}
                </div>

                {/* Content */}
                <div>
                  <a href={'https://youtube.com/watch?v=' + v.id} target="_blank" rel="noreferrer noopener"
                    style={{ fontSize: 13, fontWeight: 500, color: INK, textDecoration: 'none', display: 'block', marginBottom: 4, lineHeight: 1.3 }}>
                    {v.title ?? v.id}
                  </a>
                  <div style={{ fontSize: 10, color: INK_M, marginBottom: 6 }}>
                    {v.views != null ? v.views.toLocaleString() + ' views' : ''}{v.publishedAt ? ' · ' + v.publishedAt.slice(0, 10) : ''}
                  </div>
                  {audit ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontSize: 11, color: INK }}>
                      {audit.title_verdict && <><span style={{ color: INK_M }}>Title</span><span>{audit.title_verdict}</span></>}
                      {audit.suggested_title && <><span style={{ color: INK_M }}>→</span><span style={{ color: FOREST, fontWeight: 500 }}>{audit.suggested_title}</span></>}
                      {audit.description_verdict && <><span style={{ color: INK_M }}>Desc</span><span>{audit.description_verdict}</span></>}
                      {audit.suggested_description && <><span style={{ color: INK_M }}>→</span><span style={{ color: FOREST, fontWeight: 500, display: '-webkit-box', overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{audit.suggested_description}</span></>}
                      {audit.suggested_playlist && <><span style={{ color: INK_M }}>Playlist</span><span style={{ color: AMBER }}>fit {audit.playlist_fit_score ?? '—'}/10 → {audit.suggested_playlist}</span></>}
                      {Array.isArray(audit.issues) && audit.issues.length > 0 && <><span style={{ color: INK_M }}>Flags</span><span style={{ color: RED }}>{audit.issues.join(' · ')}</span></>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: INK_M }}>Not yet audited — run the audit to get optimization suggestions.</div>
                  )}
                </div>

                {/* Grade badge + Apply */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ textAlign: 'center', minWidth: 72, padding: '4px 10px', background: gradeBg(grade), border: `1px solid ${HAIR}`, borderRadius: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: gradeColor(grade), lineHeight: 1 }}>{grade ?? '?'}</div>
                    <div style={{ fontSize: 9, color: gradeColor(grade), fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{gradeLabel(grade)}</div>
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
