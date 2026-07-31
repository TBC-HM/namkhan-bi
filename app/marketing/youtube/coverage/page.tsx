/* eslint-disable @next/next/no-img-element */
// app/marketing/youtube/coverage/page.tsx
// YouTube coverage matrix — mirrors the media library coverage view.
// Shows which playlists have content by format (Shorts / Regular / Long),
// which content pillars are linked, and where the production gaps are.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchChannelPlaylists, isErr } from '@/lib/youtube/data';
import YtSubTabs from '../_shared/SubTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const FOREST = '#084838'; const RED = '#B03826';
const AMBER = '#B48A3A'; const OK = '#0E7A4B'; const CREAM = '#F5F0E1';

// The 9-slot taxonomy — source of truth for production planning
const TAXONOMY = [
  // TIER 1 — PROPERTY (what The Namkhan offers)
  { tier: 'Property', slot: 'The Namkhan · Overview',       id: 'PLO87vGnBPV3EhxtWYCS77_q37lg-BjxSA', shortsTarget: 2, longTarget: 2 },
  { tier: 'Property', slot: 'Stay · Rooms & Suites',        id: 'PLO87vGnBPV3EtdAOz-aTYxvyoOnwDWgXz', shortsTarget: 6, longTarget: 2 },
  { tier: 'Property', slot: 'Glamping at The Namkhan',      id: 'PLO87vGnBPV3EuBtExtOTtNZZ6xabAZOqD', shortsTarget: 4, longTarget: 1 },
  { tier: 'Property', slot: 'ROOTS Restaurant & Farm',      id: 'PLO87vGnBPV3G1P5Kxren-fLtU0_nNATG2', shortsTarget: 4, longTarget: 2 },
  { tier: 'Property', slot: 'Jungle Spa & Wellness',        id: 'PLO87vGnBPV3GUXQopyoQSzb95sCKLMHwP', shortsTarget: 4, longTarget: 2 },
  { tier: 'Property', slot: 'Wellness Retreats',            id: null,                                   shortsTarget: 2, longTarget: 3 },
  // TIER 2 — DESTINATION (what Luang Prabang offers)
  { tier: 'Destination', slot: 'Luang Prabang · Sacred Sites & Culture', id: 'PLO87vGnBPV3Gm_QTQcNXF6Yqn60eAcG0d', shortsTarget: 6, longTarget: 2 },
  { tier: 'Destination', slot: 'Luang Prabang · River Life',             id: null,                                     shortsTarget: 4, longTarget: 1 },
  // TIER 3 — COMMUNITY
  { tier: 'Community', slot: 'Namkhan Help · Community & Craft', id: 'PLO87vGnBPV3GdkPC1_KzTEzHwYgz5J_AQ', shortsTarget: 2, longTarget: 1 },
];

const TIER_COLORS: Record<string, string> = {
  Property: FOREST, Destination: AMBER, Community: '#5A3E8A',
};

export default async function YtCoveragePage() {
  const sb = getSupabaseAdmin();
  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }

  const tok = await getFreshAccessToken(NAMKHAN);
  const tabs = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href }));

  // Fetch live playlists + content pillars in parallel
  const [plRes, pillarsRes] = await Promise.all([
    tok.ok && tok.access_token
      ? fetchChannelPlaylists(tok.access_token, tok.channel_id!, 50)
      : Promise.resolve({ ok: false as const, error: 'no_token', data: [] as any }),
    sb.from('v_yt_content_pillars')
      .select('pillar_key, label, target_cadence, youtube_playlist_id')
      .eq('property_id', NAMKHAN).eq('active', true).order('sort_order'),
  ]);

  const livePlaylists = isErr(plRes) ? [] : (plRes as any).data ?? [];
  const pillars = (pillarsRes.data ?? []) as Array<{ pillar_key: string; label: string; target_cadence: string | null; youtube_playlist_id: string | null }>;

  // Build lookup: playlistId → itemCount
  const liveMap = new Map<string, number>();
  for (const p of livePlaylists) liveMap.set(p.id, p.itemCount ?? 0);

  // Build lookup: playlistId → linked pillar labels
  const pillarsByPlaylist = new Map<string, string[]>();
  for (const p of pillars) {
    if (!p.youtube_playlist_id) continue;
    const arr = pillarsByPlaylist.get(p.youtube_playlist_id) ?? [];
    arr.push(`${p.label} (${p.target_cadence ?? 'ad hoc'})`);
    pillarsByPlaylist.set(p.youtube_playlist_id, arr);
  }

  const totalPlaylists = TAXONOMY.filter(t => t.id && liveMap.has(t.id)).length;
  const gapPlaylists = TAXONOMY.filter(t => !t.id || !liveMap.has(t.id)).length;
  const unlinkedPillars = pillars.filter(p => !p.youtube_playlist_id).length;

  let lastTier = '';

  return (
    <DashboardPage title="YouTube · Coverage" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="coverage" />

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { label: 'Playlists live', value: totalPlaylists, sub: `of ${TAXONOMY.length} in taxonomy`, color: FOREST },
            { label: 'Playlist gaps', value: gapPlaylists, sub: 'not yet created', color: gapPlaylists > 0 ? RED : OK },
            { label: 'Pillars unlinked', value: unlinkedPillars, sub: 'need playlist assigned', color: unlinkedPillars > 0 ? AMBER : OK },
            { label: 'Total playlists', value: livePlaylists.length, sub: 'on your channel now', color: INK },
          ].map(t => (
            <div key={t.label} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: INK_M, marginBottom: 3 }}>{t.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: t.color, fontVariantNumeric: 'tabular-nums' }}>{t.value}</div>
              <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>{t.sub}</div>
            </div>
          ))}
        </div>

        {/* Coverage matrix */}
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${HAIR}`, fontSize: 12, fontWeight: 600, color: INK }}>
            Playlist coverage · 9 target slots · production gaps highlighted
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: CREAM }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, borderBottom: `1px solid ${HAIR}`, width: 220 }}>Playlist</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}` }}>Videos</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}` }}>Target</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}` }}>Linked pillars</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}` }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {TAXONOMY.map((slot, i) => {
                const isNewTier = slot.tier !== lastTier;
                if (isNewTier) lastTier = slot.tier;
                const exists = !!slot.id && liveMap.has(slot.id);
                const count = slot.id ? (liveMap.get(slot.id) ?? 0) : 0;
                const target = slot.shortsTarget + slot.longTarget;
                const pct = target > 0 ? Math.min(100, Math.round(count / target * 100)) : 0;
                const linked = slot.id ? (pillarsByPlaylist.get(slot.id) ?? []) : [];
                const bgRow = !exists ? '#FEF9F0' : undefined;
                return (
                  <>
                    {isNewTier && (
                      <tr key={'tier-' + slot.tier} style={{ background: '#F7F3EA' }}>
                        <td colSpan={5} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: TIER_COLORS[slot.tier] ?? INK_M, borderTop: i > 0 ? `2px solid ${HAIR}` : undefined, borderBottom: `1px solid ${HAIR}` }}>
                          Tier {slot.tier === 'Property' ? '1' : slot.tier === 'Destination' ? '2' : '3'} · {slot.tier}
                        </td>
                      </tr>
                    )}
                    <tr key={slot.slot} style={{ background: bgRow }}>
                      <td style={{ padding: '8px 12px', borderBottom: `1px solid ${HAIR}`, fontWeight: 500, color: exists ? INK : INK_M }}>
                        {slot.id ? (
                          <a href={`/marketing/youtube/playlists/${encodeURIComponent(slot.id)}`} style={{ color: FOREST, textDecoration: 'none' }}>{slot.slot}</a>
                        ) : slot.slot}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}`, fontWeight: 700, color: exists ? INK : INK_M, fontVariantNumeric: 'tabular-nums' }}>
                        {exists ? count : '—'}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}`, color: INK_M, fontSize: 11 }}>
                        <div style={{ fontSize: 10, color: INK_M }}>{slot.shortsTarget}S + {slot.longTarget}L</div>
                        {exists && count > 0 && (
                          <div style={{ marginTop: 3, height: 4, background: HAIR, borderRadius: 2, width: 60, display: 'inline-block', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? OK : pct >= 40 ? AMBER : RED, borderRadius: 2 }} />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}`, fontSize: 11, color: INK_M }}>
                        {linked.length > 0 ? linked.join(' · ') : <span style={{ color: '#C8C0AF', fontStyle: 'italic' }}>no pillar linked</span>}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}` }}>
                        {!exists
                          ? <span style={{ fontSize: 10, fontWeight: 700, color: RED, padding: '2px 6px', background: '#FDECEA', borderRadius: 3 }}>⚠ Create</span>
                          : count === 0
                          ? <span style={{ fontSize: 10, fontWeight: 700, color: AMBER }}>Empty</span>
                          : <span style={{ fontSize: 10, color: OK, fontWeight: 700 }}>✓</span>}
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Content pillars status */}
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${HAIR}`, fontSize: 12, fontWeight: 600, color: INK }}>
            Content pillars — production cadence & format
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: CREAM }}>
                {['Pillar', 'Cadence', 'Format', 'Target playlist', 'Status'].map((h, i) => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, borderBottom: `1px solid ${HAIR}`, borderLeft: i > 0 ? `1px solid ${HAIR}` : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pillars.map(p => {
                const playlistName = p.youtube_playlist_id
                  ? (livePlaylists.find((l: any) => l.id === p.youtube_playlist_id)?.title ?? p.youtube_playlist_id.slice(0, 24) + '…')
                  : null;
                const isShortFormat = p.pillar_key === 'monks_minute' || p.pillar_key === 'river_life';
                const format = isShortFormat ? 'Short ≤60s' : p.target_cadence === 'weekly' || p.target_cadence === 'biweekly' ? 'Short + Medium' : 'Medium/Long';
                return (
                  <tr key={p.pillar_key}>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${HAIR}`, fontWeight: 500, color: INK }}>{p.label}</td>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}`, color: INK_M }}>{p.target_cadence ?? '—'}</td>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}` }}>
                      <span style={{ fontSize: 10, padding: '1px 6px', background: isShortFormat ? '#E8F5E9' : CREAM, color: isShortFormat ? OK : INK_M, border: `1px solid ${HAIR}`, borderRadius: 3 }}>
                        {format}
                      </span>
                    </td>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}`, color: FOREST, fontSize: 11 }}>
                      {playlistName ?? <span style={{ color: RED, fontWeight: 600 }}>⚠ No playlist</span>}
                    </td>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}`, textAlign: 'center' }}>
                      {p.youtube_playlist_id
                        ? <span style={{ color: OK, fontWeight: 700, fontSize: 11 }}>✓ Linked</span>
                        : <span style={{ color: RED, fontWeight: 700, fontSize: 10 }}>Not linked</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Production gap summary */}
        <div style={{ background: '#FEF9F0', border: `1px solid ${AMBER}`, borderRadius: 4, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: AMBER, marginBottom: 8 }}>⚠ Production gaps to close</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, fontSize: 11, color: INK_M }}>
            <div>
              <strong style={{ color: INK }}>Missing playlists (create first):</strong>
              <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.8 }}>
                <li>Wellness Retreats at The Namkhan — target: 2 Shorts + 3 long-form</li>
                <li>Luang Prabang · River Life — target: 4 Shorts + 1 long-form</li>
              </ul>
            </div>
            <div>
              <strong style={{ color: INK }}>Unlinked pillar (link after River Life created):</strong>
              <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.8 }}>
                <li>River Life (weekly Shorts) → Luang Prabang · River Life playlist</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
