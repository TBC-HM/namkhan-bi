// app/h/[property_id]/finance/pnl/page.tsx
//
// Canonical property-scoped P&L page (USALI 11th edition).
// Reads finance.gl_pl_monthly + finance.gl_accounts directly — no MV stack.
//
// Donna (property_id=1000001): 81 USALI line slugs × 12 months 2025 = 801 rows,
// loaded 2026-05-14 from gestoría USALI export. EUR operating currency.
//
// Namkhan (property_id=260955): redirects to /finance/pnl which is the rich
// Namkhan dashboard wired on the gl.* schema. The unification of both onto
// finance.gl_pl_monthly is Path C (a separate, deliberate refactor).
//
// Layout:
//   1) Top toolbar with Year dropdown (2024 / 2025 / 2026).
//   2) Monthly overview — KPI tiles + USALI table for the selected month
//      (month dropdown Jan 2025 onward).
//   3) Annual view — 12-month USALI table for the selected year, with
//      Annual total and % of Hotel Revenue columns.
//
// Property layout (/h/[property_id]/layout.tsx) wraps everything in the
// per-property ThemeInjector so colours follow the brand palette.

import { redirect } from 'next/navigation';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';

import KpiBox from '@/components/kpi/KpiBox';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
import {
  getPnlForYear,
  getAvailableYears,
  getPropertyCurrency,
  USALI_STRUCTURE,
  pickAmount,
  type PnlRow,
} from './_data';
import YearDropdown from './YearDropdown';
import MonthDropdown from './MonthDropdown';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { gopTrendSvg, deptProfitTrendSvg, costRatioTrendSvg, FIN_COLORS } from '@/lib/financeCharts';
import { getDonnaPulseKpis, DONNA_PROPERTY_ID } from '@/lib/data-donna-mews';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPPORTED_YEARS = ['2024', '2025', '2026'];
const EARLIEST_MONTH = '2025-01';

// PBS 2026-05-16: dept P/L slugs for the top-variances waterfall (mirrors
// Namkhan's 6-dept waterfall, replacing Spa/Activities/Mekong with Donna's
// undistributed lines A&G / S&M / POM).
const DEPT_PL_KEYS: { name: string; pl: string }[] = [
  { name: 'Rooms',           pl: 'rooms__profit_loss' },
  { name: 'F&B',             pl: 'food_beverage__profit_loss' },
  { name: 'OOD',             pl: 'other_operated_departments__profit_loss' },
  { name: 'A&G',             pl: 'administrative_general__profit_loss' },
  { name: 'Sales & Mkt',     pl: 'sales_marketing__profit_loss' },
  { name: 'POM',             pl: 'property_operations_maintenance__profit_loss' },
];

function fmtCurrency(amount: number | null | undefined, currency: string, dp = 0): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return '—';
  const locale = currency === 'EUR' ? 'de-DE' : currency === 'USD' ? 'en-US' : 'en-US';
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'LAK' ? '₭' : '';
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return amount < 0 ? `(${symbol}${formatted})` : `${symbol}${formatted}`;
}
function fmtK(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return '—';
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'LAK' ? '₭' : '';
  const v = amount / 1000;
  return `${amount < 0 ? '−' : ''}${symbol}${Math.abs(v).toFixed(1)}k`;
}

function fmtPct(amount: number | null | undefined, dp = 1): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return '—';
  return `${amount.toFixed(dp)}%`;
}
function fmtPctSigned(amount: number | null | undefined, dp = 1): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return '—';
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(dp)}%`;
}
function priorOf(p: string): string {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function lastDayOfMonth(p: string): string {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtMonthShort(p: string): string {
  return new Date(p + '-01').toLocaleDateString('en-GB', { month: 'short' });
}
function fmtMonthLong(p: string): string {
  return new Date(p + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function periodsForYear(year: string): string[] {
  const out: string[] = [];
  for (let m = 1; m <= 12; m += 1) out.push(`${year}-${String(m).padStart(2, '0')}`);
  return out;
}

function nextPeriod(after: string): string {
  const [y, m] = after.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsFromTo(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = nextPeriod(cur);
  }
  return out;
}

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PropertyPnLPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);

  // Namkhan keeps its rich /finance/pnl dashboard (gl.* schema). Path B
  // scope: Donna (and other future tenants) get this canonical surface.
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/finance/pnl');

  // ── Available years for this property (drives the Year dropdown) ──────
  const availableYears = await getAvailableYears(propertyId);
  const yearsWithData = availableYears.filter((y) => SUPPORTED_YEARS.includes(y));

  // ── Resolve selected year ─────────────────────────────────────────────
  const yearParam = (searchParams.year as string | undefined) || '';
  const yearValid = SUPPORTED_YEARS.includes(yearParam);
  const defaultYear =
    yearsWithData[yearsWithData.length - 1] // latest year with rows
    ?? '2025'; // fallback
  const year = yearValid ? yearParam : defaultYear;

  // ── Fetch rows + prior-year rows + currency in parallel ───────────────
  // PBS 2026-05-16: pull prior year too so MoM math works across Jan boundary.
  const priorYearStr = String(Number(year) - 1);
  const [rows, priorYearRows, currency] = await Promise.all([
    getPnlForYear(propertyId, year),
    getPnlForYear(propertyId, priorYearStr).catch(() => [] as PnlRow[]),
    getPropertyCurrency(propertyId),
  ]);
  const allRows = rows.concat(priorYearRows);

  // ── Periods present in the data for the active year ───────────────────
  const periodsWithData = Array.from(new Set(rows.map((r) => r.period_yyyymm))).sort();
  const latestInYear = periodsWithData[periodsWithData.length - 1];

  // ── Resolve selected month (Monthly overview) ─────────────────────────
  // Dropdown spans Jan 2025 → latest month with data across ALL years for
  // this property. Default: latest month with data in the active year, else
  // latest period overall, else Jan 2025.
  const latestEverInThisYearOrAfter = (() => {
    return availableYears
      .flatMap((y) => periodsForYear(y))
      .filter((p) => p >= EARLIEST_MONTH)
      .sort()
      .pop() ?? `${year}-12`;
  })();
  const monthOptions = monthsFromTo(EARLIEST_MONTH, latestEverInThisYearOrAfter);

  // For "months with data" we derive from available-year × 12 months.
  const monthsWithDataAcrossYears = (() => {
    const out: string[] = [];
    for (const y of availableYears) {
      for (const p of periodsForYear(y)) {
        if (p >= EARLIEST_MONTH) out.push(p);
      }
    }
    return Array.from(new Set(out)).sort();
  })();

  const monthParam = (searchParams.month as string | undefined) || '';
  const monthValid = monthOptions.includes(monthParam);
  const selectedMonth =
    monthValid ? monthParam
    : latestInYear ?? monthOptions[monthOptions.length - 1] ?? EARLIEST_MONTH;

  // ── Period anchors for MoM / vs LY math ──────────────────────────────
  const priorMonth = priorOf(selectedMonth);
  const lyMonth = (() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return `${y - 1}-${String(m).padStart(2, '0')}`;
  })();

  // ── KPIs for the selected month ──────────────────────────────────────
  const hotelRev   = pickAmount(allRows, 'hotel__hotel_revenue', selectedMonth);
  const priorRev   = pickAmount(allRows, 'hotel__hotel_revenue', priorMonth);
  const lyRev      = pickAmount(allRows, 'hotel__hotel_revenue', lyMonth);
  const gop        = pickAmount(allRows, 'utilities__gross_operating_profit_gop', selectedMonth);
  const ebitda     = pickAmount(allRows, 'utilities__earnings_before_interest_taxes_depreciation_and_amortization', selectedMonth);
  const netIncome  = pickAmount(allRows, 'utilities__net_income', selectedMonth);
  const gopMargin  = hotelRev !== 0 ? (gop / hotelRev) * 100 : null;
  const revVsPrior = priorRev !== 0 ? ((hotelRev - priorRev) / Math.abs(priorRev)) * 100 : null;
  const revVsLy    = lyRev    !== 0 ? ((hotelRev - lyRev)    / Math.abs(lyRev))    * 100 : null;

  // ── Driver row inputs — labour %, F&B labour %, distribution % ───────
  const labourAccountIds = [
    'rooms__labor_costs_and_related_expenses',
    'food_beverage__labor_costs_and_related_expenses',
    'other_operated_departments__labor_costs_and_related_expenses',
    'administrative_general__labor_costs_and_related_expenses',
    'it_systems__labor_costs_and_related_expenses',
    'sales_marketing__labor_costs_and_related_expenses',
    'property_operations_maintenance__labor_costs_and_related_expenses',
  ];
  const totalPayroll = labourAccountIds.reduce(
    (s, a) => s + pickAmount(allRows, a, selectedMonth), 0,
  );
  const labourPct = hotelRev > 0 ? (totalPayroll / hotelRev) * 100 : null;
  const fbRev    = pickAmount(allRows, 'food_beverage__revenue', selectedMonth);
  const fbLabour = pickAmount(allRows, 'food_beverage__labor_costs_and_related_expenses', selectedMonth);
  const fbLabourPct = fbRev > 0 ? (fbLabour / fbRev) * 100 : null;
  // Donna distribution proxy: |Sales & Marketing P/(L)| as % of revenue.
  // Replace with OTA-commission split once Mews → finance load wires it.
  const smPl = Math.abs(pickAmount(allRows, 'sales_marketing__profit_loss', selectedMonth));
  const distributionPct = hotelRev > 0 ? (smPl / hotelRev) * 100 : null;

  // ── Occupancy + ADR from Mews (Donna only) ──────────────────────────
  let occPct: number | null = null;
  let adrEur: number | null = null;
  if (propertyId === DONNA_PROPERTY_ID) {
    try {
      const monthStart = `${selectedMonth}-01`;
      const monthEnd = lastDayOfMonth(selectedMonth);
      const pulse = await getDonnaPulseKpis(monthStart, monthEnd);
      occPct = pulse.occupancyPct;
      adrEur = pulse.adrEur;
    } catch {
      // soft-fail; KPI tiles render data-needed
    }
  }

  // ── Top variances (dept profit MoM, sorted by |Δ|) ───────────────────
  const variances = DEPT_PL_KEYS.map((d) => {
    const curP   = pickAmount(allRows, d.pl, selectedMonth);
    const priorP = pickAmount(allRows, d.pl, priorMonth);
    return { dept: d.name, delta: curP - priorP, curProfit: curP, priorProfit: priorP };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const maxAbsVar = Math.max(1, ...variances.map((v) => Math.abs(v.delta)));

  // ── Annual totals (selected year) ────────────────────────────────────
  const annualHotelRev = pickAmount(rows, 'hotel__hotel_revenue');
  const annualGop      = pickAmount(rows, 'utilities__gross_operating_profit_gop');
  const annualNet      = pickAmount(rows, 'utilities__net_income');

  // ── Empty-state for years with no data ────────────────────────────────
  const noData = rows.length === 0;

  // ── Page header ─────────────────────────────────────────────────────
  const eyebrow = [
    'Finance · P&L',
    `Year ${year}`,
    `${rows.length} rows · ${currency}`,
  ].join(' · ');

  return (
    <DashboardPage
      title={`Profit & Loss · ${year}`}
      subtitle={eyebrow}
      tabs={financeSubPagesForProperty(propertyId).map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/pnl') }))}
      action={<YearDropdown current={year} years={SUPPORTED_YEARS} yearsWithData={yearsWithData} />}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ─── 1. CFO KPI BAND ──────────────────────────────────────────
          Mirrors Namkhan /finance/pnl: row 1 outcomes, row 2 drivers. */}
      {/* Row 1 — Outcomes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, margin: '8px 0 6px' }}>
        <KpiBox
          value={hotelRev || null}
          unit="text"
          valueText={fmtCurrency(hotelRev, currency)}
          label={`Revenue · ${fmtMonthShort(selectedMonth)} ${selectedMonth.slice(0, 4)}`}
          compare={priorRev !== 0 && revVsPrior != null
            ? { value: revVsPrior, unit: 'pct', period: 'vs prior mo' }
            : undefined}
          tooltip={`finance.gl_pl_monthly · hotel__hotel_revenue · ${selectedMonth}`}
        />
        <KpiBox
          value={gop || null}
          unit="text"
          valueText={fmtCurrency(gop, currency)}
          label="GOP"
          state={gop === 0 ? 'data-needed' : 'live'}
          tooltip="utilities__gross_operating_profit_gop · revenue − dept expenses − undistributed."
        />
        <KpiBox
          value={gopMargin}
          unit="pct"
          label="GOP margin"
          state={gopMargin == null ? 'data-needed' : 'live'}
          tooltip="GOP ÷ hotel revenue × 100."
        />
        <KpiBox
          value={ebitda || null}
          unit="text"
          valueText={fmtCurrency(ebitda, currency)}
          label="EBITDA"
          state={ebitda === 0 ? 'data-needed' : 'live'}
          tooltip="utilities__earnings_before_interest_taxes_depreciation_and_amortization."
        />
        <KpiBox
          value={revVsLy}
          unit="pct"
          label="Revenue vs LY"
          state={revVsLy == null ? 'data-needed' : 'live'}
          needs={revVsLy == null ? `no ${lyMonth} row` : undefined}
          tooltip={`${selectedMonth} revenue vs ${lyMonth}.`}
        />
      </div>

      {/* Row 2 — Drivers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
        <KpiBox
          value={labourPct}
          unit="pct"
          label="Labour cost %"
          state={labourPct == null ? 'data-needed' : 'live'}
          tooltip="Total labour ÷ hotel revenue (selected month). Target ≤ 35%."
        />
        <KpiBox
          value={fbLabourPct}
          unit="pct"
          label="F&B labour %"
          state={fbLabourPct == null ? 'data-needed' : 'live'}
          tooltip="F&B labour ÷ F&B revenue. Industry norm 28–32%."
        />
        <KpiBox
          value={distributionPct}
          unit="pct"
          label="Distribution cost %"
          state={distributionPct == null ? 'data-needed' : 'live'}
          tooltip="|Sales & Marketing P/(L)| ÷ hotel revenue. Proxy until OTA-commission split is wired."
        />
        <KpiBox
          value={occPct}
          unit="pct"
          label={`Occupancy · ${fmtMonthShort(selectedMonth)}`}
          state={occPct == null ? 'data-needed' : 'live'}
          needs={occPct == null ? 'Mews rates missing' : undefined}
          tooltip="pms.reservation_rooms_mews · room-nights sold ÷ (66 rooms × days in month) × 100."
        />
        <KpiBox
          value={adrEur}
          unit="text"
          valueText={adrEur != null ? fmtCurrency(adrEur, currency) : '—'}
          label={`ADR · ${fmtMonthShort(selectedMonth)}`}
          state={adrEur == null ? 'data-needed' : 'live'}
          needs={adrEur == null ? 'Mews rates missing' : undefined}
          tooltip="pms.reservation_rooms_mews · ∑ rate ÷ room-nights sold."
        />
      </div>

      {/* ─── 2. PERIOD SELECTOR ROW ──────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        margin: '0 0 12px',
        padding: '8px 12px',
        background: 'var(--surf-1, var(--paper-warm, #f4ecd8))',
        border: '1px solid var(--border-2, var(--line-soft, rgba(26, 26, 26, 0.12)))',
        borderRadius: 6,
      }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--ink-soft, var(--text-1, #4a443c))',
        }}>
          Period
        </span>
        <MonthDropdown
          current={selectedMonth}
          options={monthOptions}
          monthsWithData={monthsWithDataAcrossYears}
        />
        <span style={{ fontSize: 'var(--t-xs)', color: 'var(--text-mute, var(--ink-mute, #7d7565))' }}>
          MoM compare: {priorMonth} · LY compare: {lyMonth}
        </span>
      </div>

      {/* ─── 3. TOP VARIANCES WATERFALL ──────────────────────────────
          Inline-styled (not .pnl-page class) so the bars/labels stay
          theme-safe on both light (Donna) and dark (Namkhan) palettes. */}
      {!noData && (
        <Container title={`Top variances · ${priorMonth} → ${selectedMonth}`} subtitle="dept profit MoM · finance.gl_pl_monthly">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 4px' }}>
            {variances.map((v) => {
              const pct = (Math.abs(v.delta) / maxAbsVar) * 100;
              const isPos = v.delta >= 0;
              const barColor = isPos ? 'var(--moss, #3f8a4a)' : 'var(--st-bad, #b34939)';
              const numColor = isPos ? 'var(--moss, #3f8a4a)' : 'var(--st-bad, #b34939)';
              const sign = isPos ? '+' : '−';
              return (
                <div key={v.dept} style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 90px',
                  gap: 10, alignItems: 'center', fontSize: 'var(--t-sm)',
                }}>
                  <div style={{ color: 'var(--ink-soft, var(--text-1, #4a443c))' }}>
                    {v.dept} dept profit
                  </div>
                  <div style={{
                    height: 12, borderRadius: 3,
                    background: 'var(--surf-2, var(--paper-deep, #e6daC0))',
                  }}>
                    <div style={{
                      height: '100%', width: `${pct.toFixed(0)}%`,
                      borderRadius: 3, background: barColor, opacity: 0.85,
                    }} />
                  </div>
                  <div style={{
                    textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums', color: numColor,
                  }}>
                    {sign}{fmtK(Math.abs(v.delta), currency)}
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      )}

      <div style={{ height: 12 }} />

      {/* ── 3 small trend graphs (same set as /finance/pnl Namkhan):
          GOP trend · Departmental profit · Cost ratios.
          SVG built server-side from typed numbers — no user input flows
          through, mirrors the /revenue/channels and /finance/pnl pattern. */}
      {!noData && (() => {
        const tPeriods = periodsForYear(year);

        const gopPts = tPeriods.map((p) => ({
          period: p,
          gop: pickAmount(rows, 'utilities__gross_operating_profit_gop', p),
        }));

        const deptSeriesList = [
          {
            name: 'Rooms',
            color: FIN_COLORS.rooms,
            points: tPeriods.map((p) => ({ period: p, value: pickAmount(rows, 'rooms__profit_loss', p) })),
          },
          {
            name: 'F&B',
            color: FIN_COLORS.fb,
            points: tPeriods.map((p) => ({ period: p, value: pickAmount(rows, 'food_beverage__profit_loss', p) })),
          },
          {
            name: 'OOD',
            color: FIN_COLORS.ood,
            points: tPeriods.map((p) => ({ period: p, value: pickAmount(rows, 'other_operated_departments__profit_loss', p) })),
          },
        ];

        // Cost ratios — % of Hotel Revenue. Sums labour lines across departments.
        // F&B cost % = food_beverage__cost_of_sales / food_beverage__revenue.
        // A&G % = |A&G P/L| / Hotel Rev. labourAccountIds defined at function scope.
        const labourPts = tPeriods.map((p) => {
          const rev = pickAmount(rows, 'hotel__hotel_revenue', p);
          const pay = labourAccountIds.reduce((s, a) => s + pickAmount(rows, a, p), 0);
          return { period: p, pct: rev > 0 ? (pay / rev) * 100 : null };
        });
        const fbCostPts = tPeriods.map((p) => {
          const fbRev = pickAmount(rows, 'food_beverage__revenue', p);
          const fbCogs = pickAmount(rows, 'food_beverage__cost_of_sales', p);
          return { period: p, pct: fbRev > 0 ? (fbCogs / fbRev) * 100 : null };
        });
        const agPts = tPeriods.map((p) => {
          const rev = pickAmount(rows, 'hotel__hotel_revenue', p);
          const ag = Math.abs(pickAmount(rows, 'administrative_general__profit_loss', p));
          return { period: p, pct: rev > 0 ? (ag / rev) * 100 : null };
        });
        const ratioSeries = [
          { name: 'Labour',   color: FIN_COLORS.labour, target: 35, points: labourPts },
          { name: 'F&B cost', color: FIN_COLORS.fbCost, target: 32, points: fbCostPts },
          { name: 'A&G',     color: FIN_COLORS.ag,     target: 12, points: agPts },
        ];

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Container title={`GOP trend · ${year}`} subtitle="Gross Operating Profit / month">
              <div dangerouslySetInnerHTML={{ __html: gopTrendSvg(gopPts) }} />
            </Container>
            <Container title={`Departmental profit · ${year}`} subtitle="Rooms · F&B · OOD">
              <div dangerouslySetInnerHTML={{ __html: deptProfitTrendSvg(deptSeriesList) }} />
            </Container>
            <Container title={`Cost ratios · ${year}`} subtitle="% of Hotel Revenue · target dashed">
              <div dangerouslySetInnerHTML={{ __html: costRatioTrendSvg(ratioSeries) }} />
            </Container>
          </div>
        );
      })()}

      {/* ─── 5. VARIANCE COMMENTARY (template w/ live numbers) ─────── */}
      {!noData && (
        <Container title={`Variance commentary · ${selectedMonth}`} subtitle="auto-draft · template from finance.gl_pl_monthly">
          <div style={{
            fontSize: 'var(--t-sm)', lineHeight: 1.6,
            color: 'var(--ink, var(--tbl-fg, #1A1A1A))',
            padding: '4px 4px',
          }}>
            <h4 style={{
              margin: '4px 0 6px',
              fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              color: 'var(--ink-soft, var(--text-1, #4a443c))',
            }}>Headline</h4>
            <p style={{ margin: '0 0 10px' }}>
              {fmtMonthLong(selectedMonth)} closes with revenue{' '}
              {revVsPrior == null
                ? <span>at {fmtCurrency(hotelRev, currency)} (no prior-month comparable).</span>
                : <>
                    {hotelRev > priorRev ? 'up' : 'down'} <strong>{Math.abs(revVsPrior).toFixed(1)}%</strong>{' '}
                    vs prior ({fmtCurrency(hotelRev, currency)} vs {fmtCurrency(priorRev, currency)}).
                  </>
              }{' '}
              {gop !== 0 ? <>GOP <strong>{fmtCurrency(gop, currency)}</strong>{gopMargin != null && <> · margin {gopMargin.toFixed(1)}%</>}.</> : <>GOP awaiting expense post.</>}
              {' '}{revVsLy != null ? <>vs LY: <strong>{fmtPctSigned(revVsLy)}</strong>.</> : <>No LY comparable.</>}
            </p>

            {variances.slice(0, 3).some((v) => Math.abs(v.delta) >= 1000) && (
              <>
                <h4 style={{
                  margin: '4px 0 6px',
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                  color: 'var(--ink-soft, var(--text-1, #4a443c))',
                }}>Top MoM moves</h4>
                <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
                  {variances.slice(0, 3).map((v) => (
                    <li key={v.dept}>
                      <strong>{v.dept}</strong> dept profit{' '}
                      {v.delta >= 0 ? 'up' : 'down'} {fmtK(Math.abs(v.delta), currency)}{' '}
                      ({fmtCurrency(v.priorProfit, currency)} → {fmtCurrency(v.curProfit, currency)}).
                    </li>
                  ))}
                </ul>
              </>
            )}

            {fbLabourPct != null && (
              <>
                <h4 style={{
                  margin: '4px 0 6px',
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                  color: 'var(--ink-soft, var(--text-1, #4a443c))',
                }}>F&amp;B</h4>
                <p style={{ margin: '0 0 10px' }}>
                  F&amp;B labour <strong>{fmtCurrency(fbLabour, currency)}</strong> vs F&amp;B revenue {fmtCurrency(fbRev, currency)} → ratio{' '}
                  <strong>{fbLabourPct.toFixed(1)}%</strong> {fbLabourPct > 35 ? '(above 28–32% norm)' : '(within 28–32% norm)'}.
                </p>
              </>
            )}
          </div>
        </Container>
      )}

      <div style={{ height: 12 }} />

      {/* ── Empty-state for the chosen year ─────────────────────────── */}
      {noData && (
        <Container title={`No data for ${year}`} subtitle="empty" expandable={false}>
          <div style={{ padding: 16, color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))', fontSize: 'var(--t-sm)' }}>
            No rows in <code>finance.gl_pl_monthly</code> for property <code>{propertyId}</code> in {year}.
            Pick a different year from the Year dropdown above.
          </div>
        </Container>
      )}

      {!noData && (
        <>
          {/* ── Monthly overview ───────────────────────────────────── */}
          <Container
            title={`Monthly overview · ${fmtMonthLong(selectedMonth)}`}
            subtitle={`finance.gl_pl_monthly · property_id=${propertyId}`}
            actions={
              <MonthDropdown
                current={selectedMonth}
                options={monthOptions}
                monthsWithData={monthsWithDataAcrossYears}
              />
            }
          >
            <MonthlyTable
              rows={allRows}
              period={selectedMonth}
              priorPeriod={priorMonth}
              lyPeriod={lyMonth}
              hotelRev={hotelRev}
              currency={currency}
            />
          </Container>

          <div style={{ height: 12 }} />

          {/* ── Annual view (12-month) ─────────────────────────────── */}
          <Container
            title={`12-month rollup · FY${year}`}
            subtitle={`actual · ${currency} · ${rows.length} rows`}
            actions={
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>
                FY {year} · {fmtCurrency(annualHotelRev, currency)} rev · {fmtCurrency(annualNet, currency)} net
                {annualHotelRev !== 0 && annualGop !== 0 ? ` · GOP ${fmtPct((annualGop / annualHotelRev) * 100, 1)}` : ''}
              </span>
            }
          >
            <AnnualTable rows={rows} year={year} currency={currency} />
          </Container>
        </>
      )}
      </div>
    </DashboardPage>
  );
}

// ───── Monthly overview table ──────────────────────────────────────────

function MonthlyTable({
  rows, period, priorPeriod, lyPeriod, hotelRev, currency,
}: {
  rows: PnlRow[];
  period: string;
  priorPeriod: string;
  lyPeriod: string;
  hotelRev: number;
  currency: string;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)', color: 'var(--tbl-fg, var(--ink, #1A1A1A))' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--tbl-border-strong, rgba(26, 26, 26, 0.2))', textAlign: 'left' }}>
            <th style={{ padding: '8px 10px' }}>Line</th>
            <th style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMonthLong(period)}</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>{fmtMonthLong(priorPeriod)}</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>{fmtMonthLong(lyPeriod)}</th>
            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Δ MoM</th>
            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Δ% MoM</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>% of Rev</th>
          </tr>
        </thead>
        <tbody>
          {USALI_STRUCTURE.map((u) => {
            const amount   = pickAmount(rows, u.accountId, period);
            const priorAmt = pickAmount(rows, u.accountId, priorPeriod);
            const lyAmt    = pickAmount(rows, u.accountId, lyPeriod);
            const dMom     = u.accountId ? amount - priorAmt : 0;
            const dMomPct  = u.accountId && priorAmt !== 0 ? ((amount - priorAmt) / Math.abs(priorAmt)) * 100 : null;
            const pctOfRev = (hotelRev !== 0 && u.accountId) ? (amount / hotelRev) * 100 : null;
            const fontWeight = u.style === 'section' || u.style === 'subtotal' ? 700 : 400;
            const isSubtotal = u.style === 'subtotal';
            const isHeader = u.style === 'section' && !u.accountId;
            return (
              <tr
                key={u.key}
                style={{
                  borderBottom: '1px solid var(--tbl-border, rgba(26, 26, 26, 0.12))',
                  background: isHeader ? 'var(--tbl-bg-elev, #faf8f2)' : undefined,
                  borderTop: isSubtotal ? '1px solid var(--tbl-border-strong, rgba(26, 26, 26, 0.2))' : undefined,
                }}
              >
                <td style={{ padding: '6px 10px', paddingLeft: 10 + u.depth * 14, fontWeight }}>
                  {u.label}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight }}>
                  {u.accountId ? fmtCurrency(amount, currency) : ''}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>
                  {u.accountId ? (priorAmt === 0 ? '—' : fmtCurrency(priorAmt, currency)) : ''}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>
                  {u.accountId ? (lyAmt === 0 ? '—' : fmtCurrency(lyAmt, currency)) : ''}
                </td>
                <td style={{
                  padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                  color: u.accountId && dMom !== 0
                    ? (dMom >= 0 ? 'var(--moss, #3f8a4a)' : 'var(--st-bad, #b34939)')
                    : 'inherit',
                }}>
                  {u.accountId && dMom !== 0 ? fmtCurrency(dMom, currency) : ''}
                </td>
                <td style={{
                  padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                  color: dMomPct != null
                    ? (dMomPct >= 0 ? 'var(--moss, #3f8a4a)' : 'var(--st-bad, #b34939)')
                    : 'inherit',
                }}>
                  {dMomPct != null ? fmtPctSigned(dMomPct) : ''}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>
                  {pctOfRev != null ? fmtPct(pctOfRev) : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ───── Annual 12-month table ───────────────────────────────────────────

function AnnualTable({
  rows, year, currency,
}: {
  rows: PnlRow[];
  year: string;
  currency: string;
}) {
  const periods = periodsForYear(year);
  const annualHotelRev = pickAmount(rows, 'hotel__hotel_revenue');
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-xs)', color: 'var(--tbl-fg, #1A1A1A)' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--tbl-border-strong, rgba(26, 26, 26, 0.2))' }}>
            <th style={{ padding: '8px 8px', textAlign: 'left', position: 'sticky', left: 0, background: 'var(--tbl-bg, #F5F0E4)', color: 'var(--tbl-fg, #1A1A1A)' }}>Line</th>
            {periods.map((p) => (
              <th key={p} style={{ padding: '8px 8px', textAlign: 'right', minWidth: 70, color: 'var(--tbl-fg, #1A1A1A)' }}>
                {fmtMonthShort(p)}
              </th>
            ))}
            <th style={{ padding: '8px 8px', textAlign: 'right', minWidth: 90, background: 'var(--tbl-bg-elev, #faf8f2)', color: 'var(--tbl-fg, #1A1A1A)' }}>
              Annual
            </th>
            <th style={{ padding: '8px 8px', textAlign: 'right', minWidth: 60, color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>
              % of Rev
            </th>
          </tr>
        </thead>
        <tbody>
          {USALI_STRUCTURE.map((u) => {
            const monthly = periods.map((p) => pickAmount(rows, u.accountId, p));
            const annual = monthly.reduce((s, v) => s + v, 0);
            const pctOfRev = annualHotelRev !== 0 && u.accountId ? (annual / annualHotelRev) * 100 : null;
            const fontWeight = u.style === 'section' || u.style === 'subtotal' ? 700 : 400;
            const isSubtotal = u.style === 'subtotal';
            const isHeader = u.style === 'section' && !u.accountId;
            return (
              <tr
                key={u.key}
                style={{
                  borderBottom: '1px solid var(--tbl-border, rgba(26, 26, 26, 0.12))',
                  background: isHeader ? 'var(--tbl-bg-elev, #faf8f2)' : undefined,
                  borderTop: isSubtotal ? '1px solid var(--tbl-border-strong, rgba(26, 26, 26, 0.2))' : undefined,
                }}
              >
                <td style={{
                  padding: '5px 8px',
                  paddingLeft: 8 + u.depth * 12,
                  fontWeight,
                  position: 'sticky',
                  left: 0,
                  background: isHeader
                    ? 'var(--tbl-bg-elev, #faf8f2)'
                    : isSubtotal
                      ? 'var(--tbl-bg, #F5F0E4)'
                      : 'var(--tbl-bg, #F5F0E4)',
                  color: 'var(--tbl-fg, #1A1A1A)',
                  whiteSpace: 'nowrap',
                }}>
                  {u.label}
                </td>
                {monthly.map((v, i) => (
                  <td
                    key={periods[i]}
                    style={{
                      padding: '5px 8px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight,
                      color: v === 0 && !isHeader ? 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' : 'var(--tbl-fg, #1A1A1A)',
                    }}
                  >
                    {u.accountId ? (v === 0 ? '—' : fmtCurrency(v, currency)) : ''}
                  </td>
                ))}
                <td style={{
                  padding: '5px 8px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight,
                  background: 'var(--tbl-bg-elev, #faf8f2)',
                  color: 'var(--tbl-fg, #1A1A1A)',
                }}>
                  {u.accountId ? fmtCurrency(annual, currency) : ''}
                </td>
                <td style={{
                  padding: '5px 8px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))',
                  fontWeight,
                }}>
                  {pctOfRev != null ? fmtPct(pctOfRev) : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
