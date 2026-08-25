// app/h/[property_id]/finance/pnl/page.tsx
//
// Canonical property-scoped P&L page — QuickBooks P&L AS-IS.
//
// ADR-159: the QB export is the single source of truth; USALI is a presentation
// relabel only, never a re-derivation. PBS 2026-08-25 applied that to this page:
// the USALI structure is out. Accounts are grouped by their own QB type and
// printed in account-code order, so an upload renders with no mapping step and
// FY2026 (Spanish PGC, 246 accounts) shows up the moment it lands.
//
// Namkhan (260955) redirects to /finance/pnl, its own QB-by-class dashboard.
//
// Layout:
//   1) Year + month selectors.
//   2) KPI band — Income / Costs / Net for the selected month.
//   3) Monthly P&L — QB-type blocks, every account, for the selected month.
//   4) 12-month rollup — account x month matrix for the selected year.
//
// TOTALS: see totalsModeFor() in ./_data. Files that ship their own subtotal
// accounts (Donna FY2025) are NOT summed — that file is double-loaded under two
// prefixes and hierarchical, so summing invents EUR 25.4M of income against
// EUR 6.43M of real revenue. Flat exports (FY2026+) are summed normally.

import { Fragment } from 'react';
import { redirect } from 'next/navigation';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';

import KpiBox from '@/components/kpi/KpiBox';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
import {
  getQbPnlForYear,
  getAvailableYears,
  getPropertyCurrency,
  totalsFor,
  blocksForPeriods,
  annualByAccount,
  periodsForYear,
  periodsIn,
  type QbPnlRow,
} from './_data';
import YearDropdown from './YearDropdown';
import MonthDropdown from './MonthDropdown';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

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

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PropertyPnLPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);

  // Namkhan keeps its own QB-by-class dashboard (ADR-159, gl.* schema).
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/finance/pnl');

  const availableYears = await getAvailableYears(propertyId);
  const yearsWithData = availableYears.filter((y) => SUPPORTED_YEARS.includes(y));

  const yearParam = (searchParams.year as string | undefined) || '';
  const year = SUPPORTED_YEARS.includes(yearParam)
    ? yearParam
    : (yearsWithData[yearsWithData.length - 1] ?? '2025');

  const [rows, currency] = await Promise.all([
    getQbPnlForYear(propertyId, year),
    getPropertyCurrency(propertyId),
  ]);

  const periodsWithData = periodsIn(rows);
  const latestInYear = periodsWithData[periodsWithData.length - 1];

  const latestEver = availableYears
    .flatMap((y) => periodsForYear(y))
    .filter((p) => p >= EARLIEST_MONTH)
    .sort()
    .pop() ?? `${year}-12`;
  const monthOptions = monthsFromTo(EARLIEST_MONTH, latestEver);

  const monthParam = (searchParams.month as string | undefined) || '';
  const selectedMonth = monthOptions.includes(monthParam)
    ? monthParam
    : (latestInYear ?? monthOptions[monthOptions.length - 1] ?? EARLIEST_MONTH);

  // ── Totals ───────────────────────────────────────────────────────────
  const monthRows = rows.filter((r) => r.period_yyyymm === selectedMonth);
  const monthTotals = totalsFor(monthRows);
  const yearTotals = totalsFor(rows);

  const noData = rows.length === 0;
  const monthHasData = monthRows.length > 0;

  const eyebrow = [
    'Finance · P&L',
    `Year ${year}`,
    `${rows.length} rows · ${currency}`,
    'QuickBooks as-is',
  ].join(' · ');

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

        {/* ─── 1. SELECTORS ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <MonthDropdown current={selectedMonth} options={monthOptions} monthsWithData={periodsWithData} />
          <span style={{ fontSize: 'var(--t-xs)', color: MUTE }}>
            source: finance.gl_pl_monthly · property_id={propertyId} · accounts shown exactly as QuickBooks reports them
          </span>
        </div>

        {/* ─── 2. KPI BAND ──────────────────────────────────────────── */}
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

        {/* Stored-subtotal files: say so instead of printing a sum that lies. */}
        {monthHasData && !monthTotals.sumsToRows && (
          <>
            <div style={{ padding: 12, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 'var(--t-xs)', color: MUTE }}>
              This source ships its own subtotal accounts and repeats several lines under more
              than one account code, so the rows below are shown as filed but are not added up
              here — any total would double-count. Read the subtotal lines (marked
              <em> stored subtotal</em>) for this file&apos;s own figures.
            </div>
            <div style={{ height: 12 }} />
          </>
        )}

        {/* ─── 3. MONTHLY P&L ───────────────────────────────────────── */}
        {noData && (
          <Container title={`No data for ${year}`} subtitle="empty" expandable={false}>
            <div style={{ padding: 16, color: MUTE, fontSize: 'var(--t-sm)' }}>
              No rows in <code>finance.gl_pl_monthly</code> for property <code>{propertyId}</code> in {year}.
            </div>
          </Container>
        )}

        {!noData && (
          <>
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

            {/* ─── 4. 12-MONTH ROLLUP ─────────────────────────────── */}
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
      </div>
    </DashboardPage>
  );
}

// ───── One-period P&L, grouped by QuickBooks type ──────────────────────

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

// ───── Account x month matrix for the year ─────────────────────────────

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

  // One row per account, not per account-period.
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
