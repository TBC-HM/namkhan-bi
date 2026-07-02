// app/revenue/cancellations/page.tsx
// PBS 2026-07-03: cancellations deep-dive linked from the Channels area.
// Analyzes cancellation source, country, room type, LOS bucket, DTA bucket,
// segment and rate plan so ops can spot patterns and act on them.
//
// Data source: public.v_cancellations_detail — per-cancellation row with
// lost_revenue recovered from pms.v_reservation_rooms.rate (Cloudbeds zeros
// total_amount on cancel, but per-night rates persist).

import Link from 'next/link';
import { DashboardPage, Container, KpiTile, Chart, type ChartSeries, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface CxlRow {
  reservation_id: string;
  cancellation_date: string;
  check_in_date: string;
  days_to_arrival: number | null;
  nights: number;
  source_name: string;
  guest_country: string | null;
  room_type_name: string;
  market_segment: string;
  rate_plan: string;
  lost_revenue: number;
  lost_room_nights: number;
  dta_bucket: string;
  los_bucket: string;
}

interface MonthImpactRow {
  cancel_year_month: string;
  cancellations: number;
  lost_room_nights: number;
  lost_revenue: number;
  avg_days_to_arrival: number | null;
}

const WIN_KEYS = ['30d','90d','365d','ytd','all'] as const;
type Win = typeof WIN_KEYS[number];
const DEFAULT_WIN: Win = '90d';
const WIN_LABEL: Record<Win, string> = {
  '30d':  'Last 30 days',
  '90d':  'Last 90 days',
  '365d': 'Last 365 days',
  'ytd':  'Year to date',
  'all':  'All time',
};

function shiftYearIso(iso: string, dy: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + dy);
  return d.toISOString().slice(0, 10);
}
function fmt$(n: number): string { return `$${Math.round(n).toLocaleString('en-US')}`; }
function isoBack(days: number): string { return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10); }

function resolveWin(raw: string | string[] | undefined): { win: Win; from: string; to: string } {
  const v = String(Array.isArray(raw) ? raw[0] : raw ?? '').toLowerCase();
  const win: Win = (WIN_KEYS as readonly string[]).includes(v) ? (v as Win) : DEFAULT_WIN;
  const today = new Date().toISOString().slice(0, 10);
  if (win === 'all')  return { win, from: '2020-01-01', to: today };
  if (win === 'ytd')  return { win, from: today.slice(0, 4) + '-01-01', to: today };
  if (win === '30d')  return { win, from: isoBack(30),  to: today };
  if (win === '90d')  return { win, from: isoBack(90),  to: today };
  return { win, from: isoBack(365), to: today };
}

function pctDelta(now: number, prior: number): { value: number; direction: 'up' | 'down' | 'flat' } {
  if (prior <= 0) return { value: 0, direction: 'flat' };
  const pct = ((now - prior) / prior) * 100;
  return { value: Math.round(pct * 10) / 10, direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
}

export default async function CancellationsPage({
  searchParams,
  propertyId,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  propertyId?: number;
}) {
  const pid = propertyId ?? PROPERTY_ID;
  const { win, from, to } = resolveWin(searchParams.win);
  const sdlyFrom = shiftYearIso(from, -1);
  const sdlyTo   = shiftYearIso(to,   -1);

  const [rows, sdlyRows, monthImpact, rateOverall] = await Promise.all([
    supabase.from('v_cancellations_detail')
      .select('reservation_id, cancellation_date, check_in_date, days_to_arrival, nights, source_name, guest_country, room_type_name, market_segment, rate_plan, lost_revenue, lost_room_nights, dta_bucket, los_bucket')
      .eq('property_id', pid)
      .gte('cancellation_date', from)
      .lte('cancellation_date', to)
      .order('cancellation_date', { ascending: false })
      .limit(2000)
      .then(r => (r.data ?? []) as CxlRow[]).catch(() => [] as CxlRow[]),
    supabase.from('v_cancellations_detail')
      .select('reservation_id, lost_revenue, lost_room_nights, nights, days_to_arrival')
      .eq('property_id', pid)
      .gte('cancellation_date', sdlyFrom)
      .lte('cancellation_date', sdlyTo)
      .limit(2000)
      .then(r => (r.data ?? []) as Array<{ lost_revenue: number; lost_room_nights: number; nights: number; days_to_arrival: number | null }>).catch(() => []),
    supabase.from('v_cancellation_impact_monthly')
      .select('cancel_year_month, cancellations, lost_room_nights, lost_revenue, avg_days_to_arrival')
      .eq('property_id', pid)
      .gte('cancel_year_month', '2025-01')
      .order('cancel_year_month')
      .then(r => (r.data ?? []) as MonthImpactRow[]).catch(() => []),
    supabase.from('v_cancellation_rate')
      .select('cancelled_30d, total_30d, cancel_rate_30d, cancelled_90d, total_90d, cancel_rate_90d')
      .eq('property_id', pid)
      .maybeSingle()
      .then(r => r.data as { cancelled_30d: number; total_30d: number; cancel_rate_30d: number; cancelled_90d: number; total_90d: number; cancel_rate_90d: number } | null).catch(() => null),
  ]);

  const cxlCount = rows.length;
  const lostRev  = rows.reduce((s, r) => s + Number(r.lost_revenue ?? 0), 0);
  const lostRn   = rows.reduce((s, r) => s + Number(r.lost_room_nights ?? 0), 0);
  const dtaVals  = rows.map(r => Number(r.days_to_arrival ?? 0)).filter((n) => Number.isFinite(n) && n >= 0);
  const avgDta   = dtaVals.length > 0 ? dtaVals.reduce((s, v) => s + v, 0) / dtaVals.length : 0;

  const sdlyCount   = sdlyRows.length;
  const sdlyLostRev = sdlyRows.reduce((s, r) => s + Number(r.lost_revenue ?? 0), 0);
  const sdlyLostRn  = sdlyRows.reduce((s, r) => s + Number(r.lost_room_nights ?? 0), 0);
  const sdlyDtaVals = sdlyRows.map(r => Number(r.days_to_arrival ?? 0)).filter((n) => Number.isFinite(n) && n >= 0);
  const sdlyAvgDta  = sdlyDtaVals.length > 0 ? sdlyDtaVals.reduce((s, v) => s + v, 0) / sdlyDtaVals.length : 0;
  const dCount  = pctDelta(cxlCount, sdlyCount);
  const dLostRev = pctDelta(lostRev, sdlyLostRev);
  const dLostRn  = pctDelta(lostRn,  sdlyLostRn);
  const dDta     = pctDelta(avgDta,  sdlyAvgDta);

  // Cancel rate — from v_cancellation_rate view (30d/90d built-in)
  const cxlRate30 = rateOverall ? Number(rateOverall.cancel_rate_30d ?? 0) : 0;
  const cxlRate90 = rateOverall ? Number(rateOverall.cancel_rate_90d ?? 0) : 0;
  const cxlRateHeadline = win === '30d' ? cxlRate30 : cxlRate90;
  const cxlRateWinLabel = win === '30d' ? '30d' : '90d';

  // Group helpers
  const group = <K,>(keyFn: (r: CxlRow) => K) => {
    const m = new Map<K, { count: number; lostRev: number; lostRn: number }>();
    for (const r of rows) {
      const k = keyFn(r);
      const c = m.get(k) ?? { count: 0, lostRev: 0, lostRn: 0 };
      c.count   += 1;
      c.lostRev += Number(r.lost_revenue ?? 0);
      c.lostRn  += Number(r.lost_room_nights ?? 0);
      m.set(k, c);
    }
    return m;
  };
  const bySource   = Array.from(group(r => r.source_name).entries()).sort((a, b) => b[1].count - a[1].count);
  const byCountry  = Array.from(group(r => r.guest_country ?? '—').entries()).sort((a, b) => b[1].count - a[1].count);
  const byRoom     = Array.from(group(r => r.room_type_name).entries()).sort((a, b) => b[1].count - a[1].count);
  const bySegment  = Array.from(group(r => r.market_segment).entries()).sort((a, b) => b[1].count - a[1].count);
  const byLos      = Array.from(group(r => r.los_bucket).entries()).sort((a, b) => losOrder(a[0]) - losOrder(b[0]));
  const byDta      = Array.from(group(r => r.dta_bucket).entries()).sort((a, b) => dtaOrder(a[0]) - dtaOrder(b[0]));

  const chartBySource = bySource.slice(0, 6).map(([source, v]) => ({ source, cancels: v.count, lost_usd: Math.round(v.lostRev) }));
  const chartByDta    = byDta.map(([bucket, v]) => ({ bucket, cancels: v.count, lost_usd: Math.round(v.lostRev) }));
  const chartByMonth  = monthImpact.map(m => ({
    month: m.cancel_year_month,
    cancels: Number(m.cancellations ?? 0),
    lost_rn: Number(m.lost_room_nights ?? 0),
  }));

  const tabs: DashboardTab[] = REVENUE_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/cancellations'),
  }));

  const winOptions: Win[] = ['30d', '90d', '365d', 'ytd', 'all'];
  const basePath = propertyId ? `/h/${propertyId}/revenue/cancellations` : '/revenue/cancellations';
  const hrefFor = (w: Win) => `${basePath}${w === DEFAULT_WIN ? '' : `?win=${w}`}`;

  const tiles: KpiTileProps[] = [
    { label: 'Cancellations',   value: cxlCount, size: 'sm',
      delta: sdlyCount > 0 ? { value: dCount.value, period: 'vs SDLY', direction: dCount.direction, isGoodWhenUp: false } : undefined,
      footnote: sdlyCount > 0 ? `SDLY ${sdlyCount}` : undefined },
    { label: `Cancel rate · ${cxlRateWinLabel}`, value: `${cxlRateHeadline.toFixed(1)}%`, size: 'sm',
      footnote: `${cxlRate30.toFixed(1)}% 30d · ${cxlRate90.toFixed(1)}% 90d` },
    { label: 'Lost revenue', value: Math.round(lostRev), currency: 'USD', size: 'sm',
      delta: sdlyLostRev > 0 ? { value: dLostRev.value, period: 'vs SDLY', direction: dLostRev.direction, isGoodWhenUp: false } : undefined,
      footnote: sdlyLostRev > 0 ? `SDLY ${fmt$(sdlyLostRev)}` : undefined },
    { label: 'Lost room nights', value: lostRn, size: 'sm',
      delta: sdlyLostRn > 0 ? { value: dLostRn.value, period: 'vs SDLY', direction: dLostRn.direction, isGoodWhenUp: false } : undefined,
      footnote: sdlyLostRn > 0 ? `SDLY ${sdlyLostRn}` : undefined },
    { label: 'Avg days to arrival', value: `${avgDta.toFixed(0)}d`, size: 'sm',
      delta: sdlyAvgDta > 0 ? { value: dDta.value, period: 'vs SDLY', direction: dDta.direction, isGoodWhenUp: true } : undefined,
      footnote: 'higher = more lead time to resell' },
  ];

  return (
    <DashboardPage
      title={`Revenue · Cancellations`}
      subtitle={`${WIN_LABEL[win]} · ${from} → ${to} · ${cxlCount} cancellations`}
      tabs={tabs}
    >
      {/* window picker */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', marginRight: 4 }}>Window:</span>
        {winOptions.map(w => (
          <Link key={w} href={hrefFor(w)} style={pillStyle(w === win)}>{w === 'ytd' ? 'YTD' : w === 'all' ? 'All' : `Last ${w}`}</Link>
        ))}
      </div>

      {/* KPI strip */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* Three small charts */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
        <Container title="Cancellations by channel" subtitle={`top ${chartBySource.length} · ${cxlCount} total`} density="compact">
          <Chart variant="bar" data={chartBySource} xKey="source"
            series={[
              { key: 'cancels',  label: 'Cancellations', color: '#B03826' },
              { key: 'lost_usd', label: 'Lost $',        color: '#B8542A' },
            ]}
            height={220}
            empty={{ title: 'No cancellations in window' }} />
        </Container>

        <Container title="Days-to-arrival buckets" subtitle="how much lead time do we lose the booking with" density="compact">
          <Chart variant="bar" data={chartByDta} xKey="bucket"
            series={[
              { key: 'cancels',  label: 'Cancellations', color: '#1F3A2E' },
              { key: 'lost_usd', label: 'Lost $',        color: '#B8542A' },
            ]}
            height={220}
            empty={{ title: 'No cancellations in window' }} />
        </Container>

        <Container title="Monthly trend" subtitle="from v_cancellation_impact_monthly · Jan 2025 →" density="compact">
          <Chart variant="line" data={chartByMonth} xKey="month"
            series={[
              { key: 'cancels', label: 'Cancellations', color: '#B03826' },
              { key: 'lost_rn', label: 'Lost RN',       color: '#1F3A2E' },
            ]}
            height={220}
            empty={{ title: 'No monthly impact data' }} />
        </Container>
      </div>

      {/* Two-column tables · country + room */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <BreakdownTable title="By country" rows={byCountry.slice(0, 12)} totalCount={cxlCount} />
        <BreakdownTable title="By room type" rows={byRoom} totalCount={cxlCount} />
      </div>

      {/* Two-column tables · LOS + segment */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <BreakdownTable title="By length of stay" rows={byLos} totalCount={cxlCount} />
        <BreakdownTable title="By market segment" rows={bySegment} totalCount={cxlCount} />
      </div>

      {/* Recent cancellations list */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Recent cancellations · ${Math.min(rows.length, 30)} of ${rows.length}`} subtitle="most recent first · lost value from per-night rate" density="compact">
          {rows.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No cancellations in window.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                    <th style={th}>Cancelled</th>
                    <th style={th}>For CI</th>
                    <th style={{ ...th, textAlign: 'right' }}>DTA</th>
                    <th style={th}>Source</th>
                    <th style={th}>Country</th>
                    <th style={th}>Room</th>
                    <th style={{ ...th, textAlign: 'right' }}>LOS</th>
                    <th style={{ ...th, textAlign: 'right' }}>Lost $</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 30).map((r) => (
                    <tr key={r.reservation_id} style={{ borderTop: '1px solid #E6DFCC' }}>
                      <td style={tdL}>{r.cancellation_date?.slice(0, 10)}</td>
                      <td style={tdL}>{r.check_in_date?.slice(0, 10)}</td>
                      <td style={tdR}>{r.days_to_arrival ?? '—'}</td>
                      <td style={tdL}>{r.source_name}</td>
                      <td style={tdL}>{r.guest_country ?? '—'}</td>
                      <td style={tdL}>{r.room_type_name}</td>
                      <td style={tdR}>{r.nights}</td>
                      <td style={tdR}>{r.lost_revenue > 0 ? fmt$(r.lost_revenue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}

function BreakdownTable({ title, rows, totalCount }: { title: string; rows: Array<[string, { count: number; lostRev: number; lostRn: number }]>; totalCount: number }) {
  return (
    <Container title={`${title} · ${rows.length}`} subtitle={`cancels · lost $ · lost RN · share`} density="compact">
      {rows.length === 0 ? (
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No data.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                <th style={th}>Bucket</th>
                <th style={{ ...th, textAlign: 'right' }}>Cancels</th>
                <th style={{ ...th, textAlign: 'right' }}>Lost $</th>
                <th style={{ ...th, textAlign: 'right' }}>Lost RN</th>
                <th style={{ ...th, textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k} style={{ borderTop: '1px solid #E6DFCC' }}>
                  <td style={tdL}>{k}</td>
                  <td style={tdR}>{v.count}</td>
                  <td style={tdR}>{v.lostRev > 0 ? `$${Math.round(v.lostRev).toLocaleString('en-US')}` : '—'}</td>
                  <td style={tdR}>{v.lostRn}</td>
                  <td style={tdR}>{totalCount > 0 ? `${((v.count / totalCount) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}

function losOrder(b: string): number { return ['1n','2-3n','4-7n','8+n'].indexOf(b); }
function dtaOrder(b: string): number { return ['0-1d','2-7d','8-30d','31-90d','90+d'].indexOf(b); }

function pillStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: 'inherit',
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 99,
    border: `1px solid ${active ? '#1F3A2E' : '#E6DFCC'}`,
    background: active ? '#1F3A2E' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#5A5A5A',
    fontWeight: active ? 600 : 500,
    textDecoration: 'none',
  };
}

const th: React.CSSProperties = { padding: '6px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#000', textAlign: 'left' };
const tdL: React.CSSProperties = { padding: '5px 10px', fontSize: 12, color: '#1B1B1B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 };
const tdR: React.CSSProperties = { padding: '5px 10px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1B1B1B' };
