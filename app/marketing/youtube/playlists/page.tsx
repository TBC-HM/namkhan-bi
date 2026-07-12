// app/marketing/youtube/playlists/page.tsx
// PBS 2026-07-13 — Playlists sub-tab. Live channel playlists via Data API v3.
import Link from 'next/link';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchChannelPlaylists, isErr } from '@/lib/youtube/data';
import YtSubTabs from '../_shared/SubTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const RED    = '#B03826';

export default async function YouTubePlaylistsPage() {
  const sb = getSupabaseAdmin();
  const { data: connection } = await sb
    .from('v_yt_channel_connections')
    .select('id,channel_id,channel_title')
    .eq('property_id', NAMKHAN).eq('active', true).maybeSingle();

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));

  if (!connection?.channel_id) {
    return (
      <DashboardPage title="YouTube · channel management" tabs={tabs}>
        <YtSubTabs current="playlists" />
        <div style={{ gridColumn: '1 / -1', padding: 20 }}>Connect YouTube first.</div>
      </DashboardPage>
    );
  }
  const tok = await getFreshAccessToken(NAMKHAN);
  if (!tok.ok || !tok.access_token) {
    return (
      <DashboardPage title="YouTube · channel management" tabs={tabs}>
        <YtSubTabs current="playlists" />
        <div style={{ gridColumn: '1 / -1', padding: 20 }}>Session expired. Reconnect via Dashboard.</div>
      </DashboardPage>
    );
  }
  const plRes = await fetchChannelPlaylists(tok.access_token, connection.channel_id, 50);
  const playlists = isErr(plRes) ? [] : plRes.data;
  const err = isErr(plRes) ? `${plRes.error}${plRes.detail ? ` · ${plRes.detail.slice(0, 120)}` : ''}` : null;

  // Also load pillars to show which playlist is linked to which program
  const { data: pillars } = await sb.from('v_yt_content_pillars')
    .select('id,label,pillar_key,youtube_playlist_id,target_cadence')
    .eq('property_id', NAMKHAN).eq('active', true).order('sort_order');
  const pillarByPlaylistId = new Map<string, { label: string; cadence: string | null }>();
  for (const p of (pillars ?? [])) if (p.youtube_playlist_id) pillarByPlaylistId.set(p.youtube_playlist_id, { label: p.label, cadence: p.target_cadence });

  return (
    <DashboardPage title="YouTube · channel management" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="playlists" />
        <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: INK, fontWeight: 600 }}>Channel playlists ({playlists.length})</div>
            {err && <div style={{ fontSize: 11, color: RED }}>Couldn&apos;t load: {err}</div>}
          </div>
          {playlists.length === 0 ? (
            <div style={{ fontSize: 13, color: INK_M }}>{err ? '—' : 'No playlists on this channel yet.'}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {playlists.map((pl) => {
                const thumb = pl.thumbnails.medium?.url ?? pl.thumbnails.high?.url ?? pl.thumbnails.default?.url ?? null;
                const linkedPillar = pillarByPlaylistId.get(pl.id);
                return (
                  <Link key={pl.id} href={`/marketing/youtube/playlists/${encodeURIComponent(pl.id)}`}
                    style={{ display: 'block', border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden', background: WHITE, textDecoration: 'none', color: INK }}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={pl.title} style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', background: CREAM }} />
                    ) : <div style={{ aspectRatio: '16 / 9', background: CREAM }} />}
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 13, color: INK, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 34 }}>{pl.title}</div>
                      <div style={{ fontSize: 11, color: INK_M, marginTop: 6, display: 'flex', gap: 8 }}>
                        <span>{pl.itemCount} videos</span>
                        {pl.privacyStatus && <span>· {pl.privacyStatus}</span>}
                      </div>
                      {linkedPillar ? (
                        <div style={{ marginTop: 6, fontSize: 10, color: FOREST, background: '#E8F0EC', padding: '2px 6px', borderRadius: 2, display: 'inline-block' }}>
                          🎬 {linkedPillar.label}{linkedPillar.cadence ? ` · ${linkedPillar.cadence}` : ''}
                        </div>
                      ) : (
                        <div style={{ marginTop: 6, fontSize: 10, color: INK_M }}>no program linked</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardPage>
  );
}
