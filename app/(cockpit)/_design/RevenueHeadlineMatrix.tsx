// app/(cockpit)/_design/RevenueHeadlineMatrix.tsx
// PBS 2026-08-24 · Replaces the four "Headline · <period>" stripes on the
// Revenue HoD with a single metric × period matrix.
//
// WHY. The four stripes each rendered `repeat(auto-fit, minmax(160px, 1fr))`
// with 8 / 7 / 6 / 6 tiles, so every stripe resolved to a different column
// width and OCC/ADR/RevPAR never lined up between them. Long labels truncated
// at that floor ("NEW BOOKINGS TOD…") and the LY pill overlapped the footnote
// whenever the pill was wide ("LY $12,761"). Transposing removes all three by
// construction: labels live in one fixed row header, LY sits on its own line.
//
// SHAPE. Today/Yesterday tiles are still built in app/revenue/page.tsx off its
// existing Promise.all and passed in — that query block is untouched. MTD/YTD
// are fetched here, same self-contained pattern as the RevenueMtdStripe /
// RevenueYtdStripe this replaces, so the parent Promise.all stays as it was.
//
// MetricRow is deliberately NOT used: it caps at 6 tiles and types its input as
// a flat KpiTileProps[], which cannot express a 2-D grid. Widening it would
// change behaviour for the 10+ sales/operations pages that depend on it.

import Container from './layout/Container';
import KpiTile from './tile/KpiTile';
import type { KpiTileProps, StatusTone } from './types';
import { supabase } from '@/lib/supabase';
import './internal/tokens.css';
import {
  CORE_ROWS, FLOW_ROWS, ROW_META,
  TAX_SERVICE, TAX_SERVICE_LY,
  aggregate, deriveKpis, indexTiles,
  fmtSlyPct, fmtSlyMoney, fmtSlyRn,
  tzForProperty, propertySymbol, localTodayIso,
  addDays, monthStart, yearStart, shiftYear,
  type Cell, type DailyRow, type RowKey,
} from '@/lib/revenue/headline-matrix';

interface Props {
  propertyId: number;
  todayTiles: KpiTileProps[];
  yesterdayTiles: KpiTileProps[];
}

type PeriodKey = 'today' | 'yesterday' | 'mtd' | 'ytd';

const HAIRLINE = 'var(--hairline, #E6DFCC)';
const INK      = 'var(--ink, #1B1B1B)';
const INK_SOFT = 'var(--ink-soft, #5A5A5A)';

const STATUS_COLOR: Record<StatusTone, string> = {
  green: 'var(--status-green, #1F5C2C)',
  amber: 'var(--status-amber, #B47A1F)',
  red:   'var(--status-red, #B04A2F)',
  grey:  'var(--status-grey, #5A5A5A)',
};

/** "2026-08-24" -> "24 Aug" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]}`;
}

async function fetchRange(pid: number, from: string, to: string): Promise<DailyRow[]> {
  const res = await supabase
    .from('v_kpi_daily_property')
    .select('night_date, rooms_available, rooms_sold, rooms_revenue, total_revenue')
    .eq('property_id', pid)
    .gte('night_date', from)
    .lte('night_date', to);
  return (res.data ?? []) as DailyRow[];
}

/** Build the cell set for an aggregated period (MTD / YTD), LY pill on every row. */
function cellsForPeriod(
  rows: DailyRow[], lyRows: DailyRow[], sym: string,
): Partial<Record<RowKey, Cell>> {
  const agg = aggregate(rows);
  const ly = aggregate(lyRows);
  if (agg.nights === 0) return {};

  const k = deriveKpis(agg, TAX_SERVICE);
  const lyK = deriveKpis(ly, TAX_SERVICE_LY);
  const money = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;

  return {
    occ: {
      value: `${k.occ.toFixed(1)}%`,
      ly: fmtSlyPct(lyK.occ),
      status: k.occ >= 60 ? 'green' : k.occ >= 40 ? 'amber' : 'grey',
      footnote: `${agg.sold.toLocaleString('en-US')} / ${agg.avail.toLocaleString('en-US')} rooms · ${agg.nights}d elapsed`,
    },
    adr: {
      value: money(k.adr),
      ly: fmtSlyMoney(lyK.adr, sym, 1),
      status: k.adr > 0 ? 'green' : 'grey',
      footnote: 'net rooms revenue ÷ rooms sold',
    },
    revpar: {
      value: money(k.revpar),
      ly: fmtSlyMoney(lyK.revpar, sym, 1),
      status: k.revpar > 0 ? 'green' : 'grey',
      footnote: 'net rooms revenue ÷ rooms available',
    },
    roomsRev: {
      value: money(k.netRoomsRev),
      ly: fmtSlyMoney(ly.roomsRev, sym, TAX_SERVICE_LY),
      status: k.netRoomsRev > 0 ? 'green' : 'grey',
      footnote: `net · ${agg.nights} nights actualized`,
    },
    totalRev: {
      value: money(k.netTotalRev),
      ly: fmtSlyMoney(ly.totalRev, sym, TAX_SERVICE_LY),
      status: k.netTotalRev > 0 ? 'green' : 'grey',
      footnote: 'rooms + F&B + ancillary · net',
    },
    nights: {
      value: String(agg.nights),
      ly: ly.nights > 0 ? fmtSlyRn(ly.nights)?.replace(' RN', 'd') : undefined,
      status: 'grey',
    },
  };
}

// ─── Cell renderer ─────────────────────────────────────────────────────────

function MatrixCell({ cell }: { cell?: Cell }) {
  if (!cell) {
    return <td style={S.td}><span style={{ color: INK_SOFT, fontSize: 13 }}>—</span></td>;
  }
  return (
    // PBS 2026-08-24: per-cell detail becomes a native hover tooltip — the
    // matrix has no line for it and `title` needs no JS in a server component.
    <td style={S.td} title={cell.footnote}>
      <span style={{ ...S.value, cursor: cell.footnote ? 'help' : 'default' }}>
        {cell.status && (
          <span aria-hidden="true" style={{ ...S.dot, background: STATUS_COLOR[cell.status] }} />
        )}
        {cell.value}
      </span>
      <span style={S.ly}>{cell.ly ?? ' '}</span>
    </td>
  );
}

function MatrixRows({ rows, periods, cells }: {
  rows: RowKey[];
  periods: PeriodKey[];
  cells: Record<PeriodKey, Partial<Record<RowKey, Cell>>>;
}) {
  return (
    <>
      {rows.map((rk) => {
        const meta = ROW_META[rk];
        // Drop a row only when NO period has it — never hide a populated metric.
        if (periods.every((p) => cells[p][rk] === undefined)) return null;
        return (
          <tr key={rk}>
            <th scope="row" style={S.rowh}>
              {meta.label}
              {meta.unit && <span style={S.unit}>{meta.unit}</span>}
            </th>
            {periods.map((p) => <MatrixCell key={p} cell={cells[p][rk]} />)}
          </tr>
        );
      })}
    </>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export default async function RevenueHeadlineMatrix({
  propertyId: pid, todayTiles, yesterdayTiles,
}: Props) {
  const tz = tzForProperty(pid);
  const sym = propertySymbol(pid);
  const today = localTodayIso(tz);
  const yesterday = addDays(today, -1);
  const mtdStart = monthStart(today);
  const ytdStart = yearStart(today);

  const [mtdRows, mtdLyRows, ytdRows, ytdLyRows] = await Promise.all([
    fetchRange(pid, mtdStart, yesterday).catch(() => [] as DailyRow[]),
    fetchRange(pid, shiftYear(mtdStart, -1), shiftYear(yesterday, -1)).catch(() => [] as DailyRow[]),
    fetchRange(pid, ytdStart, yesterday).catch(() => [] as DailyRow[]),
    fetchRange(pid, shiftYear(ytdStart, -1), shiftYear(yesterday, -1)).catch(() => [] as DailyRow[]),
  ]);

  const t = indexTiles(todayTiles);
  const y = indexTiles(yesterdayTiles);

  const cells: Record<PeriodKey, Partial<Record<RowKey, Cell>>> = {
    today:     t.byRow,
    yesterday: y.byRow,
    mtd:       cellsForPeriod(mtdRows, mtdLyRows, sym),
    ytd:       cellsForPeriod(ytdRows, ytdLyRows, sym),
  };

  const corePeriods: PeriodKey[] = ['today', 'yesterday', 'mtd', 'ytd'];
  const flowPeriods: PeriodKey[] = ['today', 'yesterday'];
  const pace = t.pace ?? y.pace;
  const extras = [...t.extras, ...y.extras];

  const headers: Record<PeriodKey, { label: string; range: string }> = {
    today:     { label: 'Today',     range: shortDate(today) },
    yesterday: { label: 'Yesterday', range: shortDate(yesterday) },
    mtd:       { label: 'MTD',       range: `${shortDate(mtdStart)} → ${shortDate(yesterday)}` },
    ytd:       { label: 'YTD',       range: `${shortDate(ytdStart)} → ${shortDate(yesterday)}` },
  };

  const hasFlow = FLOW_ROWS.some((rk) => flowPeriods.some((p) => cells[p][rk] !== undefined));

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Container
        title="Headline"
        subtitle={`${tz} · money NET (excl. 10% VAT + 10% service charge) · LY = same period last year · hover a value for detail`}
        density="compact"
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <caption style={S.srOnly}>
              Core revenue metrics by period: today, yesterday, month to date and year to date.
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ ...S.rowh, ...S.headCell }}><span style={S.srOnly}>Metric</span></th>
                {corePeriods.map((p) => (
                  <th key={p} scope="col" style={S.headCell}>
                    {headers[p].label}
                    <span style={S.range}>{headers[p].range}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <MatrixRows rows={CORE_ROWS} periods={corePeriods} cells={cells} />
            </tbody>
          </table>
        </div>

        {(hasFlow || pace) && (
          <div style={S.flow}>
            <div style={S.flowLabel}>Booking flow · room nights</div>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {hasFlow && (
                <div style={{ flex: '1 1 320px', overflowX: 'auto' }}>
                  <table style={S.table}>
                    <caption style={S.srOnly}>Booking flow in room nights for today and yesterday.</caption>
                    <thead>
                      <tr>
                        <th scope="col" style={{ ...S.rowh, ...S.headCell }}><span style={S.srOnly}>Metric</span></th>
                        {flowPeriods.map((p) => (
                          <th key={p} scope="col" style={S.headCell}>{headers[p].label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <MatrixRows rows={FLOW_ROWS} periods={flowPeriods} cells={cells} />
                    </tbody>
                  </table>
                </div>
              )}

              {pace && (
                // Forward-looking: not a period column, so it sits beside the grid.
                <div style={S.pace} title={pace.footnote}>
                  <div style={S.paceLabel}>{pace.label}</div>
                  <div style={S.paceValue}>{String(pace.value)}</div>
                  {pace.footnote && <div style={S.paceFoot}>{pace.footnote}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {extras.length > 0 && (
          // Safety net: cfg.kpiTiles is per-tenant, so a property may ship a
          // metric this matrix has no row for. Render it rather than drop it.
          <div style={S.extras}>
            <div style={S.flowLabel}>Also tracked</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {extras.map((e, i) => <KpiTile key={`${e.label}-${i}`} {...e} size="sm" />)}
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  srOnly: {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
    overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
  },
  table: {
    width: '100%', minWidth: 560, borderCollapse: 'collapse',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
  },
  headCell: {
    fontSize: 10, letterSpacing: '0.055em', textTransform: 'uppercase',
    fontWeight: 600, color: INK_SOFT, textAlign: 'right',
    borderBottom: `1px solid ${HAIRLINE}`, padding: '0 10px 5px', verticalAlign: 'bottom',
  },
  range: {
    display: 'block', fontSize: 9, letterSpacing: '0.01em', textTransform: 'none',
    fontWeight: 400, color: INK_SOFT, opacity: 0.8, marginTop: 1,
  },
  rowh: {
    textAlign: 'left', width: 156, paddingLeft: 0, paddingRight: 10,
    fontWeight: 500, fontSize: 12.5, color: INK, verticalAlign: 'baseline',
  },
  unit: {
    display: 'block', fontSize: 9.5, fontWeight: 400, color: INK_SOFT,
    letterSpacing: '0.01em', lineHeight: 1.3,
  },
  td: {
    textAlign: 'right', padding: '8px 10px', verticalAlign: 'baseline',
    borderTop: `1px solid ${HAIRLINE}`,
  },
  value: {
    fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: INK,
    display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end',
  },
  dot: { width: 5, height: 5, borderRadius: '50%', flexShrink: 0 },
  ly: { display: 'block', fontSize: 10, color: INK_SOFT, marginTop: 1, whiteSpace: 'nowrap' },
  flow: { marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIRLINE}` },
  flowLabel: {
    fontSize: 10, letterSpacing: '0.055em', textTransform: 'uppercase',
    color: INK_SOFT, fontWeight: 600, marginBottom: 6,
  },
  pace: {
    border: `1px solid ${HAIRLINE}`, borderRadius: 3, padding: '8px 12px',
    background: 'var(--paper-soft, #FAFAF7)', cursor: 'help', maxWidth: 260,
  },
  paceLabel: {
    fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: INK_SOFT,
  },
  paceValue: {
    fontSize: 17, fontWeight: 600, color: INK,
    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em',
  },
  paceFoot: { fontSize: 10, color: INK_SOFT, lineHeight: 1.35, marginTop: 1 },
  extras: { marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIRLINE}` },
};
