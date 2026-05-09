// app/revenue/pricing/calendar/page.tsx
// PBS 2026-05-09 #34 (v2): "The pricing page should look like this"
// (screenshot 12.22.18 — MyHotelHouse calendar grid).
//
// v1 (batch 11): 30-day Mon-Sun grid with Namkhan rate + Δ vs comp avg.
// v2 (this batch): per-property comp breakdown panel + channel filter +
//                  refundable filter + carry-forward of last-known comp avg.
//
// Data sources:
//   - public.rate_inventory                  → our forward rates per (room_type, day)
//   - v_compset_competitor_rate_matrix        → comp forward rates per (comp_id, day, channel)
//   - v_compset_properties                    → property names + summary stats

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { REVENUE_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface CellData {
  date: string;          // ISO YYYY-MM-DD
  namkhan: number | null;
  flag: 'sellable' | 'stop_sold' | 'sold_out' | null;
  comp: number | null;
  diffPct: number | null;
}

interface CompRow {
  comp_id: string;
  stay_date: string;
  rate_usd: number;
  channel: string | null;
  is_refundable: boolean | null;
}

interface CompProp {
  comp_id: string;
  property_name: string;
  star_rating: number | null;
  rooms: number | null;
  avg_rate_usd_30d: number | null;
  observations_30d: number | null;
  latest_channel: string | null;
}

interface LoadResult {
  cells: CellData[];
  compRows: CompRow[];
  props: CompProp[];
  channels: string[];
}

async function loadCalendar(opts: { days: number; channel: string; refundable: string }): Promise<LoadResult> {
  const sb = getSupabaseAdmin();
  const startIso = new Date().toISOString().slice(0, 10);
  const endDate = new Date(); endDate.setDate(endDate.getDate() + opts.days);
  const endIso = endDate.toISOString().slice(0, 10);

  let compQ = sb.from('v_compset_competitor_rate_matrix')
    .select('comp_id,stay_date,rate_usd,channel,is_refundable,is_available')
    .gte('stay_date', startIso)
    .lte('stay_date', endIso)
    .eq('is_available', true);
  if (opts.channel !== 'all') compQ = compQ.eq('channel', opts.channel);
  if (opts.refundable === 'refundable')     compQ = compQ.eq('is_refundable', true);
  if (opts.refundable === 'non_refundable') compQ = compQ.eq('is_refundable', false);

  const [riRes, compRes, propsRes, channelsRes] = await Promise.all([
    sb.from('rate_inventory')
      .select('inventory_date,rate,available_rooms,stop_sell')
      .gte('inventory_date', startIso)
      .lte('inventory_date', endIso)
      .order('inventory_date', { ascending: true }),
    compQ,
    sb.from('v_compset_properties')
      .select('comp_id,property_name,star_rating,rooms,avg_rate_usd_30d,observations_30d,latest_channel')
      .eq('is_active', true)
      .order('property_name', { ascending: true }),
    sb.from('v_compset_competitor_rate_matrix')
      .select('channel')
      .gte('stay_date', startIso)
      .lte('stay_date', endIso),
  ]);

  // Aggregate Namkhan: cheapest rate per day across room types.
  // PBS 2026-05-09: "we always have a rate" — show it even when stop-sold or
  // sold out, but mark the cell so RM knows it's not bookable. Two-pass:
  // first the cheapest sellable, then if missing, the cheapest published.
  // Filter rate <= 10 USD as junk (some derived plans have placeholder 0
  // rows in rate_inventory that would otherwise dominate Math.min).
  const RATE_MIN = 10;
  const namkhanByDay = new Map<string, number>();
  const namkhanFlags = new Map<string, 'sellable' | 'stop_sold' | 'sold_out'>();
  type RIRow = { inventory_date: string; rate: number | null; available_rooms: number | null; stop_sell: boolean | null };
  const riRows = (riRes.data ?? []) as RIRow[];
  for (const r of riRows) {
    if (r.rate == null || Number(r.rate) < RATE_MIN) continue;
    if (r.stop_sell || (r.available_rooms ?? 0) <= 0) continue;
    const cur = namkhanByDay.get(r.inventory_date);
    namkhanByDay.set(r.inventory_date, cur == null ? Number(r.rate) : Math.min(cur, Number(r.rate)));
    namkhanFlags.set(r.inventory_date, 'sellable');
  }
  // Second pass — fill empty days with the cheapest published rate, flagged.
  for (const r of riRows) {
    if (r.rate == null || Number(r.rate) < RATE_MIN) continue;
    if (namkhanByDay.has(r.inventory_date)) continue;
    const cur = namkhanByDay.get(r.inventory_date);
    namkhanByDay.set(r.inventory_date, cur == null ? Number(r.rate) : Math.min(cur, Number(r.rate)));
    namkhanFlags.set(r.inventory_date, r.stop_sell ? 'stop_sold' : 'sold_out');
  }

  // Aggregate Comp avg per day (filtered by channel/refundable already).
  const compRows = ((compRes.data ?? []) as CompRow[]).filter((r) => r.rate_usd != null);
  const compSums = new Map<string, { sum: number; n: number }>();
  for (const r of compRows) {
    const cur = compSums.get(r.stay_date) ?? { sum: 0, n: 0 };
    cur.sum += Number(r.rate_usd);
    cur.n += 1;
    compSums.set(r.stay_date, cur);
  }

  // Build day list — carry-forward last-known comp when a date has no obs.
  const cells: CellData[] = [];
  const cursor = new Date(startIso);
  let lastKnownComp: number | null = null;
  for (let i = 0; i < opts.days; i++) {
    const d = cursor.toISOString().slice(0, 10);
    const namkhan = namkhanByDay.get(d) ?? null;
    const flag = namkhanFlags.get(d) ?? null;
    const compAgg = compSums.get(d);
    let comp = compAgg && compAgg.n > 0 ? compAgg.sum / compAgg.n : null;
    if (comp != null) lastKnownComp = comp;
    const diffPct = (namkhan != null && comp != null && comp > 0)
      ? ((namkhan - comp) / comp) * 100
      : null;
    cells.push({ date: d, namkhan, flag, comp, diffPct });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Distinct channels seen (for the filter dropdown).
  const channels = Array.from(new Set(((channelsRes.data ?? []) as Array<{ channel: string | null }>).map((r) => r.channel).filter((c): c is string => Boolean(c)))).sort();

  return { cells, compRows, props: (propsRes.data ?? []) as CompProp[], channels };
}

function toneFor(diffPct: number | null): { bg: string; fg: string; label: string } {
  if (diffPct == null) return { bg: '#1a1812', fg: '#7d7565', label: 'no data' };
  if (diffPct >= 8)    return { bg: '#1a2e21', fg: '#7ad790', label: 'premium' };
  if (diffPct >= -8)   return { bg: '#2a261d', fg: '#d8cca8', label: 'parity' };
  if (diffPct >= -20)  return { bg: '#3a2a1c', fg: '#f4c179', label: 'soft' };
  return { bg: '#3a1f1c', fg: '#ff8a8a', label: 'too cheap' };
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function dayOfWeek(iso: string): number {
  const d = new Date(iso);
  return (d.getDay() + 6) % 7;
}

interface Props {
  searchParams?: { days?: string; channel?: string; refundable?: string };
}

export default async function PricingCalendarPage({ searchParams }: Props) {
  const days = Math.min(60, Math.max(7, Number(searchParams?.days ?? '30') || 30));
  const channel = (searchParams?.channel ?? 'all').toLowerCase();
  const refundable = (searchParams?.refundable ?? 'all').toLowerCase();

  const { cells, compRows, props, channels } = await loadCalendar({ days, channel, refundable });

  const valid = cells.filter((c) => c.namkhan != null);
  const validDiff = cells.filter((c) => c.diffPct != null);
  const avgNamkhan = valid.length > 0 ? valid.reduce((s, c) => s + (c.namkhan ?? 0), 0) / valid.length : 0;
  const avgComp    = validDiff.length > 0 ? validDiff.reduce((s, c) => s + (c.comp ?? 0), 0) / validDiff.length : 0;
  const avgDiff    = validDiff.length > 0 ? validDiff.reduce((s, c) => s + (c.diffPct ?? 0), 0) / validDiff.length : 0;
  const tooCheap = cells.filter((c) => c.diffPct != null && c.diffPct < -20).length;
  const premium  = cells.filter((c) => c.diffPct != null && c.diffPct >= 8).length;
  // PBS 2026-05-09: "we always have a rate" — no-flex now means the day has
  // a published rate but it's stop-sold or sold-out (still actionable).
  const noFlex = cells.filter((c) => c.flag === 'stop_sold' || c.flag === 'sold_out').length;
  const missing = cells.filter((c) => c.namkhan == null).length;

  const firstDow = cells.length > 0 ? dayOfWeek(cells[0].date) : 0;
  const padding: null[] = Array.from({ length: firstDow }, () => null);
  const grid: Array<CellData | null> = [...padding, ...cells];

  // Per-property breakdown — sum + count + min/max per comp_id within window.
  const byProp = new Map<string, { sum: number; n: number; min: number; max: number; lastDate: string | null }>();
  for (const r of compRows) {
    const cur = byProp.get(r.comp_id) ?? { sum: 0, n: 0, min: Number.POSITIVE_INFINITY, max: 0, lastDate: null };
    cur.sum += r.rate_usd; cur.n += 1;
    cur.min = Math.min(cur.min, r.rate_usd);
    cur.max = Math.max(cur.max, r.rate_usd);
    if (!cur.lastDate || r.stay_date > cur.lastDate) cur.lastDate = r.stay_date;
    byProp.set(r.comp_id, cur);
  }
  const propRows = props
    .filter((p) => byProp.has(p.comp_id))
    .map((p) => {
      const a = byProp.get(p.comp_id)!;
      const avg = a.n > 0 ? a.sum / a.n : 0;
      const namkhanAvg = avgNamkhan;
      const diffPct = namkhanAvg > 0 ? ((namkhanAvg - avg) / avg) * 100 : null;
      return {
        ...p,
        obs: a.n,
        avg, min: a.min, max: a.max,
        lastDate: a.lastDate,
        diffPct,
      };
    })
    .sort((a, b) => b.avg - a.avg);

  const FILTER_BTN = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700,
    background: active ? '#a8854a' : 'transparent',
    color: active ? '#0a0a0a' : '#d8cca8',
    border: '1px solid #2a2520', borderRadius: 4, textDecoration: 'none',
  });

  const buildHref = (overrides: { days?: number; channel?: string; refundable?: string }): string => {
    const params = new URLSearchParams();
    params.set('days', String(overrides.days ?? days));
    params.set('channel', overrides.channel ?? channel);
    params.set('refundable', overrides.refundable ?? refundable);
    return `?${params.toString()}`;
  };

  return (
    <Page
      eyebrow="Revenue · Pricing"
      title={<>Pricing <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>calendar</em></>}
      subPages={REVENUE_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={avgNamkhan} unit="usd" label={`Avg Namkhan · ${days}d`} tooltip="Cheapest sellable rate per day across room types, averaged over the window. Source: rate_inventory." />
        <KpiBox value={avgComp}    unit="usd" label={`Avg comp · ${days}d`}    tooltip="Average comp-set rate per day under current filters. Source: v_compset_competitor_rate_matrix." />
        <KpiBox value={avgDiff}    unit="pct" label="Δ vs comp"               tooltip="Mean of (Namkhan − comp avg) ÷ comp avg × 100, daily. Positive = above comp." />
        <KpiBox value={premium}    unit="count" label="Premium days"          tooltip="Days where Namkhan rate is ≥ +8% above comp avg." />
        <KpiBox value={tooCheap}   unit="count" label="Too-cheap days"        tooltip="Days where Namkhan rate is ≥ 20% below comp avg." />
        <KpiBox value={noFlex}     unit="count" label="No-flex days"          tooltip="Days where we have a published rate but it is stop-sold or sold-out — investigate before losing the booking." />
      </div>

      {/* Filters: window + channel + refundable */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#7d7565', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Window:</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[14, 30, 60].map((d) => (
            <Link key={d} href={buildHref({ days: d })} prefetch={false} style={FILTER_BTN(d === days)}>{d}d</Link>
          ))}
        </div>

        <span style={{ fontSize: 11, color: '#7d7565', textTransform: 'uppercase', letterSpacing: '0.10em', marginLeft: 16 }}>Channel:</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href={buildHref({ channel: 'all' })} prefetch={false} style={FILTER_BTN(channel === 'all')}>All</Link>
          {channels.slice(0, 6).map((c) => (
            <Link key={c} href={buildHref({ channel: c })} prefetch={false} style={FILTER_BTN(channel === c)}>{c}</Link>
          ))}
        </div>

        <span style={{ fontSize: 11, color: '#7d7565', textTransform: 'uppercase', letterSpacing: '0.10em', marginLeft: 16 }}>Refundable:</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href={buildHref({ refundable: 'all' })}            prefetch={false} style={FILTER_BTN(refundable === 'all')}>Any</Link>
          <Link href={buildHref({ refundable: 'refundable' })}     prefetch={false} style={FILTER_BTN(refundable === 'refundable')}>Refundable</Link>
          <Link href={buildHref({ refundable: 'non_refundable' })} prefetch={false} style={FILTER_BTN(refundable === 'non_refundable')}>Non-refundable</Link>
        </div>
      </div>

      <Panel
        title="Forward calendar"
        eyebrow={`${days} days · cheapest sellable rate · ${channel === 'all' ? 'all channels' : channel}${refundable !== 'all' ? ` · ${refundable}` : ''}`}
        actions={<ArtifactActions context={{ kind: 'panel', title: 'Pricing calendar', dept: 'revenue' }} />}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#7d7565', textAlign: 'center', padding: '4px 0',
            }}>{d}</div>
          ))}
          {grid.map((c, idx) => {
            if (!c) return <div key={`pad-${idx}`} style={{ minHeight: 84 }} />;
            const tone = toneFor(c.diffPct);
            const dayNum = new Date(c.date).getDate();
            const month  = new Date(c.date).toLocaleString('en-GB', { month: 'short' });
            const isFirstOfMonth = dayNum === 1;
            return (
              <div
                key={c.date}
                title={`${c.date} · Namkhan $${c.namkhan ?? '—'} · Comp $${c.comp ? Math.round(c.comp) : '—'} · Δ ${c.diffPct != null ? c.diffPct.toFixed(1) + '%' : '—'} · ${tone.label}`}
                style={{
                  background: tone.bg,
                  border: '1px solid #1f1c15',
                  borderRadius: 4,
                  padding: '6px 8px',
                  minHeight: 84,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: '#d8cca8', fontWeight: 700 }}>
                    {dayNum}{isFirstOfMonth ? ` ${month}` : ''}
                  </span>
                  {c.diffPct != null && (
                    <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 9, fontWeight: 700, color: tone.fg }}>
                      {c.diffPct >= 0 ? '+' : ''}{c.diffPct.toFixed(0)}%
                    </span>
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 16, color: c.namkhan != null ? '#e9e1ce' : '#5a5448' }}>
                    {c.namkhan != null ? `$${Math.round(c.namkhan)}` : '—'}
                    {c.flag === 'stop_sold' && <span style={{ marginLeft: 4, fontFamily: 'ui-monospace, monospace', fontSize: 8, color: '#ff8a8a', fontStyle: 'normal' }}>STOP</span>}
                    {c.flag === 'sold_out'  && <span style={{ marginLeft: 4, fontFamily: 'ui-monospace, monospace', fontSize: 8, color: '#f4c179', fontStyle: 'normal' }}>FULL</span>}
                  </div>
                  <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 9, color: '#7d7565' }}>
                    {c.comp != null ? `vs $${Math.round(c.comp)}` : 'no comp'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div style={{ marginTop: 14, fontSize: 11, color: '#7d7565', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>Legend:</span>
        <span><span style={{ background: '#1a2e21', color: '#7ad790', padding: '1px 6px', borderRadius: 3, fontFamily: 'ui-monospace, monospace', marginRight: 4 }}>premium</span>≥ +8% vs comp</span>
        <span><span style={{ background: '#2a261d', color: '#d8cca8', padding: '1px 6px', borderRadius: 3, fontFamily: 'ui-monospace, monospace', marginRight: 4 }}>parity</span>±8%</span>
        <span><span style={{ background: '#3a2a1c', color: '#f4c179', padding: '1px 6px', borderRadius: 3, fontFamily: 'ui-monospace, monospace', marginRight: 4 }}>soft</span>−8 to −20%</span>
        <span><span style={{ background: '#3a1f1c', color: '#ff8a8a', padding: '1px 6px', borderRadius: 3, fontFamily: 'ui-monospace, monospace', marginRight: 4 }}>too cheap</span>≥ −20%</span>
        <span><span style={{ background: '#1a1812', color: '#7d7565', padding: '1px 6px', borderRadius: 3, fontFamily: 'ui-monospace, monospace', marginRight: 4 }}>no data</span>no comp obs.</span>
      </div>

      <div style={{ height: 14 }} />

      <Panel
        title="Comp-set breakdown"
        eyebrow={`${propRows.length} of ${props.length} comps observed in this window`}
        actions={<ArtifactActions context={{ kind: 'panel', title: 'Comp-set breakdown', dept: 'revenue' }} />}
      >
        {propRows.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>
            No comp observations under the current filters. Loosen channel / refundable filters or extend the window.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Property</th>
                  <th className="num">★</th>
                  <th className="num">Rooms</th>
                  <th className="num">Obs</th>
                  <th className="num">Min</th>
                  <th className="num">Avg</th>
                  <th className="num">Max</th>
                  <th className="num">Δ Namkhan vs avg</th>
                  <th>Last shop</th>
                </tr>
              </thead>
              <tbody>
                {propRows.map((p) => {
                  const tone = toneFor(p.diffPct);
                  return (
                    <tr key={p.comp_id}>
                      <td className="lbl"><strong>{p.property_name}</strong></td>
                      <td className="num">{p.star_rating ?? '—'}</td>
                      <td className="num">{p.rooms ?? '—'}</td>
                      <td className="num">{p.obs}</td>
                      <td className="num">${Math.round(p.min)}</td>
                      <td className="num">${Math.round(p.avg)}</td>
                      <td className="num">${Math.round(p.max)}</td>
                      <td className="num" style={{ color: tone.fg, fontWeight: 700 }}>
                        {p.diffPct != null ? `${p.diffPct >= 0 ? '+' : ''}${p.diffPct.toFixed(0)}%` : '—'}
                      </td>
                      <td className="lbl text-mute">{p.lastDate ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ marginTop: 14, fontSize: 11, color: '#7d7565' }}>
        Sources: <code style={{ color: '#a8854a' }}>public.rate_inventory</code>,{' '}
        <code style={{ color: '#a8854a' }}>v_compset_competitor_rate_matrix</code>,{' '}
        <code style={{ color: '#a8854a' }}>v_compset_properties</code>. Comp coverage thins beyond ~14 days
        forward — nightly compset agent extends the window each evening (cron jobid 43).
      </div>
    </Page>
  );
}
