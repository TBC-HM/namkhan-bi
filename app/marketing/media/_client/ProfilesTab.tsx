// app/marketing/media/_client/ProfilesTab.tsx
// PBS 2026-07-14 · #201 — Profiles tab. Left = OTA list, right = selected OTA's
// dynamically-curated photo set (from public.v_media_ota_curated_set). Auto-
// refreshes when Iris scores a new upload higher than a currently-selected pic.
// Data flow: /api/marketing/media/ota-curated-set + /api/marketing/media/ota-proposal.
'use client';

import { useEffect, useState } from 'react';

interface Spec {
  channel: string;
  display_name: string;
  min_q: number;
  min_dims: string;
  pref_per_room: number | null;
  profile_max: number | null;
  aesthetic_style: string | null;
  hero_photo_count?: number | null;
  eligible_total: number;
  eligible_room_photos: number;
  rooms_covered: number;
  profile_delta: number | null;
}

interface CuratedRow {
  asset_id: string;
  channel: string;
  bucket_key: string;
  rank_in_bucket: number;
  quality_index: number | null;
  width_px: number | null;
  height_px: number | null;
  seo_target_filename: string | null;
  original_filename: string | null;
  public_url: string | null;
  is_hero: boolean;
  rank_in_property: number;
  is_selected: boolean;
  category: string | null;
  room_type_id: number | null;
  facility_id: number | null;
}

const OTA_CHANNELS = ['booking_com','expedia','ctrip','slh','traveloka','airbnb','agoda','tripadvisor','google_business'];

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';

export default function ProfilesTab({ propertyId, totalRooms }: { propertyId: number; totalRooms: number }) {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [selectedCh, setSelectedCh] = useState<string>('booking_com');
  const [curated, setCurated] = useState<CuratedRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/marketing/media/ota-proposal?property_id=${propertyId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(j => setSpecs(j.rows ?? []))
      .catch(() => setSpecs([]));
  }, [propertyId]);

  useEffect(() => {
    setLoading(true);
    setCurated(null);
    fetch(`/api/marketing/media/ota-curated-set?property_id=${propertyId}&channel=${selectedCh}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(j => setCurated(j.rows ?? []))
      .catch(() => setCurated([]))
      .finally(() => setLoading(false));
  }, [selectedCh, propertyId]);

  const spec = specs.find(s => s.channel === selectedCh);

  const heroPhotos = (curated ?? []).filter(r => r.is_hero).sort((a,b) => a.rank_in_property - b.rank_in_property);
  const nonHero = (curated ?? []).filter(r => !r.is_hero);
  const byBucket = new Map<string, CuratedRow[]>();
  for (const r of nonHero) {
    if (!byBucket.has(r.bucket_key)) byBucket.set(r.bucket_key, []);
    byBucket.get(r.bucket_key)!.push(r);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
      {/* LEFT — OTA list */}
      <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 8, alignSelf: 'start' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK_M, padding: '4px 6px 8px' }}>OTA Profiles</div>
        {OTA_CHANNELS.map(ch => {
          const s = specs.find(x => x.channel === ch);
          const active = ch === selectedCh;
          const roomGap = s ? ((s.pref_per_room ?? 0) * totalRooms) - s.eligible_room_photos : null;
          return (
            <button key={ch} onClick={() => setSelectedCh(ch)} style={{
              display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', fontSize: 12, background: active ? FOREST : 'transparent',
              color: active ? WHITE : INK, border: 'none', cursor: 'pointer', borderRadius: 3, marginBottom: 2,
              fontWeight: active ? 700 : 500, textAlign: 'left',
            }}>
              <span>{s?.display_name ?? ch}</span>
              {roomGap != null && roomGap > 0 && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: active ? '#FFFFFF33' : '#B23A2E22', color: active ? WHITE : '#B23A2E' }}>-{roomGap}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* RIGHT — selected OTA */}
      <div>
        {!spec ? (
          <div style={{ padding: 40, textAlign: 'center', color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
            Loading channel spec…
          </div>
        ) : (
          <>
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: INK }}>{spec.display_name}</h2>
                <span style={{ fontSize: 11, color: INK_M }}>· {spec.aesthetic_style ?? 'no style set'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 12 }}>
                {[
                  { label: 'Min quality',       value: spec.min_q + '%' },
                  { label: 'Min dimensions',    value: spec.min_dims },
                  { label: 'Photos per room',   value: spec.pref_per_room ?? '—' },
                  { label: 'Profile cap',       value: spec.profile_max ?? '—' },
                  { label: 'Eligible total',    value: spec.eligible_total.toLocaleString() },
                  { label: 'Rooms covered',     value: spec.rooms_covered + '/' + totalRooms },
                ].map((k, i) => (
                  <div key={i} style={{ background: CREAM, borderRadius: 3, padding: '8px 12px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK_M }}>{k.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginTop: 2 }}>{k.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: INK_M }}>
                Curated set updates automatically when a newer photo scores higher than a currently-selected pick. To fine-tune the criteria, edit this channel under <em>Photo & Settings → Output channels</em>.
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: INK_M }}>Loading curated set…</div>
            ) : !curated || curated.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
                No photos yet meet this channel's minimum quality + dimensions. Lower the threshold in Output channels or upload/regenerate higher-quality photos.
              </div>
            ) : (
              (<>
              {heroPhotos.length > 0 && (
                <div style={{ marginBottom: 24, padding: 12, background: '#FAF6EC', border: '1px solid ' + HAIR, borderRadius: 4 }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST }}>🏆 Hero photos · Top {heroPhotos.length}</span>
                    <span style={{ fontSize: 10, color: INK_M }}>· property-wide, best quality — landing thumbnails + carousel front</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:6 }}>
                    {heroPhotos.map(r => (
                      <div key={r.asset_id} style={{ background: WHITE, border:'1px solid '+HAIR, borderRadius:3, overflow:'hidden', position:'relative' }}>
                        {r.public_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.public_url} alt={r.seo_target_filename ?? r.original_filename ?? ''} style={{ width:'100%', aspectRatio:'4/3', objectFit:'cover', display:'block', background: CREAM }} />
                        ) : <div style={{ width:'100%', aspectRatio:'4/3', background: CREAM }} />}
                        <div style={{ position:'absolute', top:4, left:4, padding:'2px 6px', background: FOREST, color: WHITE, fontSize:9, fontWeight:700, borderRadius:2 }}>#{r.rank_in_property}</div>
                        <div style={{ padding:'4px 6px', fontSize:10, color:INK, display:'flex', justifyContent:'space-between' }}>
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.seo_target_filename ?? ''}>{r.seo_target_filename ?? r.asset_id.slice(0,6)}</span>
                          <span style={{ color:INK_M, marginLeft:4 }}>q{r.quality_index ?? '?'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {[...byBucket.entries()].map(([bucket, rows]) => (
                <div key={bucket} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M, marginBottom: 8 }}>
                    {bucket.replace('room:', 'Room · ').replace('facility:', 'Facility · ').replace('activity:', 'Activity · ').replace('category:', '')}
                    <span style={{ marginLeft: 8, color: INK_M, fontWeight: 400 }}>· {rows.length} selected</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                    {rows.map(r => (
                      <div key={r.asset_id} style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3, overflow: 'hidden' }}>
                        {r.public_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.public_url} alt={r.seo_target_filename ?? r.original_filename ?? ''} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', background: CREAM }} />
                        ) : (
                          <div style={{ width: '100%', aspectRatio: '4/3', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: INK_M }}>no preview</div>
                        )}
                        <div style={{ padding: '6px 8px', fontSize: 10, color: INK }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.seo_target_filename ?? r.original_filename ?? ''}>
                            {r.seo_target_filename ?? r.original_filename ?? r.asset_id.slice(0, 8)}
                          </div>
                          <div style={{ color: INK_M, marginTop: 2, display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                            <span>#{r.rank_in_bucket}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>q {r.quality_index ?? '?'}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.width_px}×{r.height_px}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              </>)
            )}
          </>
        )}
      </div>
    </div>
  );
}
