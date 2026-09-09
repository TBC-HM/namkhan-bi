// app/holding/finance/pl/page.tsx
// Holding P&L — TBC Management FZCO. Brief holding-pl-v1 v2.
//
// TBC is a fee vehicle, not a hotel: no USALI, no class dimension, no property
// scope. Nothing in this route reads finance.gl_*, gl.*, tenancy.properties or
// any property-scoped object, and no holding object carries a property_id.
//
// EVERY FIGURE IS FETCHED. There is no euro amount, total, count or date-range
// literal anywhere in this module, no mock data and no fallback value. The
// period itself defaults inside fn_holding_pl_payload(null, null) — the code
// passes null and renders back whatever period the RPC resolved.
//
// Access: middleware 403s /holding for any session whose holding_role claim is
// empty, which is the same guard the sibling Finance pages rely on.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import {
  fetchHoldingPl, fetchPlLines, fetchArAgeing, fetchPlMonthly, fetchLineTypes,
  fetchHoldingBudget,
} from './_lib/fetchPayload';
import { isoDateOrNull, dateLabel } from './_lib/format';
import { PlSubTabs, ErrorPanel, TABS, PL_PATH, type TabKey } from './_components/ui';
import PeriodFilter from './_components/PeriodFilter';
import YearTabs from './_components/YearTabs';
import AnnualRollup, { type YearColumn } from './_components/AnnualRollup';
import DataQualityPanel from './_components/DataQualityPanel';
import OverviewTab from './_components/OverviewTab';
import DepartmentsTab from './_components/DepartmentsTab';
import ArAgeingTab from './_components/ArAgeingTab';
import LedgerTab from './_components/LedgerTab';
import UploadTab from './_components/UploadTab';
import BudgetTab from './_components/BudgetTab';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HoldingPlPage({ searchParams }: {
  searchParams?: {
    tab?: string; from?: string; to?: string; year?: string;
    dept?: string; line_type?: string; flag?: string;
  };
}) {
  const tab: TabKey = (TABS.some((t) => t.key === searchParams?.tab)
    ? searchParams?.tab
    : 'overview') as TabKey;

  // Null when absent or malformed — the RPC then chooses the period.
  // ?year=YYYY is shorthand for that calendar year and is validated against the
  // years the DATA actually contains, never against a hardcoded list.
  const qYear = /^\d{4}$/.test(searchParams?.year ?? '') ? searchParams!.year! : null;
  const qFrom = qYear ? `${qYear}-01-01` : isoDateOrNull(searchParams?.from);
  const qTo = qYear ? `${qYear}-12-31` : isoDateOrNull(searchParams?.to);

  const cfg = DEPT_CFG.holding_finance;
  const deptTabs: DashboardTab[] = cfg.subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === PL_PATH,
  }));

  // Always resolve the full period first: it is what tells us which years the
  // ledger actually contains. The year buttons are built from that, never from
  // a list written down here.
  const full = await fetchHoldingPl(null, null);
  const years = full.ok && full.data
    ? Array.from(new Set(full.data.by_month.map((m) => m.period_yyyymm.slice(0, 4)))).sort()
    : [];

  const payload = qFrom || qTo ? await fetchHoldingPl(qFrom, qTo) : full;

  if (!payload.ok || !payload.data) {
    return (
      <DashboardPage
        title="Finance · Holding · P&L"
        subtitle="TBC Management FZCO"
        tabs={deptTabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <PlSubTabs current={tab} from={qFrom} to={qTo} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <ErrorPanel what="The P&L payload" message={payload.error ?? 'Unknown error'} />
        </div>
      </DashboardPage>
    );
  }

  const p = payload.data;
  // The period the RPC actually used — this drives the drilldowns and the
  // date inputs, so the page and the RPC can never disagree about the window.
  const from = p.period.from;
  const to = p.period.to;
  const dept = searchParams?.dept || null;
  const lineType = searchParams?.line_type || null;
  const flag = searchParams?.flag || null;

  // Annual roll-up: one payload per year, so the gold layer does the arithmetic
  // for each column rather than this page re-summing months.
  const yearColumns: YearColumn[] = tab === 'overview'
    ? await Promise.all(years.map(async (y): Promise<YearColumn> => {
        const r = await fetchHoldingPl(`${y}-01-01`, `${y}-12-31`);
        return { year: y, payload: r.ok ? r.data : null, error: r.ok ? null : r.error };
      }))
    : [];

  const [monthly, arRows, ledgerRows, lineTypes, budget] = await Promise.all([
    tab === 'departments' ? fetchPlMonthly(from, to) : Promise.resolve(null),
    tab === 'ar' ? fetchArAgeing() : Promise.resolve(null),
    tab === 'ledger' ? fetchPlLines({ from, to, dept, lineType, flag }) : Promise.resolve(null),
    tab === 'ledger' ? fetchLineTypes(from, to) : Promise.resolve([] as string[]),
    tab === 'budget' ? fetchHoldingBudget(qFrom, qTo) : Promise.resolve(null),
  ]);

  return (
    <DashboardPage
      title="Finance · Holding · P&L"
      subtitle={`${p.entity} · ${p.basis} basis · ${p.reporting_currency} reporting layer · ${dateLabel(from)} — ${dateLabel(to)}`}
      tabs={deptTabs}
    >
      <div style={{ display: 'grid', gap: 16, gridColumn: '1 / -1' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 12, flexWrap: 'wrap',
        }}>
          <PlSubTabs current={tab} from={qFrom} to={qTo} />
          <PeriodFilter tab={tab} from={from} to={to} />
        </div>
        {years.length > 0 && <YearTabs tab={tab} years={years} current={qYear} />}
      </div>

      {tab === 'overview' && <OverviewTab p={p} />}
      {tab === 'overview' && yearColumns.length > 0 && (
        <AnnualRollup columns={yearColumns} currency={p.reporting_currency} />
      )}
      {tab === 'departments' && monthly && <DepartmentsTab p={p} monthly={monthly} />}
      {tab === 'ar' && arRows && <ArAgeingTab p={p} rows={arRows} />}
      {tab === 'ledger' && ledgerRows && (
        <LedgerTab
          p={p} rows={ledgerRows} lineTypes={lineTypes}
          from={from} to={to} dept={dept} lineType={lineType} flag={flag}
        />
      )}
      {tab === 'budget' && budget && (
        budget.ok && budget.data
          ? <BudgetTab b={budget.data} />
          : (
            <div style={{ gridColumn: '1 / -1' }}>
              <ErrorPanel what="The budget payload" message={budget.error ?? 'Unknown error'} />
            </div>
          )
      )}
      {tab === 'upload' && <UploadTab p={p} />}

      {tab !== 'upload' && (
        <div style={{ gridColumn: '1 / -1' }}>
          <DataQualityPanel p={p} />
        </div>
      )}
    </DashboardPage>
  );
}
