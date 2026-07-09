// app/revenue/compset/[comp_id]/page.tsx
// PBS 2026-07-09 pm: Per-hotel deep-scrape landing page.
// Sources: v_competitor_property_deep (LLM scrape) + v_compset_property_summary (rates + reviews).
// Refresh button calls the scrape-competitor-profile edge fn.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';
import RescrapeButton from './_components/RescrapeButton';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type DeepRow = {
  comp_id: string;
  property_id: number;
  property_name: string;
  is_self: boolean | null;
  address: string | null;
  phone: string | null;
  website_url: string | null;
  lat: number | null;
  lng: number | null;
  distance_to_centre_km: number | null;
  distance_to_airport_km: number | null;
  brand: string | null;
  affiliation: string | null;
  star_rating: number | null;
  room_count: number | null;
  year_opened: number | null;
  year_renovated: number | null;
  facilities: Record<string, boolean> | null;
  room_types: Array<{ name: string; size_m2: number | null; max_guests: number | null; bed_type: string | null; notes: string | null }> | null;
  review_score_google: number | null;
  review_count_google: number | null;
  review_score_ta: number | null;
  review_count_ta: number | null;
  review_score_bdc: number | null;
  review_count_bdc: number | null;
  hero_photo_url: string | null;
  photo_urls: string[] | null;
  scrape_source: string | null;
  last_scraped_at: string | null;
  scrape_notes: string | null;
};

type SummaryRow = {
  latest_usd: number | null;
  avg_30d_usd: number | null;
  pct_vs_median: number | null;
  last_shop_human: string | null;
  set_name: string | null;
};

interface Props { params: Promise<{ comp_id: string }> }

function fmtDate(iso: string | null): string {
  if (!iso) return 'never scraped';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function fmtDist(km: number | null): string {
  if (km == null) return '—';
  return `${km.toFixed(1)} km`;
}

export default async function CompetitorLandingPage({ params }: Props) {
  const { comp_id } = await params;
  const sb = getSupabaseAdmin();

  const [deepRes, summaryRes] = await Promise.all([
    sb.from('v_competitor_property_deep').select('*').eq('comp_id', comp_id).maybeSingle(),
    sb.from('v_compset_property_summary').select('set_name, latest_usd, avg_30d_usd, pct_vs_median, last_shop_human').eq('comp_id', comp_id).maybeSingle(),
  ]);

  const deep = (deepRes.data ?? null) as DeepRow | null;
  const summary = (summaryRes.data ?? null) as SummaryRow | null;

  if (!deep && !summary) notFound();

  // Fetch property_name from base table if only summary present
  const propertyName = deep?.property_name ?? (await sb.from('v_compset_property_summary').select('property_name').eq('comp_id', comp_id).maybeSingle()).data?.property_name ?? 'Unknown';

  const scrapeStale = !deep?.last_scraped_at
    || (Date.now() - new Date(deep.last_scraped_at).getTime()) / 86400_000 > 60;

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title={`Compset · ${propertyName}${deep?.is_self ? ' · self' : ''}`}
        subtitle={`${summary?.set_name ?? 'Unassigned'} · last scraped ${fmtDate(deep?.last_scraped_at ?? null)}${scrapeStale ? ' (stale)' : ''}`}
        action={<RescrapeButton compId={comp_id} propertyName={propertyName} />}
      >
        {/* Hero + Facts row */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <Container title="Hero" subtitle="latest photo pulled from Booking.com">
            {deep?.hero_photo_url ? (
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: 4, background: '#F4F4EE' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={deep.hero_photo_url} alt={propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>
                No hero photo yet — click Rescrape to fetch.
              </div>
            )}
          </Container>

          <Container title="Facts" subtitle="brand · rating · rooms · location">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                <FactRow k="Brand"          v={deep?.brand ?? '—'} />
                <FactRow k="Affiliation"    v={deep?.affiliation ?? '—'} />
                <FactRow k="Star rating"    v={deep?.star_rating ? '★'.repeat(deep.star_rating) : '—'} />
                <FactRow k="Room count"     v={deep?.room_count ?? '—'} />
                <FactRow k="Year opened"    v={deep?.year_opened ?? '—'} />
                <FactRow k="Year renovated" v={deep?.year_renovated ?? '—'} />
                <FactRow k="To centre"      v={fmtDist(deep?.distance_to_centre_km ?? null)} />
                <FactRow k="To airport"     v={fmtDist(deep?.distance_to_airport_km ?? null)} />
                <FactRow k="Address"        v={deep?.address ?? '—'} />
                <FactRow k="Phone"          v={deep?.phone ?? '—'} />
                <FactRow k="Website" v={deep?.website_url
                  ? <a href={deep.website_url} target="_blank" rel="noopener noreferrer" style={{ color: '#084838' }}>{deep.website_url}</a>
                  : '—'} />
              </tbody>
            </table>
          </Container>
        </div>

        {/* Map — Google Maps embed with lat/lng */}
        {deep?.lat != null && deep?.lng != null && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title="Map" subtitle={`${deep.lat.toFixed(5)}, ${deep.lng.toFixed(5)}`}>
              <iframe
                title={`Map of ${propertyName}`}
                width="100%" height="300" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${deep.lat},${deep.lng}&z=15&output=embed`}
                style={{ border: '1px solid #E6DFCC', borderRadius: 4 }}
              />
            </Container>
          </div>
        )}

        {/* Rate signals from lighthouse */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Rate signals" subtitle="live from the lighthouse feed">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <SignalCell label="Latest USD"    value={summary?.latest_usd != null ? `$${Math.round(summary.latest_usd)}` : '—'} />
              <SignalCell label="Avg 30d USD"   value={summary?.avg_30d_usd != null ? `$${Math.round(summary.avg_30d_usd)}` : '—'} />
              <SignalCell label="vs Set median" value={summary?.pct_vs_median != null ? `${summary.pct_vs_median >= 0 ? '+' : '−'}${Math.abs(summary.pct_vs_median).toFixed(1)}%` : '—'} />
              <SignalCell label="Last shop"     value={summary?.last_shop_human ?? 'never'} />
            </div>
          </Container>
        </div>

        {/* Rooms table */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Rooms" subtitle="types, sizes, guests · from BdC scrape">
            {deep?.room_types && deep.room_types.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#FAFAF7' }}>
                  <tr>
                    <th style={cth}>Name</th>
                    <th style={{ ...cth, textAlign: 'right' }}>Size</th>
                    <th style={{ ...cth, textAlign: 'right' }}>Max guests</th>
                    <th style={cth}>Bed</th>
                    <th style={cth}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {deep.room_types.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #E6DFCC' }}>
                      <td style={ctd}>{r.name}</td>
                      <td style={{ ...ctd, textAlign: 'right' }}>{r.size_m2 != null ? `${r.size_m2} m²` : '—'}</td>
                      <td style={{ ...ctd, textAlign: 'right' }}>{r.max_guests ?? '—'}</td>
                      <td style={ctd}>{r.bed_type ?? '—'}</td>
                      <td style={ctd}>{r.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 16, color: '#5A5A5A', fontStyle: 'italic', fontSize: 12 }}>
                No room-type data yet — click Rescrape.
              </div>
            )}
          </Container>
        </div>

        {/* Facilities grid */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Facilities" subtitle="what's on offer">
            {deep?.facilities ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
                {Object.entries(deep.facilities).map(([k, v]) => (
                  <div key={k} style={{
                    padding: '6px 10px', border: '1px solid #E6DFCC', borderRadius: 4,
                    background: v ? '#F0F7F2' : '#FAFAF7',
                    color: v ? '#084838' : '#5A5A5A', fontSize: 12, fontWeight: v ? 600 : 500,
                    textTransform: 'capitalize',
                  }}>
                    {v ? '✓ ' : '○ '}{k.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 16, color: '#5A5A5A', fontStyle: 'italic', fontSize: 12 }}>No facility data yet.</div>
            )}
          </Container>
        </div>

        {/* Review pulse */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Review pulse" subtitle="latest scores across channels">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <ReviewCell channel="Booking.com" score={deep?.review_score_bdc ?? null} count={deep?.review_count_bdc ?? null} />
              <ReviewCell channel="Google"      score={deep?.review_score_google ?? null} count={deep?.review_count_google ?? null} />
              <ReviewCell channel="TripAdvisor" score={deep?.review_score_ta ?? null} count={deep?.review_count_ta ?? null} />
            </div>
          </Container>
        </div>

        {/* Photo gallery */}
        {deep?.photo_urls && deep.photo_urls.length > 1 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title="Photos" subtitle={`${deep.photo_urls.length} images pulled from BdC`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {deep.photo_urls.slice(0, 8).map((url, i) => (
                  <div key={i} style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderRadius: 4, background: '#F4F4EE' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`${propertyName} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            </Container>
          </div>
        )}

        {deep?.scrape_notes && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title="Scrape notes" subtitle="anything odd flagged by the scraper">
              <div style={{ padding: 12, background: '#FFFAF3', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, color: '#3A3A3A', whiteSpace: 'pre-wrap' }}>
                {deep.scrape_notes}
              </div>
            </Container>
          </div>
        )}
      </DashboardPage>
    </div>
  );
}

function FactRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <tr style={{ borderTop: '1px solid #F4F4EE' }}>
      <td style={{ padding: '6px 10px', color: '#5A5A5A', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</td>
      <td style={{ padding: '6px 10px', color: '#1B1B1B' }}>{v}</td>
    </tr>
  );
}

function SignalCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1B1B1B', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ReviewCell({ channel, score, count }: { channel: string; score: number | null; count: number | null }) {
  return (
    <div style={{ padding: 10, border: '1px solid #E6DFCC', borderRadius: 4 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A' }}>{channel}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1B1B1B' }}>{score != null ? score.toFixed(1) : '—'}</div>
      <div style={{ fontSize: 11, color: '#5A5A5A' }}>{count != null ? `${count} reviews` : 'no data'}</div>
    </div>
  );
}

const cth: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#5A5A5A' };
const ctd: React.CSSProperties = { padding: '8px 10px', color: '#1B1B1B' };
