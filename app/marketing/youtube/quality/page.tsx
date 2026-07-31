// app/marketing/youtube/quality/page.tsx
// Video quality scoring gallery — media-library style.
// No YouTube API quota: thumbnails from i.ytimg.com CDN, scores from DB.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import YtSubTabs from '../_shared/SubTabs';
import ScoreVideoButton from '../analytics/_client/ScoreVideoButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const FOREST = '#084838'; const RED = '#B03826';
const AMBER = '#B48A3A'; const OK = '#0E7A4B'; const CREAM = '#F5F0E1';

function scoreColor(s: number) { return s >= 75 ? OK : s >= 55 ? AMBER : RED; }

interface VideoScore {
  video_id: string; video_title: string | null;
  thumbnail_score: number | null; description_score: number | null;
  title_score: number | null; tags_score: number | null;
  engagement_score: number | null; composite_score: number | null;
  thumbnail_feedback: string | null; thumbnail_flags: string[] | null;
}

export default async function YtQualityPage() {
  const sb = getSupabaseAdmin();
  const tabs = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href }));

  // Audited videos — source pool (no YouTube API needed)
  const { data: raw } = await sb.from('v_yt_channel_audit_videos')
    .select('video_id, video_title, current_grade').order('id', { ascending: false });
  const seen = new Set<string>();
  const videos = (raw ?? []).filter(v => { if (seen.has(v.video_id)) return false; seen.add(v.video_id); return true; });

  // Existing quality scores
  const { data: scoresRaw } = await sb.from('v_yt_video_scores').select('*').eq('property_id', NAMKHAN);
  const scores = (scoresRaw ?? []) as VideoScore[];
  const scoreMap = new Map<string, VideoScore>(scores.map(s => [s.video_id, s]));

  const totalScored = scores.length;
  const avgScore = totalScored > 0
    ? Math.round(scores.reduce((s, v) => s + (v.composite_score ?? 0), 0) / totalScored) : null;

  const distribution = [
    { label: '≥75% Great',    count: scores.filter(s => (s.composite_score ?? 0) >= 75).length, color: OK },
    { label: '55-74% Good',   count: scores.filter(s => { const c = s.composite_score ?? 0; return c >= 55 && c < 75; }).length, color: AMBER },
    { label: '<55% Needs work', count: scores.filter(s => (s.composite_score ?? 0) < 55).length, color: RED },
  ];

  return (
    <DashboardPage title="YouTube · Quality" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="quality" />

        {/* Header */}
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '14px 20px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flexGrow: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 3 }}>Video quality scoring · Claude vision + Lens audit</div>
            <div style={{ fontSize: 11, color: INK_M }}>
              {videos.length} audited videos · {totalScored} scored{avgScore != null ? ` · channel average ${avgScore}%` : ''}
            </div>
          </div>
          {totalScored > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {distribution.map(d => (
                <div key={d.label} style={{ textAlign: 'center', padding: '6px 12px', border: '1px solid ' + d.color + '44', borderRadius: 4, background: d.color + '12' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: d.color }}>{d.count}</div>
                  <div style={{ fontSize: 9, color: d.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{d.label}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10, color: INK_M, background: CREAM, padding: '6px 10px', borderRadius: 4, maxWidth: 260, lineHeight: 1.5 }}>
            Thumbnail 30% (Claude vision) · Title 25% · Description 20% · Tags 15% · Engagement 10%
          </div>
        </div>

        {/* Grid */}
        {videos.length === 0 ? (
          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 40, textAlign: 'center', color: INK_M, fontSize: 13 }}>
            No audited videos yet — run the audit from the Analytics tab first.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {videos.map(v => {
              const sc = scoreMap.get(v.video_id) ?? null;
              const composite = sc?.composite_score ?? null;
              return (
                <div key={v.video_id} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
                  {/* Thumbnail */}
                  <div style={{ position: 'relative', aspectRatio: '16 / 9', background: CREAM, borderRadius: '4px 4px 0 0', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`} alt={v.video_title ?? v.video_id}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {composite != null && (
                      <div style={{ position: 'absolute', top: 6, right: 6, background: scoreColor(composite) + 'EE', color: WHITE, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 3 }}>
                        {composite}%
                      </div>
                    )}
                    {v.current_grade && (
                      <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,.75)', color: WHITE, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2 }}>
                        {v.current_grade}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1 }}>
                    <a href={`https://youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11.5, fontWeight: 500, color: INK, textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35 }}>
                      {v.video_title ?? v.video_id}
                    </a>

                    {/* Mini score bars if scored */}
                    {sc && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {([
                          { label: 'Thumb', val: sc.thumbnail_score ?? 50 },
                          { label: 'Title', val: sc.title_score ?? 50 },
                          { label: 'Desc',  val: sc.description_score ?? 50 },
                        ] as Array<{label:string;val:number}>).map(({ label, val }) => (
                          <div key={label} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 26px', gap: 4, alignItems: 'center', fontSize: 9 }}>
                            <span style={{ color: INK_M }}>{label}</span>
                            <div style={{ height: 3, background: CREAM, borderRadius: 2 }}>
                              <div style={{ width: `${val}%`, height: '100%', background: scoreColor(val), borderRadius: 2 }} />
                            </div>
                            <span style={{ color: scoreColor(val), fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 'auto' }}>
                      <ScoreVideoButton
                        videoId={v.video_id} videoTitle={v.video_title}
                        existingScore={sc ? { composite: sc.composite_score ?? 50, thumbnail: sc.thumbnail_score ?? 50, title: sc.title_score ?? 50, description: sc.description_score ?? 50, tags: sc.tags_score ?? 50, engagement: sc.engagement_score ?? 50 } : null}
                        existingFeedback={sc?.thumbnail_feedback}
                        existingFlags={sc?.thumbnail_flags ?? undefined}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardPage>
  );
}
