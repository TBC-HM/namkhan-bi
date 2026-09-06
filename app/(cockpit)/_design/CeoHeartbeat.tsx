// app/(cockpit)/_design/CeoHeartbeat.tsx
// PBS 2026-08-26 · The per-property CEO heartbeat.
//
// Built for a CEO who is away most of the time: one score against two
// benchmarks, then the three questions that actually drive a call — is the
// hotel making money, what is already sold, are guests spending beyond the
// room — and finally what is waiting on them.
//
// PER PROPERTY, never combined (PBS 2026-08-26). The two hotels run opposite
// seasons: Namkhan's strongest month is December, Donna is effectively closed
// in November. Any portfolio average describes neither.
//
// Composed entirely from existing atoms — Container, KpiTile, MetricMatrix.
// Score benchmarks use KpiTile `compare[]` per design_system §3.1; the budget
// line renders via status 'pending' (an italic dash) until a budget is
// uploaded, then lights up on its own with no code change.

import Container from './layout/Container';
import KpiTile from './tile/KpiTile';
import MetricMatrix, { type MatrixRow, type MatrixCell, type MatrixTone } from './MetricMatrix';
import AncillaryCapture from './AncillaryCapture';
import type { KpiTileProps, Currency } from './types';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildScore, toComparison, fillPct, deltaFromIndex,
  occupancy, adr, revpar, EMPTY_TOTALS, type PeriodTotals,
} from '@/lib/ceo/heartbeat';
// Shared property helpers — same tz/currency contract the Revenue HoD uses.
import {
  tzForProperty, propertySymbol, localTodayIso, addDays, shiftYear, yearStart,
} from '@/lib/revenue/headline-matrix';

interface Props {
  propertyId: number;
  currency?: Currency;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface DailyRow {
  night_date: string | null;
  rooms_available: number | null;
  rooms_sold: number | null;
  rooms_revenue: number | string | null;
  total_revenue: number | string | null;
}

function totals(rows: DailyRow[]): PeriodTotals {
  return rows.reduce<PeriodTotals>((a, r) => ({
    roomsRevenue:   a.roomsRevenue   + Number(r.rooms_revenue ?? 0),
    totalRevenue:   a.totalRevenue   + Number(r.total_revenue ?? 0),
    roomsSold:      a.roomsSold      + Number(r.rooms_sold ?? 0),
    roomsAvailable: a.roomsAvailable + Number(r.rooms_available ?? 0),
  }), { ...EMPTY_TOTALS });
}

const money = (n: number | null, sym: string) =>
  n == null ? '—' : `${sym}${Math.round(n).toLocaleString('en-US')}`;
const pct = (n: number | null, dp = 1) => n == null ? '—' : `${n.toFixed(dp)}%`;

/** Tone for a share-of-revenue cost ratio: lower is better. */
function costTone(v: number | null): MatrixTone | undefined {
  if (v == null) return undefined;
  return v >= 80 ? 'neg' : v >= 45 ? 'warn' : 'pos';
}
function marginTone(v: number | null): MatrixTone | undefined {
  if (v == null) return undefined;
  return v < 0 ? 'neg' : v >= 25 ? 'pos' : 'warn';
}
const cell = (value: string, tone?: MatrixTone, extra?: Partial<MatrixCell>): MatrixCell =>
  ({ value, tone, ...extra });

export default async function CeoHeartbeat({ propertyId: pid, currency }: Props) {
  const sb  = getSupabaseAdmin();
  const tz  = tzForProperty(pid);
  const sym = currency ? ({ EUR: '€', USD: '$', LAK: '₭' } as const)[currency] : propertySymbol(pid);

  const today     = localTodayIso(tz);
  const yesterday = addDays(today, -1);
  const ytdStart  = yearStart(today);
  const year      = Number(today.slice(0, 4));
  const monthIdx  = Number(today.slice(5, 7)); // 1-12

  // PBS 2026-09-06: six whole months ahead, starting next month (was four).
  const FWD_MONTHS = 6;
  const fwd = Array.from({ length: FWD_MONTHS }, (_, i) => {
    const m = monthIdx + 1 + i;
    const y = year + Math.floor((m - 1) / 12);
    const mm = ((m - 1) % 12) + 1;
    return { y, mm, key: `${y}-${String(mm).padStart(2, '0')}`, label: MONTHS[mm - 1] };
  });
  const fwdLast = fwd[fwd.length - 1];
  const fwdFrom = `${fwd[0].key}-01`;
  const fwdTo   = addDays(`${fwdLast.y}-${String(fwdLast.mm).padStart(2, '0')}-01`, 31).slice(0, 8) + '01';

  const daily = (from: string, to: string) => sb
    .from('v_kpi_daily_property')
    .select('night_date, rooms_available, rooms_sold, rooms_revenue, total_revenue')
    .eq('property_id', pid).gte('night_date', from).lte('night_date', to)
    .then((r) => (r.data ?? []) as DailyRow[], () => [] as DailyRow[]);

  const [tyRows, lyRows, fwdRows, fwdLyRows, gopRes, labRes, cporRes, attnRes, capRes] =
    await Promise.all([
      daily(ytdStart, yesterday),
      daily(shiftYear(ytdStart, -1), shiftYear(yesterday, -1)),
      daily(fwdFrom, fwdTo),
      daily(shiftYear(fwdFrom, -1), shiftYear(fwdTo, -1)),
      sb.from('v_goppar_monthly').select('period_yyyymm, gl_revenue, gop, gop_margin_pct')
        .eq('property_id', pid).gte('period_yyyymm', `${year}-01`).order('period_yyyymm')
        .then((r) => r.data ?? [], () => []),
      sb.from('v_labour_cost_ratio_monthly').select('period_month, labour_cost, labour_cost_ratio_pct')
        .eq('property_id', pid).gte('period_month', `${year}-01-01`).order('period_month')
        .then((r) => r.data ?? [], () => []),
      sb.from('v_cpor_monthly').select('period_month, cpor')
        .eq('property_id', pid).gte('period_month', `${year}-01-01`).order('period_month')
        .then((r) => r.data ?? [], () => []),
      // PBS 2026-08-26: .order('severity') is alphabetical — it rendered
      // high -> low -> medium, sinking the mediums below the lows. Ranked below.
      sb.from('v_attention_flags').select('id, dept_slug, label, severity')
        .eq('property_id', pid)
        .then((r) => r.data ?? [], () => []),
      Promise.all((['spa','activity','retail','transport'] as const).map((d) =>
        sb.from(`v_${d}_capture_monthly`).select('period_yyyymm, res_in_house, res_with_purchase, capture_pct')
          .eq('property_id', pid).order('period_yyyymm', { ascending: false }).limit(4)
          .then((r) => ({ dept: d, rows: r.data ?? [] }), () => ({ dept: d, rows: [] as never[] })),
      )),
    ]);

  const ty = totals(tyRows);
  const ly = totals(lyRows);
  // Budget: finance.budget_monthly and finance.gl_budgets are both empty as of
  // 2026-08-26, so no budget benchmark exists for either property yet. Passing
  // null keeps the "vs Budget" line dormant rather than inventing a baseline.
  const score = buildScore(ty, ly, null);

  const sdlyD = deltaFromIndex(score.sdlyIndex);
  const scoreTiles: KpiTileProps[] = [
    {
      label: 'Overall score', value: score.sdlyIndex ?? '—', size: 'sm',
      footnote: '100 = same period last year · RevPAR 60% + total revenue 40%',
      status: score.sdlyIndex == null ? 'grey' : score.sdlyIndex >= 100 ? 'green' : 'amber',
      delta: sdlyD ? { value: sdlyD.value, period: 'vs SDLY', direction: sdlyD.direction, isGoodWhenUp: true } : undefined,
      compare: [toComparison('vs SDLY', score.sdlyIndex), toComparison('vs Budget', score.budgetIndex)],
    },
    {
      label: 'Rooms revenue · YTD', value: money(ty.roomsRevenue, sym), size: 'sm',
      footnote: `1 Jan → ${yesterday} · gross`,
      status: (score.totalRevenueIndex ?? 0) >= 100 ? 'green' : 'amber',
      stly: ly.roomsRevenue > 0 ? `LY ${money(ly.roomsRevenue, sym)}` : 'LY —',
      compare: [toComparison('vs SDLY', performanceOrNull(ty.roomsRevenue, ly.roomsRevenue)), toComparison('vs Budget', null)],
    },
    {
      label: 'RevPAR · YTD', value: money(revpar(ty), sym), size: 'sm',
      footnote: 'rooms revenue ÷ rooms available',
      status: (score.revparIndex ?? 0) >= 100 ? 'green' : 'amber',
      stly: revpar(ly) != null ? `LY ${money(revpar(ly), sym)}` : 'LY —',
      compare: [toComparison('vs SDLY', score.revparIndex), toComparison('vs Budget', null)],
    },
    {
      label: 'Occupancy · YTD', value: pct(occupancy(ty)), size: 'sm',
      footnote: `${ty.roomsSold.toLocaleString('en-US')} of ${ty.roomsAvailable.toLocaleString('en-US')} room nights`,
      status: (score.occIndex ?? 0) >= 100 ? 'green' : 'amber',
      stly: occupancy(ly) != null ? `LY ${pct(occupancy(ly))}` : 'LY —',
      compare: [toComparison('vs SDLY', score.occIndex), toComparison('vs Budget', null)],
    },
  ];

  // ── score components ──
  const scoreRows: MatrixRow[] = [
    matrixRow('revpar', 'RevPAR', 'occupancy × rate · weight 60%', money(revpar(ty), sym), money(revpar(ly), sym), score.revparIndex),
    matrixRow('trev', 'Total revenue', 'rooms + ancillary · weight 40%', money(ty.totalRevenue, sym), money(ly.totalRevenue, sym), score.totalRevenueIndex),
    matrixRow('occ', 'Occupancy', 'reference only — inside RevPAR', pct(occupancy(ty)), pct(occupancy(ly)), score.occIndex),
    matrixRow('adr', 'ADR', 'reference only — inside RevPAR', money(adr(ty), sym), money(adr(ly), sym), score.adrIndex),
  ];

  // ── profitability ──
  const gopBy   = index(gopRes as Array<Record<string, unknown>>, 'period_yyyymm', (k) => String(k).slice(5, 7));
  const labBy   = index(labRes as Array<Record<string, unknown>>, 'period_month', (k) => String(k).slice(5, 7));
  const cporBy  = index(cporRes as Array<Record<string, unknown>>, 'period_month', (k) => String(k).slice(5, 7));
  // PBS 2026-08-26: only months that actually carry a figure. The ledger views
  // can lag each other, so a month with nothing posted anywhere painted a blank
  // trailing column that read as breakage rather than as an un-posted ledger.
  // PBS 2026-09-06: dropped the trailing .slice(-6) — PBS wants the year from
  // January, which is what the caption already claimed.
  const monthHasData = (m: string) =>
    gopBy[m] !== undefined || labBy[m] !== undefined || cporBy[m] !== undefined;
  const monthCols = Array.from({ length: Math.max(1, monthIdx) }, (_, i) => ({
    key: String(i + 1).padStart(2, '0'), label: MONTHS[i],
  })).filter((c) => monthHasData(c.key));

  const profitRows: MatrixRow[] = [
    monthRow('rev', 'GL revenue', 'from the ledger', monthCols, (m) => {
      const v = num(gopBy[m]?.gl_revenue); return v == null ? undefined : cell(money(v, sym));
    }),
    monthRow('gop', 'Gross operating profit', 'GOP', monthCols, (m) => {
      const v = num(gopBy[m]?.gop); return v == null ? undefined : cell(`${v < 0 ? '−' : '+'}${money(Math.abs(v), sym)}`, v < 0 ? 'neg' : 'pos');
    }),
    monthRow('margin', 'GOP margin', 'industry floor ≈ 25%', monthCols, (m) => {
      const v = num(gopBy[m]?.gop_margin_pct);
      return v == null ? undefined : cell(pct(v), marginTone(v), { bar: Math.min(100, Math.abs(v)) });
    }),
    monthRow('lab', 'Labour ÷ rooms revenue', 'healthy ≈ 30–35%', monthCols, (m) => {
      const v = num(labBy[m]?.labour_cost_ratio_pct);
      return v == null ? undefined : cell(pct(v), costTone(v), { bar: Math.min(100, v) });
    }),
    monthRow('labc', 'Labour cost', 'largely fixed', monthCols, (m) => {
      const v = num(labBy[m]?.labour_cost); return v == null ? undefined : cell(money(v, sym));
    }),
    monthRow('cpor', 'Cost per occupied room', 'CPOR', monthCols, (m) => {
      const v = num(cporBy[m]?.cpor); return v == null ? undefined : cell(money(v, sym));
    }),
  ];

  // ── forward outlook ──
  const byMonth = (rows: DailyRow[]) => rows.reduce<Record<string, PeriodTotals>>((a, r) => {
    const k = (r.night_date ?? '').slice(0, 7); if (!k) return a;
    const t = a[k] ?? { ...EMPTY_TOTALS };
    t.roomsRevenue += Number(r.rooms_revenue ?? 0);
    t.roomsSold    += Number(r.rooms_sold ?? 0);
    a[k] = t; return a;
  }, {});
  const fwdBy = byMonth(fwdRows), fwdLyBy = byMonth(fwdLyRows);
  const fwdCols = fwd.map((f) => ({ key: f.key, label: f.label, sub: String(f.y) }));

  const outlookRows: MatrixRow[] = [
    { key: 'rn', label: 'Room nights', unit: 'on the books', cells: Object.fromEntries(fwd.map((f) => {
      const t = fwdBy[f.key]; return [f.key, t ? cell(t.roomsSold.toLocaleString('en-US')) : undefined];
    })) },
    { key: 'rev', label: 'Revenue on books', unit: 'confirmed only', cells: Object.fromEntries(fwd.map((f) => {
      const t = fwdBy[f.key]; return [f.key, t ? cell(money(t.roomsRevenue, sym)) : undefined];
    })) },
    { key: 'adr', label: 'ADR', unit: 'revenue ÷ room nights', cells: Object.fromEntries(fwd.map((f) => {
      const t = fwdBy[f.key]; const a = t ? adr(t) : null;
      return [f.key, a == null ? undefined : cell(money(a, sym))];
    })) },
    { key: 'fill', label: 'Filled vs LY final', unit: 'share of last year already booked', cells: Object.fromEntries(fwd.map((f) => {
      const t = fwdBy[f.key], l = fwdLyBy[shiftYear(`${f.key}-01`, -1).slice(0, 7)];
      const p = fillPct(t?.roomsSold, l?.roomsSold);
      return [f.key, p == null ? undefined : cell(`${p}%`, p >= 70 ? 'pos' : p >= 40 ? 'warn' : 'neg', { bar: Math.min(100, p) })];
    })) },
  ];

  // ── capture ──
  const capMonths = Array.from(new Set(
    capRes.flatMap((c) => c.rows.map((r: Record<string, unknown>) => String(r.period_yyyymm)))
  )).sort().slice(-4);
  const capCols = capMonths.map((m) => ({ key: m, label: MONTHS[Number(m.slice(5, 7)) - 1] ?? m }));
  const capRows: MatrixRow[] = capRes.map(({ dept, rows }) => ({
    key: dept,
    label: dept === 'activity' ? 'Activities' : dept[0].toUpperCase() + dept.slice(1),
    unit: 'share of in-house buying',
    cells: Object.fromEntries(capMonths.map((m) => {
      const r = (rows as Array<Record<string, unknown>>).find((x) => String(x.period_yyyymm) === m);
      const v = num(r?.capture_pct);
      return [m, v == null ? undefined : cell(pct(v), v >= 30 ? 'pos' : v >= 15 ? 'warn' : 'neg',
        { bar: Math.min(100, v), title: `${num(r?.res_with_purchase) ?? 0} of ${num(r?.res_in_house) ?? 0} reservations` })];
    })),
  }));
  const capDenominator = capRes[0]?.rows as Array<Record<string, unknown>> | undefined;
  if (capDenominator?.length) {
    capRows.push({
      key: '_inhouse', label: 'In-house reservations', unit: 'the denominator',
      cells: Object.fromEntries(capMonths.map((m) => {
        const r = capDenominator.find((x) => String(x.period_yyyymm) === m);
        const v = num(r?.res_in_house);
        return [m, v == null ? undefined : cell(v.toLocaleString('en-US'), 'mute')];
      })),
    });
  }

  const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const flags = (attnRes as Array<{ id: string; dept_slug: string; label: string; severity: string }>)
    .slice()
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
  const highCount = flags.filter((f) => f.severity === 'high').length;

  return (
    <>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {scoreTiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="How the score is built"
          subtitle="Index where 100 = same period last year · STR convention · occupancy and ADR shown but not weighted (RevPAR already contains both)"
          density="compact">
          <MetricMatrix caption="Score components against the same period last year."
            columns={[
              { key: 'ty', label: `${year} YTD` },
              { key: 'ly', label: `${year - 1} YTD` },
              { key: 'ix', label: 'Index' },
            ]} rows={scoreRows} minWidth={460} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Is the hotel making money?"
          subtitle="Ledger revenue vs gross operating profit · labour as a share of rooms revenue · cost per occupied room"
          density="compact">
          <MetricMatrix caption="Monthly profitability for the current year." columns={monthCols} rows={profitRows} labelWidth={172} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="What is already sold"
          subtitle="On the books by check-in month · the fill row compares today's bookings with last year's FINAL total, so it always reads low — it measures how full the book is, not how far behind"
          density="compact">
          <MetricMatrix caption="Forward bookings by check-in month." columns={fwdCols} rows={outlookRows} minWidth={440} labelWidth={168} />
        </Container>
      </div>

      {capCols.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Are guests spending beyond the room?"
            subtitle="Share of in-house reservations buying in each department · hover a cell for the counts"
            density="compact">
            <MetricMatrix caption="Ancillary capture rate by department." columns={capCols} rows={capRows} minWidth={420} labelWidth={168} />
          </Container>
        </div>
      )}

      {/* The money behind the capture rate above — moved here from the Revenue HoD page. */}
      <div style={{ gridColumn: '1 / -1' }}>
        <AncillaryCapture propertyId={pid} sym={sym} />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Waiting on you · ${flags.length}`}
          subtitle={highCount > 0 ? `${highCount} high priority` : 'nothing urgent'} density="compact">
          {flags.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic', padding: '8px 4px' }}>
              Nothing waiting for your call.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {flags.map((f) => (
                <li key={f.id} style={{
                  display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5,
                  padding: '7px 9px', background: 'var(--paper, #FFFFFF)',
                  border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4,
                }}>
                  <span aria-hidden="true" style={{
                    width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                    background: f.severity === 'high' ? 'var(--status-red, #B04A2F)'
                      : f.severity === 'medium' ? 'var(--status-amber, #B47A1F)'
                      : 'var(--status-grey, #8A8A8A)',
                  }} />
                  <span style={{ color: 'var(--ink, #1B1B1B)' }}>
                    {f.label}
                    <span style={{
                      display: 'block', fontSize: 9.5, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginTop: 1,
                    }}>{f.dept_slug} · {f.severity}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </div>
    </>
  );
}

// ─── local helpers ─────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function performanceOrNull(ty: number, ly: number): number | null {
  return ly > 0 ? Math.round((ty / ly) * 100) : null;
}

function index<T extends Record<string, unknown>>(
  rows: T[], key: string, pick: (k: unknown) => string,
): Record<string, T> {
  return rows.reduce<Record<string, T>>((a, r) => { a[pick(r[key])] = r; return a; }, {});
}

function matrixRow(
  key: string, label: string, unit: string, tyV: string, lyV: string, ix: number | null,
): MatrixRow {
  return {
    key, label, unit,
    cells: {
      ty: { value: tyV },
      ly: { value: lyV, tone: 'mute' },
      ix: ix == null ? undefined : { value: String(ix), tone: ix >= 100 ? 'pos' : 'neg' },
    },
  };
}

function monthRow(
  key: string, label: string, unit: string,
  cols: Array<{ key: string }>, get: (m: string) => MatrixCell | undefined,
): MatrixRow {
  return { key, label, unit, cells: Object.fromEntries(cols.map((c) => [c.key, get(c.key)])) };
}
