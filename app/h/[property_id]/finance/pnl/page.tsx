// app/h/[property_id]/finance/pnl/page.tsx
//
// Canonical property-scoped P&L page — two subtabs:
//   ?view=month (default) — QuickBooks P&L AS-IS, account-level monthly detail + 12-month rollup
//   ?view=class           — USALI department breakdown from v_finance_pl_by_class_{dept,house}
//
// ADR-159: QB export is single source of truth; USALI is a presentation relabel only.
// PBS 2026-08-25: QB-as-is retained for 'month' view; 'class' view surfaces the
// pre-aggregated USALI bridge views.

import { Fragment, type CSSProperties } from 'react';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';

import KpiBox from '@/components/kpi/KpiBox';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
import {
  getQbPnlForYear,
  getAvailableYears,
  getPropertyCurrency,
  getClassPnl,
  totalsFor,
  blocksForPeriods,
  annualByAccount,
  periodsForYear,
  periodsIn,
  type QbPnlRow,
  type ClassDeptRow,
  type ClassHouseRow,
} from './_data';
import YearDropdown from './YearDropdown';
import MonthDropdown from './MonthDropdown';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPPORTED_YEARS = ['2024', '2025', '2026'];
const EARLIEST_MONTH = '2025-01';

const MUTE = 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))';
const BORDER = 'var(--tbl-border, rgba(26, 26, 26, 0.12))';
const BORDER_STRONG = 'var(--tbl-border-strong, rgba(26, 26, 26, 0.2))';
const FG = 'var(--tbl-fg, #1A1A1A)';

function symbolFor(currency: string): string {
  return currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'LAK' ? '₭' : '';
}
function fmtCurrency(amount: number | null | undefined, currency: string, dp = 0): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return '—';
  const locale = currency === 'EUR' ? 'de-DE' : 'en-US';
  const symbol = symbolFor(currency);
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return amount < 0 ? `(${symbol}${formatted})` : `${symbol}${formatted}`;
}
function fmtK(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return '—';
  const symbol = symbolFor(currency);
  const v = amount / 1000;
  return `${amount < 0 ? '−' : ''}${symbol}${Math.abs(v).toFixed(1)}k`;
}
function fmtPct(amount: number | null | undefined, dp = 1): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return '—';
  return `${amount.toFixed(dp)}%`;
}
function fmtMonthShort(p: string): string {
  return new Date(p + '-01').toLocaleDateString('en-GB', { month: 'short' });
}
function fmtMonthLong(p: string): string {
  return new Date(p + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
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
  while (cur <= to) { out.push(cur); cur = nextPeriod(cur); }
  return out;
}

const DEPT_ORDER = ['Rooms', 'F&B', 'Activities', 'Spa', 'Mekong Cruise', 'Other Operated', 'Undistributed', 'Unclassified'];
function deptSort(a: string, b: string): number {
  const ai = DEPT_ORDER.indexOf(a); const bi = DEPT_ORDER.indexOf(b);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
}

interface Props {
  params: { property_id: string };
  searchParams?: { year?: string; month?: string; view?: string };
}

export default async function PropertyPnLPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);

  const availableYears = await getAvailableYears(propertyId);
  const yearsWithData = availableYears.filter((y) => SUPPORTED_YEARS.includes(y));

  const yearParam = searchParams?.year ?? '';
  const year = SUPPORTED_YEARS.includes(yearParam)
    ? yearParam
    : (yearsWithData[yearsWithData.length - 1] ?? '2025');

  const viewParam = searchParams?.view;
  const view: 'month' | 'class' = viewParam === 'class' ? 'class' : 'month';

  const [rows, currency, classResult] = await Promise.all([
    view === 'month' ? getQbPnlForYear(propertyId, year) : Promise.resolve([] as QbPnlRow[]),
    getPropertyCurrency(propertyId),
    view === 'class' ? getClassPnl(propertyId, year) : Promise.resolve(null as null),
  ]);

  // ── Month selector (used in both views) ───────────────────────────
  const periodsWithData = view === 'month'
    ? periodsIn(rows)
    : [...new Set((classResult?.dept ?? []).map((r) => r.period_yyyymm))].sort();

  const latestInYear = periodsWithData[periodsWithData.length - 1];

  const latestEver = availableYears
    .flatMap((y) => periodsForYear(y))
    .filter((p) => p >= EARLIEST_MONTH)
    .sort()
    .pop() ?? `${year}-12`;
  const monthOptions = monthsFromTo(EARLIEST_MONTH, latestEver);

  const monthParam = searchParams?.month ?? '';
  const selectedMonth = monthOptions.includes(monthParam)
    ? monthParam
    : (latestInYear ?? monthOptions[monthOptions.length - 1] ?? EARLIEST_MONTH);

  // ── QB month view totals ───────────────────────────────────────────
  const monthRows = rows.filter((r) => r.period_yyyymm === selectedMonth);
  const monthTotals = totalsFor(monthRows);
  const yearTotals = totalsFor(rows);

  const noData = view === 'month' && rows.length === 0;
  const monthHasData = monthRows.length > 0;

  const eyebrow = view === 'month'
    ? ['Finance · P&L', `Year ${year}`, `${rows.length} rows · ${currency}`, 'QuickBooks as-is'].join(' · ')
    : ['Finance · P&L', `Year ${year}`, 'USALI class breakdown'].join(' · ');

  // ── Subtab strip hrefs ────────────────────────────────────────────
  const baseHref = `?year=${year}&month=${selectedMonth}`;

  return (
    <DashboardPage
      title={`Profit & Loss · ${year}`}
      subtitle={eyebrow}
      tabs={financeSubPagesForProperty(propertyId).map((s) => ({
        key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/pnl'),
      }))}
      action={<YearDropdown current={year} years={SUPPORTED_YEARS} yearsWithData={yearsWithData} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ─── SUBTAB STRIP ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['month', 'class'] as const).map((v) => {
            const active = view === v;
            const href = `${baseHref}&view=${v}`;
            return (
              <a
                key={v}
                href={href}
                style={{
                  padding: '5px 16px',
                  borderRadius: 4,
                  background: active ? BORDER_STRONG : 'transparent',
                  border: `1px solid ${active ? BORDER_STRONG : BORDER}`,
                  color: active ? FG : MUTE,
                  fontWeight: active ? 700 : 400,
                  fontSize: 'var(--t-xs)',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                {v === 'month' ? 'P&L by Month' : 'P&L by Class'}
              </a>
            );
          })}
        </div>

        {/* ─── SELECTORS ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <MonthDropdown current={selectedMonth} options={monthOptions} monthsWithData={periodsWithData} />
          <span style={{ fontSize: 'var(--t-xs)', color: MUTE }}>
            {view === 'month'
              ? `source: finance.gl_pl_monthly · property_id=${propertyId} · QuickBooks as-is`
              : `source: v_finance_pl_by_class_dept + house · property_id=${propertyId} · USALI departments`}
          </span>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*   VIEW: P&L BY MONTH (QB as-is)                           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {view === 'month' && (
          <>
            {/* ─── KPI BAND ─────────────────────────────────────────── */}
            {monthHasData && monthTotals.sumsToRows && (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <KpiBox
                    label={`Income · ${fmtMonthLong(selectedMonth)}`}
                    value={monthTotals.income || null}
                    unit="text"
                    valueText={fmtCurrency(monthTotals.income, currency)}
                    tooltip={`finance.gl_pl_monthly · QB Income accounts · ${selectedMonth}`}
                  />
                  <KpiBox
                    label="Costs"
                    value={monthTotals.cost || null}
                    unit="text"
                    valueText={fmtCurrency(monthTotals.cost, currency)}
                    tooltip={`finance.gl_pl_monthly · QB cost accounts · ${selectedMonth}`}
                  />
                  <KpiBox
                    label="Net result"
                    value={monthTotals.net || null}
                    unit="text"
                    valueText={fmtCurrency(monthTotals.net, currency)}
                    tooltip="Income less costs, summed from the QB detail accounts"
                  />
                  <KpiBox
                    label="Net margin"
                    value={monthTotals.income !== 0 ? (monthTotals.net / monthTotals.income) * 100 : null}
                    unit="pct"
                    dp={1}
                  />
                </div>
                <div style={{ height: 12 }} />
              </>
            )}

            {monthHasData && !monthTotals.sumsToRows && (
              <>
                <div style={{ padding: 12, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 'var(--t-xs)', color: MUTE }}>
                  This source ships its own subtotal accounts — rows are shown as filed but are not summed here.
                </div>
                <div style={{ height: 12 }} />
              </>
            )}

            {noData && (
              <Container title={`No data for ${year}`} subtitle="empty" expandable={false}>
                <div style={{ padding: 16, color: MUTE, fontSize: 'var(--t-sm)' }}>
                  No rows in <code>finance.gl_pl_monthly</code> for property <code>{propertyId}</code> in {year}.
                </div>
              </Container>
            )}

            {!noData && (
              <>
                {/* Monthly detail */}
                <Container
                  title={`P&L · ${fmtMonthLong(selectedMonth)}`}
                  subtitle={`QuickBooks as-is · ${currency} · ${monthRows.length} accounts`}
                  action={
                    monthTotals.sumsToRows ? (
                      <span style={{ fontSize: 'var(--t-xs)', color: MUTE }}>
                        net {fmtCurrency(monthTotals.net, currency)}
                      </span>
                    ) : undefined
                  }
                >
                  {monthHasData
                    ? <QbTable rows={monthRows} periods={[selectedMonth]} currency={currency} totalsSum={monthTotals.sumsToRows} />
                    : <div style={{ padding: 16, color: MUTE, fontSize: 'var(--t-sm)' }}>
                        No accounts filed for {fmtMonthLong(selectedMonth)}.
                      </div>}
                </Container>

                <div style={{ height: 12 }} />

                {/* 12-month rollup */}
                <Container
                  title={`12-month rollup · FY${year}`}
                  subtitle={`QuickBooks as-is · ${currency} · ${rows.length} rows`}
                  action={
                    yearTotals.sumsToRows ? (
                      <span style={{ fontSize: 'var(--t-xs)', color: MUTE }}>
                        FY {year} · {fmtCurrency(yearTotals.income, currency)} income · {fmtCurrency(yearTotals.net, currency)} net
                      </span>
                    ) : (
                      <span style={{ fontSize: 'var(--t-xs)', color: MUTE }}>stored subtotals · not summed</span>
                    )
                  }
                >
                  <AnnualMatrix rows={rows} year={year} currency={currency} totalsSum={yearTotals.sumsToRows} />
                </Container>
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*   VIEW: P&L BY CLASS (USALI dept breakdown)               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {view === 'class' && classResult && (
          <>
            {/* House KPI band for selected month */}
            <ClassHouseKpiBand
              house={classResult.house}
              month={selectedMonth}
              currency={currency}
            />

            <div style={{ height: 12 }} />

            {/* Dept snapshot for selected month */}
            <Container
              title={`P&L by class · ${fmtMonthLong(selectedMonth)}`}
              subtitle={`USALI department schedule · ${currency} · Revenue / COS / Payroll / Other Exp / Dept Profit`}
            >
              <ClassDeptSnapshot dept={classResult.dept} month={selectedMonth} currency={currency} />
            </Container>

            <div style={{ height: 12 }} />

            {/* Monthly revenue matrix (all months in year) */}
            <Container
              title={`Revenue by class · FY${year}`}
              subtitle="USALI departments × months · USD"
            >
              <ClassMonthlyMatrix
                dept={classResult.dept}
                periods={periodsWithData}
                currency={currency}
                metric="revenue"
                metricLabel="Revenue"
              />
            </Container>

            <div style={{ height: 12 }} />

            {/* Monthly dept profit matrix */}
            <Container
              title={`Departmental profit by class · FY${year}`}
              subtitle="Revenue − COS − Payroll − Other Exp · USALI departments × months"
            >
              <ClassMonthlyMatrix
                dept={classResult.dept}
                periods={periodsWithData}
                currency={currency}
                metric="departmental_profit"
                metricLabel="Dept Profit"
              />
            </Container>
          </>
        )}

        {view === 'class' && !classResult && (
          <div style={{ padding: 32, color: MUTE, fontSize: 'var(--t-sm)', textAlign: 'center' }}>
            No class P&L data for {year}.
          </div>
        )}
      </div>
    </DashboardPage>
  );
}

// ─── QB month view — table grouped by QB type ─────────────────────────────────

function QbTable({
  rows, periods, currency, totalsSum,
}: {
  rows: QbPnlRow[];
  periods: string[];
  currency: string;
  totalsSum: boolean;
}) {
  const blocks = blocksForPeriods(rows, periods);
  const income = totalsSum ? rows.filter((r) => !r.isCost).reduce((s, r) => s + r.amount, 0) : NaN;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-xs)', color: FG }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${BORDER_STRONG}` }}>
            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Account</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Amount</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>% of income</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => (
            <Fragment key={b.qb_type}>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td colSpan={3} style={{ padding: '8px', fontWeight: 700 }}>{b.qb_type}</td>
              </tr>
              {b.rows.map((r) => (
                <tr key={`${b.qb_type}-${r.account_id}`} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '4px 8px 4px 20px', color: r.row_type === 'computed' ? MUTE : FG }}>
                    {r.label}
                    {r.row_type === 'computed' && (
                      <em style={{ marginLeft: 6, fontSize: '0.9em', color: MUTE }}>stored subtotal</em>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', padding: '4px 8px', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCurrency(r.amount, currency)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '4px 8px', color: MUTE, fontVariantNumeric: 'tabular-nums' }}>
                    {totalsSum && isFinite(income) && income !== 0 && r.row_type === 'detail'
                      ? fmtPct((r.amount / income) * 100)
                      : '—'}
                  </td>
                </tr>
              ))}
              {b.subtotal !== null && (
                <tr style={{ borderBottom: `2px solid ${BORDER_STRONG}`, fontWeight: 600 }}>
                  <td style={{ padding: '6px 8px' }}>Total {b.qb_type}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCurrency(b.subtotal, currency)}
                  </td>
                  <td />
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── QB 12-month annual matrix ─────────────────────────────────────────────────

function AnnualMatrix({
  rows, year, currency, totalsSum,
}: {
  rows: QbPnlRow[];
  year: string;
  currency: string;
  totalsSum: boolean;
}) {
  const periods = periodsForYear(year);
  const populated = periods.filter((p) => rows.some((r) => r.period_yyyymm === p));
  const blocks = blocksForPeriods(rows, populated);
  const annual = annualByAccount(rows, populated);
  const seen = new Set<string>();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-xs)', color: FG }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${BORDER_STRONG}` }}>
            <th style={{ textAlign: 'left', padding: '6px 8px', position: 'sticky', left: 0 }}>Account</th>
            {populated.map((p) => (
              <th key={p} style={{ textAlign: 'right', padding: '6px 8px' }}>{fmtMonthShort(p)}</th>
            ))}
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>FY{year}</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => {
            const accounts = b.rows.filter((r) => {
              const k = `${b.qb_type}|${r.account_id}`;
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            return (
              <Fragment key={b.qb_type}>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td colSpan={populated.length + 2} style={{ padding: '8px', fontWeight: 700 }}>{b.qb_type}</td>
                </tr>
                {accounts.map((a) => (
                  <tr key={`${b.qb_type}-${a.account_id}`} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '4px 8px 4px 20px', whiteSpace: 'nowrap', color: a.row_type === 'computed' ? MUTE : FG }}>
                      {a.label}
                      {a.row_type === 'computed' && (
                        <em style={{ marginLeft: 6, fontSize: '0.9em', color: MUTE }}>stored subtotal</em>
                      )}
                    </td>
                    {populated.map((p) => {
                      const cell = rows.find((r) => r.account_id === a.account_id && r.period_yyyymm === p);
                      return (
                        <td key={p} style={{ textAlign: 'right', padding: '4px 8px', fontVariantNumeric: 'tabular-nums' }}>
                          {cell ? fmtK(cell.amount, currency) : '—'}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCurrency(annual.get(a.account_id), currency)}
                    </td>
                  </tr>
                ))}
                {totalsSum && b.subtotal !== null && (
                  <tr style={{ borderBottom: `2px solid ${BORDER_STRONG}`, fontWeight: 600 }}>
                    <td style={{ padding: '6px 8px' }}>Total {b.qb_type}</td>
                    {populated.map((p) => {
                      const v = rows
                        .filter((r) => r.qb_type === b.qb_type && r.period_yyyymm === p && r.row_type === 'detail')
                        .reduce((s, r) => s + r.amount, 0);
                      return (
                        <td key={p} style={{ textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtK(v, currency)}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCurrency(b.subtotal, currency)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── CLASS VIEW: house KPI band ────────────────────────────────────────────────

function ClassHouseKpiBand({ house, month, currency }: { house: ClassHouseRow[]; month: string; currency: string }) {
  const row = house.find((r) => r.period_yyyymm === month);
  if (!row) return null;
  const gopPct = row.revenue > 0 ? (row.gop / row.revenue) * 100 : null;
  const netPct = row.revenue > 0 ? (row.net_income / row.revenue) * 100 : null;
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <KpiBox
        label={`Revenue · ${fmtMonthLong(month)}`}
        value={row.revenue || null}
        unit="text"
        valueText={fmtCurrency(row.revenue, currency)}
        tooltip="House total revenue · v_finance_pl_by_class_house"
      />
      <KpiBox
        label="GoP"
        value={row.gop || null}
        unit="text"
        valueText={fmtCurrency(row.gop, currency)}
        tooltip="Gross Operating Profit · Revenue − COS − Payroll − Undistributed"
      />
      <KpiBox label="GoP margin" value={gopPct} unit="pct" dp={1} />
      <KpiBox
        label="Net income"
        value={row.net_income || null}
        unit="text"
        valueText={fmtCurrency(row.net_income, currency)}
        tooltip="Net income after depreciation, interest, tax"
      />
      <KpiBox label="Net margin" value={netPct} unit="pct" dp={1} />
    </div>
  );
}

// ─── CLASS VIEW: dept snapshot (one month) ─────────────────────────────────────

function ClassDeptSnapshot({ dept, month, currency }: { dept: ClassDeptRow[]; month: string; currency: string }) {
  const rows = dept.filter((r) => r.period_yyyymm === month);
  const depts = [...new Set(rows.map((r) => r.usali_department))].sort(deptSort);
  if (rows.length === 0) {
    return <div style={{ padding: 16, color: MUTE, fontSize: 'var(--t-sm)' }}>No class data for {fmtMonthLong(month)}.</div>;
  }
  const totRev = rows.reduce((s, r) => s + r.revenue, 0);
  const totCos = rows.reduce((s, r) => s + r.cost_of_sales, 0);
  const totPay = rows.reduce((s, r) => s + r.payroll, 0);
  const totOth = rows.reduce((s, r) => s + r.other_op_exp, 0);
  const totPro = rows.reduce((s, r) => s + r.departmental_profit, 0);

  const th: CSSProperties = { textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: 'var(--t-xs)', borderBottom: `2px solid ${BORDER_STRONG}` };
  const td: CSSProperties = { textAlign: 'right', padding: '4px 8px', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--t-xs)' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', color: FG }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Department</th>
            <th style={th}>Revenue</th>
            <th style={th}>COS</th>
            <th style={th}>Payroll</th>
            <th style={th}>Other Exp</th>
            <th style={{ ...th, color: 'var(--tbl-fg, #1A1A1A)' }}>Dept Profit</th>
            <th style={{ ...th, color: MUTE }}>Margin</th>
          </tr>
        </thead>
        <tbody>
          {depts.map((d) => {
            const r = rows.find((x) => x.usali_department === d);
            if (!r) return null;
            const margin = r.revenue > 0 ? (r.departmental_profit / r.revenue) * 100 : null;
            const profitColor = r.departmental_profit < 0 ? '#C0392B' : r.departmental_profit > 0 ? '#27AE60' : FG;
            return (
              <tr key={d} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: '5px 8px', fontSize: 'var(--t-xs)', fontWeight: 500 }}>{d}</td>
                <td style={td}>{fmtCurrency(r.revenue, currency)}</td>
                <td style={{ ...td, color: MUTE }}>{r.cost_of_sales ? fmtCurrency(r.cost_of_sales, currency) : '—'}</td>
                <td style={{ ...td, color: MUTE }}>{r.payroll ? fmtCurrency(r.payroll, currency) : '—'}</td>
                <td style={{ ...td, color: MUTE }}>{r.other_op_exp ? fmtCurrency(r.other_op_exp, currency) : '—'}</td>
                <td style={{ ...td, fontWeight: 600, color: profitColor }}>{fmtCurrency(r.departmental_profit, currency)}</td>
                <td style={{ ...td, color: MUTE }}>{fmtPct(margin)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${BORDER_STRONG}`, fontWeight: 700 }}>
            <td style={{ padding: '6px 8px', fontSize: 'var(--t-xs)' }}>Total</td>
            <td style={td}>{fmtCurrency(totRev, currency)}</td>
            <td style={{ ...td, color: MUTE }}>{fmtCurrency(totCos, currency)}</td>
            <td style={{ ...td, color: MUTE }}>{fmtCurrency(totPay, currency)}</td>
            <td style={{ ...td, color: MUTE }}>{fmtCurrency(totOth, currency)}</td>
            <td style={{ ...td, color: totPro < 0 ? '#C0392B' : totPro > 0 ? '#27AE60' : FG }}>{fmtCurrency(totPro, currency)}</td>
            <td style={{ ...td, color: MUTE }}>{fmtPct(totRev > 0 ? (totPro / totRev) * 100 : null)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── CLASS VIEW: dept × month matrix ──────────────────────────────────────────

function ClassMonthlyMatrix({
  dept, periods, currency, metric, metricLabel,
}: {
  dept: ClassDeptRow[];
  periods: string[];
  currency: string;
  metric: 'revenue' | 'departmental_profit';
  metricLabel: string;
}) {
  const depts = [...new Set(dept.map((r) => r.usali_department))].sort(deptSort);
  if (depts.length === 0 || periods.length === 0) {
    return <div style={{ padding: 16, color: MUTE, fontSize: 'var(--t-sm)' }}>No data.</div>;
  }

  const th: CSSProperties = { textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: 'var(--t-xs)', borderBottom: `2px solid ${BORDER_STRONG}` };
  const td: CSSProperties = { textAlign: 'right', padding: '4px 8px', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--t-xs)' };

  const lookup = new Map<string, number>();
  for (const r of dept) lookup.set(`${r.usali_department}|${r.period_yyyymm}`, r[metric]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', color: FG }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--paper, #fff)' }}>Department</th>
            {periods.map((p) => <th key={p} style={th}>{fmtMonthShort(p)}</th>)}
            <th style={{ ...th, fontWeight: 700 }}>YTD</th>
          </tr>
        </thead>
        <tbody>
          {depts.map((d) => {
            const vals = periods.map((p) => lookup.get(`${d}|${p}`) ?? 0);
            const ytd = vals.reduce((s, v) => s + v, 0);
            const isProfit = metric === 'departmental_profit';
            return (
              <tr key={d} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: '5px 8px', fontSize: 'var(--t-xs)', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--paper, #fff)' }}>{d}</td>
                {vals.map((v, i) => {
                  const color = isProfit && v < 0 ? '#C0392B' : FG;
                  return <td key={periods[i]} style={{ ...td, color }}>{v !== 0 ? fmtK(v, currency) : '—'}</td>;
                })}
                <td style={{ ...td, fontWeight: 600, color: isProfit && ytd < 0 ? '#C0392B' : FG }}>{fmtCurrency(ytd, currency)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${BORDER_STRONG}`, fontWeight: 700 }}>
            <td style={{ padding: '6px 8px', fontSize: 'var(--t-xs)', position: 'sticky', left: 0, background: 'var(--paper, #fff)' }}>Total {metricLabel}</td>
            {periods.map((p) => {
              const v = depts.reduce((s, d) => s + (lookup.get(`${d}|${p}`) ?? 0), 0);
              return <td key={p} style={td}>{fmtK(v, currency)}</td>;
            })}
            <td style={td}>{fmtCurrency(depts.reduce((s, d) => s + periods.reduce((ps, p) => ps + (lookup.get(`${d}|${p}`) ?? 0), 0), 0), currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
