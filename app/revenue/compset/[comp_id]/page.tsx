// app/revenue/compset/[comp_id]/page.tsx
// PBS 2026-07-09 pm: Per-hotel deep-scrape landing page.
// Sources: v_competitor_property_deep (LLM scrape) + v_compset_property_summary (rates + reviews).
// Refresh button calls the scrape-competitor-profile edge fn.

import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';
import RescrapeButton from './_components/RescrapeButton';
import { REVENUE_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

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
  room_types: Array<{ name: string; size_m2: number | null; max_guests: number | null; bed_type: string | null; description: string | null; view: string | null; notes: string | null }> | null;
  restaurant_menu: Array<{ outlet: string; description: string | null; cuisine: string | null; hours: string | null; signature_dishes: string[] | null; price_range: string | null }> | null;
  spa_menu: Array<{ service: string; description: string | null; duration_min: number | null; price: string | null; category: string | null }> | null;
  unique_selling_points: string[] | null;
  meta_description: string | null;
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

  const [deepRes, summaryRes, rateMatrixRes, promoRes, plansRes, reviewsRes] = await Promise.all([
    sb.from('v_competitor_property_deep').select('*').eq('comp_id', comp_id).maybeSingle(),
    sb.from('v_compset_property_summary').select('set_name, latest_usd, avg_30d_usd, pct_vs_median, last_shop_human, property_name').eq('comp_id', comp_id).maybeSingle(),
    // PBS 2026-07-09 pm: Rate positioning history (shop_date × stay_date grid for this comp)
    sb.from('v_compset_competitor_rate_matrix').select('shop_date, stay_date, channel, rate_usd, is_available').eq('comp_id', comp_id).order('shop_date', { ascending: true }).order('stay_date', { ascending: true }).limit(500),
    // Promo behavior stats
    sb.from('v_compset_promo_behavior_signals').select('days_with_data, days_with_promo, promo_frequency_pct, avg_discount_pct, max_discount_seen, pattern_label').eq('comp_id', comp_id).maybeSingle(),
    // Rate plans landscape for this comp
    sb.from('v_compset_rate_plans_latest').select('channel, stay_date, taxonomy_code, refundability, meal_plan, raw_label, discount_pct, strikethrough_rate_usd, rate_usd').eq('comp_id', comp_id).order('stay_date', { ascending: true }).limit(200),
    // Reviews history
    sb.from('competitor_reviews').select('channel, review_score, review_count, shop_date').eq('comp_id', comp_id).order('shop_date', { ascending: false }).limit(20),
  ]);

  const deep = (deepRes.data ?? null) as DeepRow | null;
  const summary = (summaryRes.data ?? null) as (SummaryRow & { property_name: string | null }) | null;

  if (!deep && !summary) notFound();

  const propertyName = deep?.property_name ?? summary?.property_name ?? 'Unknown';

  // PBS 2026-07-09 pm: shape rate history — latest shop_date only, one point per stay_date per channel
  type RateRow = { shop_date: string; stay_date: string; channel: string | null; rate_usd: number | string | null; is_available: boolean | null };
  const rateHistory = (rateMatrixRes.data ?? []) as RateRow[];
  const latestShop = rateHistory.reduce<string | null>((acc, r) => (!acc || r.shop_date > acc) ? r.shop_date : acc, null);
  const latestRates = rateHistory
    .filter((r) => r.shop_date === latestShop && r.rate_usd != null)
    .sort((a, b) => (a.stay_date > b.stay_date ? 1 : -1));

  // Promo behavior single row
  type PromoBeh = { days_with_data: number | null; days_with_promo: number | null; promo_frequency_pct: number | string | null; avg_discount_pct: number | string | null; max_discount_seen: number | string | null; pattern_label: string | null };
  const promo = (promoRes.data ?? null) as PromoBeh | null;

  // Rate plans grouped by taxonomy_code
  type PlanRow = { channel: string | null; stay_date: string; taxonomy_code: string | null; refundability: string | null; meal_plan: string | null; raw_label: string | null; discount_pct: number | string | null; rate_usd: number | string | null };
  const plans = (plansRes.data ?? []) as PlanRow[];
  const planMix = new Map<string, { count: number; avgDisc: number; sample: string }>();
  for (const p of plans) {
    const k = p.taxonomy_code ?? 'unknown';
    const prev = planMix.get(k) ?? { count: 0, avgDisc: 0, sample: p.raw_label ?? '' };
    const disc = p.discount_pct != null ? Number(p.discount_pct) : 0;
    planMix.set(k, { count: prev.count + 1, avgDisc: prev.avgDisc + disc, sample: prev.sample || (p.raw_label ?? '') });
  }
  const planMixRows = Array.from(planMix.entries()).map(([k, v]) => ({
    taxonomy: k, count: v.count, avgDisc: v.count > 0 ? v.avgDisc / v.count : 0, sample: v.sample,
  })).sort((a, b) => b.count - a.count);

  // Reviews history — pick latest per channel
  type ReviewRow = { channel: string | null; review_score: number | string | null; review_count: number | null; shop_date: string };
  const reviews = (reviewsRes.data ?? []) as ReviewRow[];
  const latestReviewByChannel = new Map<string, ReviewRow>();
  for (const r of reviews) {
    const ch = r.channel ?? '';
    const prev = latestReviewByChannel.get(ch);
    if (!prev || r.shop_date > prev.shop_date) latestReviewByChannel.set(ch, r);
  }

  const scrapeStale = !deep?.last_scraped_at
    || (Date.now() - new Date(deep.last_scraped_at).getTime()) / 86400_000 > 60;

  // PBS 2026-07-09 pm: propagate Revenue sub-nav so top menu strip appears on the landing.
  const pid = deep?.property_id ?? 260955;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/compset'),
  }));

  const primaryContact = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {deep?.website_url && (
        <a href={deep.website_url} target="_blank" rel="noopener noreferrer"
          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#FFFFFF', color: '#084838', border: '1px solid #084838', borderRadius: 4, textDecoration: 'none' }}>
          Website ↗
        </a>
      )}
      {deep?.phone && (
        <a href={`tel:${deep.phone.replace(/[^\d+]/g, '')}`}
          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#FFFFFF', color: '#084838', border: '1px solid #084838', borderRadius: 4, textDecoration: 'none' }}>
          Call · {deep.phone}
        </a>
      )}
      <RescrapeButton compId={comp_id} propertyName={propertyName} />
    </div>
  );

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title={`Compset · ${propertyName}${deep?.is_self ? ' · self' : ''}`}
        subtitle={`${summary?.set_name ?? 'Unassigned'} · last scraped ${fmtDate(deep?.last_scraped_at ?? null)}${scrapeStale ? ' (stale)' : ''}`}
        tabs={tabs}
        action={primaryContact}
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

        {/* PBS 2026-07-09 pm: sales/rev-mgmt sections. Rate positioning moved to the bottom
            (PBS already has same on overview — redundant up top). */}

        {/* Promo behavior */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Promo cadence · discipline vs discounting"
            subtitle={promo?.pattern_label ?? 'pattern classification from v_compset_promo_behavior_signals'}>
            {promo ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <SignalCell label="Promo frequency" value={promo.promo_frequency_pct != null ? `${Math.round(Number(promo.promo_frequency_pct) * 100) / 100}%` : '—'} />
                <SignalCell label="Avg discount"    value={promo.avg_discount_pct != null ? `${Math.round(Number(promo.avg_discount_pct))}%` : '—'} />
                <SignalCell label="Max discount"    value={promo.max_discount_seen != null ? `${Math.round(Number(promo.max_discount_seen))}%` : '—'} />
                <SignalCell label="Days promoted"   value={promo.days_with_data && promo.days_with_data > 0 ? `${promo.days_with_promo ?? 0}/${promo.days_with_data}` : '—'} />
              </div>
            ) : (
              <div style={{ padding: 16, color: '#5A5A5A', fontStyle: 'italic', fontSize: 12 }}>No promo behavior data.</div>
            )}
          </Container>
        </div>

        {/* Rate plan mix */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title={`Rate plan mix · ${plans.length} recent observations`}
            subtitle="taxonomies offered · from v_compset_rate_plans_latest">
            {planMixRows.length === 0 ? (
              <div style={{ padding: 16, color: '#5A5A5A', fontStyle: 'italic', fontSize: 12 }}>No rate plan data for this comp.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#FAFAF7' }}>
                  <tr>
                    <th style={cth}>Taxonomy</th>
                    <th style={{ ...cth, textAlign: 'right' }}>Observations</th>
                    <th style={{ ...cth, textAlign: 'right' }}>Avg discount</th>
                    <th style={cth}>Sample label</th>
                  </tr>
                </thead>
                <tbody>
                  {planMixRows.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #F1EBD9' }}>
                      <td style={{ ...ctd, fontWeight: 600 }}>{r.taxonomy}</td>
                      <td style={{ ...ctd, textAlign: 'right' }}>{r.count}</td>
                      <td style={{ ...ctd, textAlign: 'right' }}>{r.avgDisc > 0 ? `${r.avgDisc.toFixed(1)}%` : '—'}</td>
                      <td style={ctd}>{r.sample || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Container>
        </div>

        {/* Reviews by channel */}
        {latestReviewByChannel.size > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title="Reviews · latest per channel" subtitle="from competitor_reviews snapshots">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {Array.from(latestReviewByChannel.entries()).map(([ch, r]) => (
                  <div key={ch} style={{ padding: 10, border: '1px solid #E6DFCC', borderRadius: 4 }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A' }}>{ch || 'unknown'}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1B1B1B' }}>{r.review_score != null ? Number(r.review_score).toFixed(1) : '—'}</div>
                    <div style={{ fontSize: 11, color: '#5A5A5A' }}>{r.review_count != null ? `${r.review_count} reviews` : 'no count'} · {r.shop_date}</div>
                  </div>
                ))}
              </div>
            </Container>
          </div>
        )}

        {/* Positioning summary + USPs */}
        {(deep?.meta_description || (deep?.unique_selling_points && deep.unique_selling_points.length > 0)) && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title="Positioning" subtitle="what they stand for · from BdC scrape">
              {deep?.meta_description && (
                <div style={{ padding: 12, background: '#FAFAF7', borderRadius: 4, fontSize: 13, color: '#1B1B1B', lineHeight: 1.5, marginBottom: 12 }}>
                  {deep.meta_description}
                </div>
              )}
              {deep?.unique_selling_points && deep.unique_selling_points.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {deep.unique_selling_points.map((usp, i) => (
                    <span key={i} style={{ padding: '4px 10px', border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#084838', fontSize: 12, fontWeight: 500, borderRadius: 999 }}>
                      {usp}
                    </span>
                  ))}
                </div>
              )}
            </Container>
          </div>
        )}

        {/* Rooms table — extended with view + description */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title={`Rooms · ${deep?.room_types?.length ?? 0} categories`} subtitle="size · beds · view · description · from BdC scrape">
            {deep?.room_types && deep.room_types.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#FAFAF7' }}>
                  <tr>
                    <th style={cth}>Category</th>
                    <th style={{ ...cth, textAlign: 'right' }}>Size</th>
                    <th style={{ ...cth, textAlign: 'right' }}>Guests</th>
                    <th style={cth}>Bed</th>
                    <th style={cth}>View</th>
                    <th style={cth}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {deep.room_types.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #E6DFCC' }}>
                      <td style={{ ...ctd, fontWeight: 600 }}>{r.name}</td>
                      <td style={{ ...ctd, textAlign: 'right' }}>{r.size_m2 != null ? `${r.size_m2} m²` : '—'}</td>
                      <td style={{ ...ctd, textAlign: 'right' }}>{r.max_guests ?? '—'}</td>
                      <td style={ctd}>{r.bed_type ?? '—'}</td>
                      <td style={ctd}>{r.view ?? '—'}</td>
                      <td style={{ ...ctd, color: '#3A3A3A', lineHeight: 1.45 }}>{r.description ?? r.notes ?? '—'}</td>
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

        {/* Restaurant / F&B */}
        {deep?.restaurant_menu && deep.restaurant_menu.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title={`Dining · ${deep.restaurant_menu.length} outlet${deep.restaurant_menu.length === 1 ? '' : 's'}`} subtitle="cuisine · hours · signature dishes · price band">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {deep.restaurant_menu.map((r, i) => (
                  <div key={i} style={{ padding: 12, border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1B1B1B', marginBottom: 4 }}>{r.outlet}</div>
                    {r.cuisine && <div style={{ fontSize: 11, color: '#084838', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{r.cuisine}{r.price_range ? ` · ${r.price_range}` : ''}</div>}
                    {r.description && <div style={{ fontSize: 12, color: '#3A3A3A', lineHeight: 1.5, marginBottom: 8 }}>{r.description}</div>}
                    {r.hours && <div style={{ fontSize: 11, color: '#5A5A5A' }}>Hours: {r.hours}</div>}
                    {r.signature_dishes && r.signature_dishes.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A', marginBottom: 4 }}>Signature</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.signature_dishes.map((d, j) => (
                            <span key={j} style={{ padding: '2px 8px', background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 11, color: '#1B1B1B' }}>{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Container>
          </div>
        )}

        {/* Spa / wellness */}
        {deep?.spa_menu && deep.spa_menu.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title={`Spa · ${deep.spa_menu.length} treatment${deep.spa_menu.length === 1 ? '' : 's'}`} subtitle="category · duration · price">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#FAFAF7' }}>
                  <tr>
                    <th style={cth}>Service</th>
                    <th style={cth}>Category</th>
                    <th style={{ ...cth, textAlign: 'right' }}>Duration</th>
                    <th style={{ ...cth, textAlign: 'right' }}>Price</th>
                    <th style={cth}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {deep.spa_menu.map((s, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #E6DFCC' }}>
                      <td style={{ ...ctd, fontWeight: 600 }}>{s.service}</td>
                      <td style={ctd}>{s.category ?? '—'}</td>
                      <td style={{ ...ctd, textAlign: 'right' }}>{s.duration_min != null ? `${s.duration_min}′` : '—'}</td>
                      <td style={{ ...ctd, textAlign: 'right' }}>{s.price ?? '—'}</td>
                      <td style={{ ...ctd, color: '#3A3A3A', lineHeight: 1.45 }}>{s.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Container>
          </div>
        )}

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

        {/* Rate positioning · demoted to the bottom per PBS 2026-07-09 pm (same view exists on overview) */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Rate positioning · next 90 days" subtitle={latestShop ? `snapshot ${latestShop} · reference — full picture lives on the overview` : 'no rate history yet'}>
            {latestRates.length === 0 ? (
              <div style={{ padding: 16, color: '#5A5A5A', fontStyle: 'italic', fontSize: 12 }}>No rate history in v_compset_competitor_rate_matrix.</div>
            ) : (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: '#084838', fontWeight: 600, padding: '6px 0' }}>
                  Show {latestRates.length} stay-date rate rows
                </summary>
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ background: '#FAFAF7' }}>
                      <tr>
                        <th style={cth}>Stay date</th>
                        <th style={cth}>Channel</th>
                        <th style={{ ...cth, textAlign: 'right' }}>Rate</th>
                        <th style={{ ...cth, textAlign: 'center' }}>Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestRates.slice(0, 60).map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #F1EBD9' }}>
                          <td style={ctd}>{r.stay_date}</td>
                          <td style={ctd}>{r.channel ?? '—'}</td>
                          <td style={{ ...ctd, textAlign: 'right' }}>{r.rate_usd != null ? `$${Math.round(Number(r.rate_usd))}` : '—'}</td>
                          <td style={{ ...ctd, textAlign: 'center' }}>{r.is_available ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {latestRates.length > 60 && (
                    <div style={{ padding: 8, fontSize: 11, color: '#5A5A5A', textAlign: 'center' }}>
                      showing 60 of {latestRates.length} · full history in v_compset_competitor_rate_matrix
                    </div>
                  )}
                </div>
              </details>
            )}
          </Container>
        </div>

        {/* Photo gallery */}
        {deep?.photo_urls && deep.photo_urls.length > 1 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title="Photos" subtitle={`${deep.photo_urls.length} images pulled from BdC`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {deep.photo_urls.slice(0, 12).map((url, i) => (
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
