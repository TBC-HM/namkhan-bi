// app/marketing/youtube/coverage/page.tsx
// YouTube coverage matrix — mirrors the media library coverage view.
// Rows = property entities (rooms, facilities, activities, retreats).
// Columns = Short (≤60s) | Regular (1-8min) | Long (8min+).
// Coverage detected by: playlist membership + title text match in audited videos.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchPlaylistItemsWithStats, isErr } from '@/lib/youtube/data';
import YtSubTabs from '../_shared/SubTabs';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const FOREST = '#084838'; const RED = '#B03826';
const AMBER = '#B48A3A'; const OK = '#0E7A4B'; const CREAM = '#F5F0E1';

// Playlist IDs for each content category
const PLAYLIST_ROOMS      = 'PLO87vGnBPV3EtdAOz-aTYxvyoOnwDWgXz';
const PLAYLIST_GLAMPING   = 'PLO87vGnBPV3EuBtExtOTtNZZ6xabAZOqD';
const PLAYLIST_SPA        = 'PLO87vGnBPV3GUXQopyoQSzb95sCKLMHwP';
const PLAYLIST_ROOTS      = 'PLO87vGnBPV3G1P5Kxren-fLtU0_nNATG2';
const PLAYLIST_EXPERIENCES = 'PLO87vGnBPV3GUXQopyoQSzb95sCKLMHwP'; // same as spa for now
const PLAYLIST_CULTURE    = 'PLO87vGnBPV3Gm_QTQcNXF6Yqn60eAcG0d';

function durationSec(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}
function formatBucket(sec: number): 'short' | 'regular' | 'long' {
  if (sec <= 60) return 'short';
  if (sec <= 480) return 'regular';
  return 'long';
}
function nameHit(title: string, keywords: string[]): boolean {
  const t = title.toLowerCase();
  return keywords.some(k => t.includes(k.toLowerCase()));
}

interface VideoCounts { short: number; regular: number; long: number }

function CoverageCell({ counts }: { counts: VideoCounts }) {
  const total = counts.short + counts.regular + counts.long;
  if (total === 0) return (
    <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR, background: '#FEF2F2' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: RED }}>0</span>
    </td>
  );
  return (
    <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: total >= 3 ? OK : AMBER }}>{total}</span>
      <div style={{ fontSize: 9, color: INK_M, marginTop: 1 }}>
        {counts.short > 0 && <span>{counts.short}S </span>}
        {counts.regular > 0 && <span>{counts.regular}R </span>}
        {counts.long > 0 && <span>{counts.long}L</span>}
      </div>
    </td>
  );
}

function SectionHeader({ label, count, gapCount }: { label: string; count: number; gapCount: number }) {
  return (
    <tr style={{ background: '#F7F3EA' }}>
      <td colSpan={5} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: FOREST, borderTop: '2px solid ' + HAIR, borderBottom: '1px solid ' + HAIR }}>
        {label} · {count} entries · <span style={{ color: gapCount > 0 ? RED : OK }}>{gapCount} gaps</span>
      </td>
    </tr>
  );
}

export default async function YtCoveragePage() {
  const sb = getSupabaseAdmin();
  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }

  const tok = await getFreshAccessToken(NAMKHAN);
  const tabs = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href }));

  // Fetch property entities + audit data in parallel
  const [roomsRes, facilitiesRes, activitiesRes, retreatsRes, auditRes] = await Promise.all([
    sb.from('v_room_grounding').select('room_type_id, room_type_name').eq('property_id', NAMKHAN).order('room_type_name'),
    sb.from('v_facility_grounding').select('facility_id, facility_name, category').eq('property_id', NAMKHAN).eq('active', true).order('sort_order'),
    sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }).then(() =>
      sb.schema('property' as any).from('activities').select('activity_id, name').eq('property_id', NAMKHAN).eq('is_active', true).order('name')
    ),
    sb.schema('content' as any).from('retreat_programs').select('retreat_id, display_name').eq('property_id', NAMKHAN).order('display_name'),
    sb.from('v_yt_channel_audit_videos').select('video_id, video_title'),
  ]);

  const rooms = (roomsRes.data ?? []) as Array<{ room_type_id: number; room_type_name: string }>;
  const facilities = (facilitiesRes.data ?? []) as Array<{ facility_id: number; facility_name: string; category: string | null }>;
  const activities = (activitiesRes.data ?? []) as Array<{ activity_id: number; name: string }>;
  const retreats = (retreatsRes.data ?? []) as Array<{ retreat_id: number; display_name: string }>;
  const auditedTitles = (auditRes.data ?? []).map(r => (r as any).video_title ?? '');

  // Fetch playlist videos for coverage if token available
  let roomVideos: Array<{ title: string; duration?: string }> = [];
  let spaVideos: Array<{ title: string; duration?: string }> = [];
  let expVideos: Array<{ title: string; duration?: string }> = [];
  let cultureVideos: Array<{ title: string; duration?: string }> = [];

  if (tok.ok && tok.access_token) {
    const [rv, sv, ev, cv] = await Promise.all([
      fetchPlaylistItemsWithStats(tok.access_token, PLAYLIST_ROOMS, 50),
      fetchPlaylistItemsWithStats(tok.access_token, PLAYLIST_SPA, 50),
      fetchPlaylistItemsWithStats(tok.access_token, PLAYLIST_EXPERIENCES, 50),
      fetchPlaylistItemsWithStats(tok.access_token, PLAYLIST_CULTURE, 50),
    ]);
    roomVideos = isErr(rv) ? [] : rv.data.map(v => ({ title: v.title, duration: v.duration }));
    spaVideos = isErr(sv) ? [] : sv.data.map(v => ({ title: v.title, duration: v.duration }));
    expVideos = isErr(ev) ? [] : ev.data.map(v => ({ title: v.title, duration: v.duration }));
    cultureVideos = isErr(cv) ? [] : cv.data.map(v => ({ title: v.title, duration: v.duration }));
  }

  function countCoverage(videoPool: typeof roomVideos, keywords: string[]): VideoCounts {
    const counts: VideoCounts = { short: 0, regular: 0, long: 0 };
    for (const v of videoPool) {
      if (!nameHit(v.title, keywords)) continue;
      const bucket = formatBucket(durationSec(v.duration));
      counts[bucket]++;
    }
    // Also check audited titles (broader pool)
    for (const title of auditedTitles) {
      if (!nameHit(title, keywords)) continue;
      if (videoPool.some(v => v.title === title)) continue; // already counted
      counts.regular++; // unknown format for un-fetched videos
    }
    return counts;
  }

  const roomGaps = rooms.filter(r => {
    const c = countCoverage(roomVideos, [r.room_type_name, ...r.room_type_name.split(' ').filter(w => w.length > 4)]);
    return c.short + c.regular + c.long === 0;
  }).length;

  const actGaps = activities.filter(a => {
    const c = countCoverage(expVideos, [a.name, ...a.name.split(' ').filter(w => w.length > 4)]);
    return c.short + c.regular + c.long === 0;
  }).length;

  const retGaps = retreats.filter(r => {
    const c = countCoverage([], [r.display_name, ...r.display_name.split(' ').filter(w => w.length > 4)]);
    return c.short + c.regular + c.long === 0;
  }).length;

  const totalVideos = roomVideos.length + spaVideos.length + expVideos.length + cultureVideos.length;

  const thStyle = { padding: '7px 10px', textAlign: 'left' as const, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: INK_M, borderBottom: '1px solid ' + HAIR, background: CREAM };
  const tdStyle = { padding: '6px 12px', borderBottom: '1px solid ' + HAIR, fontSize: 12, color: INK };

  return (
    <DashboardPage title="YouTube · Coverage" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="coverage" />

        <div style={{ fontSize: 12, color: INK_M, padding: '8px 12px', background: CREAM, borderRadius: 4, border: '1px solid ' + HAIR }}>
          Coverage = videos in the relevant playlist whose title mentions the entity. S = Short ≤60s · R = Regular 1-8min · L = Long 8min+.
          <strong style={{ color: RED }}> 0 = production gap.</strong> Run audit to update data. <Link href="/marketing/youtube/analytics" style={{ color: FOREST }}>Run audit →</Link>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { label: 'Rooms checked', value: rooms.length, color: INK },
            { label: 'Room gaps', value: roomGaps, color: roomGaps > 0 ? RED : OK },
            { label: 'Activity gaps', value: actGaps, color: actGaps > 0 ? RED : OK },
            { label: 'Retreat gaps', value: retGaps, color: retGaps > 0 ? RED : OK },
            { label: 'Videos indexed', value: totalVideos, color: FOREST },
          ].map(t => (
            <div key={t.label} style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: INK_M, marginBottom: 3 }}>{t.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.color, fontVariantNumeric: 'tabular-nums' }}>{t.value}</div>
            </div>
          ))}
        </div>

        {/* Main coverage table */}
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid ' + HAIR, fontSize: 12, fontWeight: 600, color: INK }}>
            Coverage by property entity · same structure as media library coverage
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 220 }}>Entity</th>
                <th style={{ ...thStyle, textAlign: 'center' as const, borderLeft: '1px solid ' + HAIR }}>Short ≤60s</th>
                <th style={{ ...thStyle, textAlign: 'center' as const, borderLeft: '1px solid ' + HAIR }}>Regular 1-8m</th>
                <th style={{ ...thStyle, textAlign: 'center' as const, borderLeft: '1px solid ' + HAIR }}>Long 8m+</th>
                <th style={{ ...thStyle, textAlign: 'center' as const, borderLeft: '1px solid ' + HAIR }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* ROOMS */}
              <SectionHeader label="Accommodation" count={rooms.length} gapCount={roomGaps} />
              {rooms.map(r => {
                const keywords = [r.room_type_name, ...r.room_type_name.split(/\s+/).filter(w => w.length > 4)];
                const c = countCoverage(roomVideos, keywords);
                const total = c.short + c.regular + c.long;
                return (
                  <tr key={r.room_type_id}>
                    <td style={{ ...tdStyle }}>{r.room_type_name}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR, background: c.short === 0 ? '#FEF9F5' : undefined }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.short === 0 ? AMBER : OK }}>{c.short}</span>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.regular === 0 ? INK_M : OK }}>{c.regular}</span>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.long === 0 ? INK_M : OK }}>{c.long}</span>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '2px solid ' + HAIR, background: total === 0 ? '#FEF2F2' : undefined }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: total === 0 ? RED : total >= 2 ? OK : AMBER }}>{total === 0 ? '⚠ 0' : total}</span>
                    </td>
                  </tr>
                );
              })}

              {/* FACILITIES (SPA) */}
              {(() => {
                const spaFacilities = facilities.filter(f => ['wellness', 'treatment_room', 'dining', 'f&b', 'restaurant', 'bar', 'food'].some(cat => (f.category ?? '').toLowerCase().includes(cat)));
                const spaGaps = spaFacilities.filter(f => {
                  const kw = [f.facility_name, ...f.facility_name.split(/\s+/).filter(w => w.length > 4)];
                  const c = countCoverage(spaVideos, kw);
                  return c.short + c.regular + c.long === 0;
                }).length;
                if (spaFacilities.length === 0) return null;
                return (
                  <>
                    <SectionHeader label="Jungle Spa & Dining" count={spaFacilities.length} gapCount={spaGaps} />
                    {spaFacilities.map(f => {
                      const kw = [f.facility_name, ...f.facility_name.split(/\s+/).filter(w => w.length > 4)];
                      const c = countCoverage(spaVideos, kw);
                      const total = c.short + c.regular + c.long;
                      return (
                        <tr key={f.facility_id}>
                          <td style={{ ...tdStyle }}>{f.facility_name}</td>
                          {['short', 'regular', 'long'].map(fmt => (
                            <td key={fmt} style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: (c as any)[fmt] === 0 ? INK_M : OK }}>{(c as any)[fmt]}</span>
                            </td>
                          ))}
                          <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '2px solid ' + HAIR, background: total === 0 ? '#FEF2F2' : undefined }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: total === 0 ? RED : total >= 2 ? OK : AMBER }}>{total === 0 ? '⚠ 0' : total}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })()}

              {/* ACTIVITIES */}
              <SectionHeader label="Experiences & Activities" count={activities.length} gapCount={actGaps} />
              {activities.map(a => {
                const kw = [a.name, ...a.name.split(/\s+/).filter(w => w.length > 4)];
                const c = countCoverage([...expVideos, ...spaVideos, ...roomVideos], kw);
                const total = c.short + c.regular + c.long;
                return (
                  <tr key={a.activity_id}>
                    <td style={{ ...tdStyle }}>{a.name}</td>
                    {['short', 'regular', 'long'].map(fmt => (
                      <td key={fmt} style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: (c as any)[fmt] === 0 ? INK_M : OK }}>{(c as any)[fmt]}</span>
                      </td>
                    ))}
                    <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '2px solid ' + HAIR, background: total === 0 ? '#FEF2F2' : undefined }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: total === 0 ? RED : total >= 2 ? OK : AMBER }}>{total === 0 ? '⚠ 0' : total}</span>
                    </td>
                  </tr>
                );
              })}

              {/* RETREATS */}
              <SectionHeader label="Wellness Retreats" count={retreats.length} gapCount={retGaps} />
              {retreats.map(r => {
                const kw = [r.display_name, ...r.display_name.split(/\s+/).filter(w => w.length > 4), 'retreat'];
                const c = countCoverage([...spaVideos, ...roomVideos], kw);
                const total = c.short + c.regular + c.long;
                return (
                  <tr key={r.retreat_id}>
                    <td style={{ ...tdStyle }}>{r.display_name}</td>
                    {['short', 'regular', 'long'].map(fmt => (
                      <td key={fmt} style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: (c as any)[fmt] === 0 ? INK_M : OK }}>{(c as any)[fmt]}</span>
                      </td>
                    ))}
                    <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid ' + HAIR, borderLeft: '2px solid ' + HAIR, background: total === 0 ? '#FEF2F2' : undefined }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: total === 0 ? RED : total >= 2 ? OK : AMBER }}>{total === 0 ? '⚠ 0 — Wellness Retreats playlist missing' : total}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: INK_M, padding: '8px 12px', background: CREAM, borderRadius: 4 }}>
          Coverage is estimated by matching entity names against video titles in relevant playlists. Accuracy improves once the Wellness Retreats and River Life playlists are created and videos are assigned. Create missing playlists from the{' '}
          <Link href="/marketing/youtube/playlists" style={{ color: FOREST }}>Playlists tab →</Link>
        </div>
      </div>
    </DashboardPage>
  );
}
