// app/revenue/parity/page.tsx
// 2026-06-08 #127 rewrite — wire the actual gold views:
//   • v_parity_summary        — breach severity counts (rollup tiles)
//   • v_parity_matrix         — our_rate vs comp range per stay_date
//                               (line chart + Δ bars + grid)
//   • v_parity_grid           — OTA-by-day rate breakdown (wide format)
//   • v_parity_open_breaches  — actionable breach list (when populated)
//
// 2026-07-09 — added Own-OTA Rate Integrity block (top of page).
//   Source: v_rate_integrity_matrix (public bridge over
//   revenue.lighthouse_rateshop WHERE feed_source='integrity').
//   xlsx-fed daily: Brand.com / Booking.com / Expedia / Agoda / Tiket
//   LOS 1 · 2 guests. Donna renders empty until data arrives.
// 2026-07-09b — surface scrape + data-range in subtitle; full-width container.

import {
  DashboardPage, Container, KpiTile, Chart,
  type DashboardTab, type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import { LighthouseIngestStatus } from '../_shared/LighthouseIngestStatus';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number }

interface SummaryRow {
  open_critical: number; open_high: number; open_medium: number; open_low: number; open_total: number;
  detected_7d: number; detected_30d: number; last_detected_at: string | null;
}
interface MatrixRow {
  stay_date: string;
  namkhan_usd: number | null;
  namkhan_shop_date: string | null;
  comp_median_usd: number | null;
  comp_lowest_usd: number | null;
  comp_highest_usd: number | null;
  comps_with_price: number | null;
  comps_sold_out: number | null;
  comps_undercutting: string[] | null;
  num_comps_undercutting: number | null;
  pct_vs_cheapest_comp: number | null;
}
interface GridRow {
  stay_date: string;
  direct_usd:  number | null; direct_avail:  boolean | null;
  booking_usd: number | null; booking_avail: boolean | null;
  expedia_usd: number | null; expedia_avail: boolean | null;
  agoda_usd:   number | null; agoda_avail:   boolean | null;
  hotels_usd:  number | null; hotels_avail:  boolean | null;
  trip_usd:    number | null; trip_avail:    boolean | null;
  last_shop_date: string | null;
  loss_channels:  string[] | null;
  comp_lowest_usd: number | null;
}
interface BreachRow {
  breach_id: string; detected_at: string; shop_date: string; stay_date: string;
  severity: string; rule_code: string; rule_description: string | null;
  channel_a: string | null; channel_b: string | null;
  rate_a_usd: number | null; rate_b_usd: number | null;
  delta_usd: number | null; delta_pct: number | null;
  raw_room_type: string | null;
}
interface IntegrityRow {
  property_id: number;
  shop_date: string;
  stay_date: string;
  direct_usd: number | null;   direct_status: string | null;
  booking_usd: number | null;  booking_status: string | null;
  expedia_usd: number | null;  expedia_status: string | null;
  agoda_usd: number | null;    agoda_status: string | null;
  tiket_usd: number | null;    tiket_status: string | null;
  lowest_usd: number | null;
  highest_usd: number | null;
  spread_usd: number | null;
  spread_pct: number | null;
  otas_with_rate: number | null;
  otas_sold_out: number | null;
}

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function dayName(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return DOW[d.getUTCDay()] || '';
}

async function loadIntegrity(pid: number): Promise<IntegrityRow[]> {
  const { data } = await supabase
    .from('v_rate_integrity_matrix')
    .select('property_id, shop_date, stay_date, direct_usd, direct_status, booking_usd, booking_status, expedia_usd, expedia_status, agoda_usd, agoda_status, tiket_usd, tiket_status, lowest_usd, highest_usd, spread_usd, spread_pct, otas_with_rate, otas_sold_out')
    .eq('property_id', pid)
    .order('shop_date', { ascending: false })
    .order('stay_date', { ascending: true });
  const rows = (data ?? []) as IntegrityRow[];
  if (rows.length === 0) return [];
  const latestShop = rows[0].shop_date;
  return rows.filter((r) => r.shop_date === latestShop);
}

async function loadAll(pid: number): Promise<{
  summary: SummaryRow | null;
  matrix: MatrixRow[];
  grid: GridRow[];
  breaches: BreachRow[];
}> {
  const isNamkhan = pid === NAMKHAN_PROPERTY_ID;
  const [summaryR, matrixR, gridR, breachesR] = await Promise.all([
    supabase.from('v_parity_summary_pb').select('*').eq('property_id', pid),
    supabase.from('v_parity_matrix_pb').select('*').eq('property_id', pid).order('stay_date'),
    isNamkhan
      ? supabase.from('v_parity_grid').select('*').order('stay_date')
      : Promise.resolve({ data: [] as GridRow[] } as { data: GridRow[] }),
    isNamkhan
      ? supabase.from('v_parity_open_breaches').select('*').limit(50)
      : Promise.resolve({ data: [] as BreachRow[] } as { data: BreachRow[] }),
  ]);
  return {
    summary:  ((summaryR.data ?? []) as SummaryRow[])[0] ?? null,
    matrix:   (matrixR.data ?? []) as MatrixRow[],
    grid:     (gridR.data ?? []) as GridRow[],
    breaches: (breachesR.data ?? []) as BreachRow[],
  };
}

function fmtPct(v: number | null | undefined, signed = false): string {
  if (v == null) return EMPTY;
  const n = Number(v);
  const sign = signed && n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

function fmtIntegrityCell(usd: number | null, status: string | null): string {
  if (status === 'sold_out') return 'Sold out';
  if (usd == null) return EMPTY;
  return fmtTableUsd(usd);
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const t = new Date(iso);
  const ms = Date.now() - t.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };
const INTEGRITY_ALERT_PCT = 0.05; // >5% spread = amber, >15% = red

export default async function ParityPage({ propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/parity') }));

  const [data, integrity] = await Promise.all([loadAll(pid), loadIntegrity(pid)]);
  const summary = data.summary;
  const matrix = data.matrix;
  const grid = data.grid;

  const lastShopMatrix = matrix.map((r) => r.namkhan_shop_date).filter((d): d is string => !!d).sort().pop() ?? null;
  const lastShopGrid   = grid.map((r) => r.last_shop_date).filter((d): d is string => !!d).sort().pop() ?? null;
  const lastShopIso    = [lastShopMatrix, lastShopGrid].filter((x): x is string => !!x).sort().pop() ?? null;

  // ── Integrity KPIs (own-OTA parity) ────────────────────────────────────
  const integrityShopDate = integrity[0]?.shop_date ?? null;
  const integrityFirstStay = integrity[0]?.stay_date ?? null;
  const integrityLastStay  = integrity[integrity.length - 1]?.stay_date ?? null;
  const spreadsPct = integrity.map((r) => Number(r.spread_pct ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
  const maxSpreadPct = spreadsPct.length === 0 ? null : Math.max(...spreadsPct);
  const avgSpreadPct = spreadsPct.length === 0 ? null : spreadsPct.reduce((a, b) => a + b, 0) / spreadsPct.length;
  const daysWithBreach = integrity.filter((r) => Number(r.spread_pct ?? 0) >= INTEGRITY_ALERT_PCT).length;
  const totalSoldOutCells = integrity.reduce((a, r) => a + Number(r.otas_sold_out ?? 0), 0);
  const integrityTiles: KpiTileProps[] = [
    { label: 'Max OTA spread', value: maxSpreadPct != null ? fmtPct(maxSpreadPct * 100) : EMPTY, size: 'sm',
      footnote: `avg ${avgSpreadPct != null ? fmtPct(avgSpreadPct * 100) : EMPTY}`,
      status: maxSpreadPct == null ? 'grey' : maxSpreadPct >= 0.15 ? 'red' : maxSpreadPct >= 0.05 ? 'amber' : 'green' },
    { label: 'Days ≥ 5% spread', value: daysWithBreach, size: 'sm',
      footnote: `of ${integrity.length} stay-dates`,
      status: integrity.length === 0 ? 'grey' : daysWithBreach === 0 ? 'green' : daysWithBreach >= integrity.length / 2 ? 'red' : 'amber' },
    { label: 'Sold-out cells', value: totalSoldOutCells, size: 'sm',
      footnote: 'OTAs marking rooms unavailable',
      status: totalSoldOutCells === 0 ? 'green' : 'grey' },
    { label: 'Latest scrape', value: integrityShopDate ? fmtIsoDate(integrityShopDate) : EMPTY, size: 'sm',
      footnote: integrityFirstStay && integrityLastStay
        ? `covers ${fmtIsoDate(integrityFirstStay)} → ${fmtIsoDate(integrityLastStay)}`
        : 'awaiting first scrape',
      status: integrityShopDate ? 'grey' : 'grey' },
  ];

  // ── Integrity table matching xlsx layout ───────────────────────────────
  const integrityTable = integrity.map((r) => ({
    day:      dayName(r.stay_date),
    stay:     fmtIsoDate(r.stay_date),
    direct:   fmtIntegrityCell(r.direct_usd,  r.direct_status),
    booking:  fmtIntegrityCell(r.booking_usd, r.booking_status),
    expedia:  fmtIntegrityCell(r.expedia_usd, r.expedia_status),
    agoda:    fmtIntegrityCell(r.agoda_usd,   r.agoda_status),
    tiket:    fmtIntegrityCell(r.tiket_usd,   r.tiket_status),
    spread:   r.spread_usd != null ? fmtTableUsd(r.spread_usd) : EMPTY,
    spreadPct: fmtPct(r.spread_pct != null ? Number(r.spread_pct) * 100 : null),
  }));
  const integrityCols: ChartSeries[] = [
    { key: 'day',       label: 'Day' },
    { key: 'stay',      label: 'Date' },
    { key: 'direct',    label: 'The Namkhan' },
    { key: 'booking',   label: 'Booking.com' },
    { key: 'expedia',   label: 'Expedia' },
    { key: 'agoda',     label: 'Agoda' },
    { key: 'tiket',     label: 'Tiket' },
    { key: 'spread',    label: 'Spread' },
    { key: 'spreadPct', label: 'Spread %' },
  ];

  const integritySubtitle = integrityShopDate && integrityFirstStay && integrityLastStay
    ? `scrape ${fmtIsoDate(integrityShopDate)} · data covers ${fmtIsoDate(integrityFirstStay)} → ${fmtIsoDate(integrityLastStay)} (${integrity.length} stay-dates) · lowest available rate without fees & VAT · net · 15% added later`
    : 'own rate observed across each OTA · spread flags parity leaks · lowest available rate without fees & VAT · net · 15% added later';

  // ── Existing compset KPIs & tables (unchanged) ─────────────────────────
  const matrixWithPct  = matrix.filter((r) => r.pct_vs_cheapest_comp != null);
  const daysShopped    = matrix.filter((r) => r.namkhan_usd != null && (r.comps_with_price ?? 0) > 0).length;
  const avgPctVsCheap  = matrixWithPct.length === 0 ? null
    : matrixWithPct.reduce((acc, r) => acc + Number(r.pct_vs_cheapest_comp ?? 0), 0) / matrixWithPct.length;
  const daysUndercut   = matrix.filter((r) => (r.num_comps_undercutting ?? 0) > 0).length;
  const avgNumUndercut = matrix.length === 0 ? 0
    : matrix.reduce((acc, r) => acc + Number(r.num_comps_undercutting ?? 0), 0) / matrix.length;

  const tiles: KpiTileProps[] = [
    { label: 'Days shopped', value: daysShopped, size: 'sm',
      footnote: lastShopIso ? `last shop ${fmtIsoDate(lastShopIso)}` : 'no shop yet',
      status: daysShopped === 0 ? 'grey' : 'green' },
    { label: 'Avg Δ vs cheapest comp', value: avgPctVsCheap != null ? fmtPct(avgPctVsCheap, true) : EMPTY, size: 'sm',
      footnote: 'positive = we sit ABOVE the cheapest comp',
      status: avgPctVsCheap == null ? 'grey' : avgPctVsCheap > 20 ? 'red' : avgPctVsCheap > 5 ? 'amber' : 'green' },
    { label: 'Days undercut by comps', value: daysUndercut, size: 'sm',
      footnote: `of ${matrix.length} stay-dates shopped`,
      status: daysUndercut === 0 ? 'green' : daysUndercut >= matrix.length / 2 ? 'red' : 'amber' },
    { label: 'Avg # comps under us', value: avgNumUndercut.toFixed(1), size: 'sm',
      footnote: 'mean per stay-date',
      status: avgNumUndercut > 3 ? 'red' : avgNumUndercut > 1 ? 'amber' : 'green' },
    { label: 'Open breaches · total', value: summary?.open_total ?? 0, size: 'sm',
      footnote: 'cross-channel rate-parity rule hits',
      status: (summary?.open_total ?? 0) === 0 ? 'green' : (summary?.open_total ?? 0) >= 5 ? 'red' : 'amber' },
    { label: 'Detected · last 7d', value: summary?.detected_7d ?? 0, size: 'sm',
      footnote: `last 30d: ${summary?.detected_30d ?? 0}`,
      status: 'grey' },
  ];

  const rangeData = matrix.map((r) => ({
    stay_date: r.stay_date,
    namkhan: r.namkhan_usd != null ? Number(r.namkhan_usd) : null,
    lowest:  r.comp_lowest_usd  != null ? Number(r.comp_lowest_usd)  : null,
    median:  r.comp_median_usd  != null ? Number(r.comp_median_usd)  : null,
    highest: r.comp_highest_usd != null ? Number(r.comp_highest_usd) : null,
  }));
  const rangeSeries: ChartSeries[] = [
    { key: 'namkhan', label: 'Namkhan' },
    { key: 'lowest',  label: 'Cheapest comp' },
    { key: 'median',  label: 'Median comp' },
    { key: 'highest', label: 'Highest comp' },
  ];

  const deltaData = matrix
    .filter((r) => r.pct_vs_cheapest_comp != null)
    .map((r) => ({
      stay_date: r.stay_date,
      delta_pct: Math.round(Number(r.pct_vs_cheapest_comp ?? 0) * 10) / 10,
    }));
  const deltaSeries: ChartSeries[] = [
    { key: 'delta_pct', label: 'Δ vs cheapest %' },
  ];

  const matrixTable = matrix.map((r) => ({
    stay_date:  fmtIsoDate(r.stay_date),
    namkhan:    fmtTableUsd(r.namkhan_usd),
    lowest:     fmtTableUsd(r.comp_lowest_usd),
    median:     fmtTableUsd(r.comp_median_usd),
    highest:    fmtTableUsd(r.comp_highest_usd),
    comps:      r.comps_with_price ?? EMPTY,
    undercut:   r.num_comps_undercutting ?? EMPTY,
    delta_pct:  fmtPct(r.pct_vs_cheapest_comp, true),
  }));
  const matrixCols: ChartSeries[] = [
    { key: 'stay_date', label: 'Stay date' },
    { key: 'namkhan',   label: 'Our rate' },
    { key: 'lowest',    label: 'Cheapest' },
    { key: 'median',    label: 'Median' },
    { key: 'highest',   label: 'Highest' },
    { key: 'comps',     label: 'Comps' },
    { key: 'undercut',  label: '# under us' },
    { key: 'delta_pct', label: 'Δ vs cheapest' },
  ];

  const otaTable = grid.map((r) => ({
    stay_date:   fmtIsoDate(r.stay_date),
    direct:      r.direct_usd  != null ? fmtTableUsd(r.direct_usd)  : EMPTY,
    booking:     r.booking_usd != null ? fmtTableUsd(r.booking_usd) : EMPTY,
    agoda:       r.agoda_usd   != null ? fmtTableUsd(r.agoda_usd)   : EMPTY,
    expedia:     r.expedia_usd != null ? fmtTableUsd(r.expedia_usd) : EMPTY,
    hotels:      r.hotels_usd  != null ? fmtTableUsd(r.hotels_usd)  : EMPTY,
    trip:        r.trip_usd    != null ? fmtTableUsd(r.trip_usd)    : EMPTY,
    comp_lowest: fmtTableUsd(r.comp_lowest_usd),
    last_shop:   r.last_shop_date ? fmtIsoDate(r.last_shop_date) : EMPTY,
  }));
  const otaCols: ChartSeries[] = [
    { key: 'stay_date',   label: 'Stay date' },
    { key: 'direct',      label: 'The Namkhan' },
    { key: 'booking',     label: 'Booking' },
    { key: 'agoda',       label: 'Agoda' },
    { key: 'expedia',     label: 'Expedia' },
    { key: 'hotels',      label: 'Hotels' },
    { key: 'trip',        label: 'Trip' },
    { key: 'comp_lowest', label: 'Comp ↓' },
    { key: 'last_shop',   label: 'Last shop' },
  ];

  const breachRows = data.breaches
    .slice()
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .map((b) => ({
      severity: b.severity.toUpperCase(),
      rule:     b.rule_code,
      stay:     fmtIsoDate(b.stay_date),
      room:     b.raw_room_type ?? EMPTY,
      channel:  `${(b.channel_a ?? EMPTY).toUpperCase()}${b.channel_b && b.channel_b !== b.channel_a ? ` / ${b.channel_b.toUpperCase()}` : ''}`,
      rate_a:   fmtTableUsd(b.rate_a_usd),
      rate_b:   fmtTableUsd(b.rate_b_usd),
      delta:    b.delta_usd != null
        ? (b.delta_usd >= 0 ? '+' : '−') + fmtTableUsd(Math.abs(b.delta_usd))
        : EMPTY,
      delta_pct: fmtPct(b.delta_pct, true),
      detected:  fmtRelative(b.detected_at),
    }));
  const breachCols: ChartSeries[] = [
    { key: 'rule',      label: 'Rule' },
    { key: 'stay',      label: 'Stay' },
    { key: 'room',      label: 'Room' },
    { key: 'channel',   label: 'Channel' },
    { key: 'rate_a',    label: 'Rate A' },
    { key: 'rate_b',    label: 'Rate B' },
    { key: 'delta',     label: 'Δ' },
    { key: 'delta_pct', label: 'Δ %' },
    { key: 'detected',  label: 'Detected' },
  ];

  return (
    <DashboardPage
      title="Revenue · Parity"
      subtitle={lastShopIso ? `competitive pricing position · last shop ${fmtIsoDate(lastShopIso)}` : 'awaiting first shop'}
      tabs={tabs}
    >
      {/* 2026-07-14 — Daily email-ingest status strip */}
      <div style={{ gridColumn: '1 / -1' }}>
        <LighthouseIngestStatus report="rate_integrity" />
      </div>
      {/* 2026-07-09 — Own-OTA Rate Integrity strip (LOS 1 · 2 guests) */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 0 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
          Own-OTA rate integrity · LOS 1 · 2 guests{integrityShopDate ? ` · scrape ${fmtIsoDate(integrityShopDate)}` : ''}{integrityFirstStay && integrityLastStay ? ` · data ${fmtIsoDate(integrityFirstStay)} → ${fmtIsoDate(integrityLastStay)}` : ''}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          {integrityTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </div>

      {/* Full-width integrity matrix — spans whole page grid */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Own-OTA rate integrity matrix · ${integrity.length} stay-dates`}
          subtitle={integritySubtitle}>
          <Chart variant="table" data={integrityTable} xKey="stay"
            series={integrityCols}
            empty={{ title: pid === NAMKHAN_PROPERTY_ID ? 'no integrity scrape yet' : 'integrity feed pending for this property',
                     hint: pid === NAMKHAN_PROPERTY_ID ? 'upload integrity.xlsx via /imports/parity/' : 'data will appear once the daily feed is wired' }}
          />
        </Container>
      </div>

      {/* PBS 2026-06-08 #128 — single-row 6-up head strip, mirrors LeakageYtdTiles pattern */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 0 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
          Parity headline · our position vs the comp set{lastShopIso ? ` · last shop ${fmtIsoDate(lastShopIso)}` : ''}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </div>

      <Container title="Our rate vs comp range" subtitle="namkhan_usd plotted against cheapest / median / highest comp · per stay date">
        <Chart variant="line" data={rangeData} xKey="stay_date"
          series={rangeSeries}
          height={300}
          empty={{ title: 'No parity matrix data', hint: 'v_parity_matrix returned 0 rows' }}
        />
      </Container>

      <Container title="Δ vs cheapest comp · per stay date" subtitle="positive = we sit ABOVE the cheapest competing rate · negative = we are below">
        <Chart variant="bar" data={deltaData} xKey="stay_date"
          series={deltaSeries}
          height={260}
          empty={{ title: 'No comparable rates', hint: 'no overlap between our rate and any comp rate' }}
        />
      </Container>

      <Container title={`Daily parity grid · ${matrix.length} stay-dates shopped`} subtitle="raw competitive position per stay date">
        <Chart variant="table" data={matrixTable} xKey="stay_date"
          series={matrixCols}
          empty={{ title: 'No matrix rows' }}
        />
      </Container>

      <Container title={`OTA channel rates · ${grid.length} stay-dates shopped`} subtitle="our distribution channel rates from comp-set shopping · NULL = not shopped that day">
        <Chart variant="table" data={otaTable} xKey="stay_date"
          series={otaCols}
          empty={{ title: 'No grid rows' }}
        />
      </Container>

      <Container title={`Open breaches · ${data.breaches.length}`} subtitle="cross-channel rate-parity rule hits requiring action">
        <Chart variant="table" data={breachRows} xKey="severity"
          series={breachCols}
          empty={{ title: 'No open breaches', hint: 'parity holds across all checks' }}
        />
      </Container>
    </DashboardPage>
  );
}
