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
} from './_lib/fetchPayload';
import { isoDateOrNull, dateLabel } from './_lib/format';
import { PlSubTabs, ErrorPanel, TABS, PL_PATH, type TabKey } from './_components/ui';
import PeriodFilter from './_components/PeriodFilter';
import DataQualityPanel from './_components/DataQualityPanel';
import OverviewTab from './_components/OverviewTab';
import DepartmentsTab from './_components/DepartmentsTab';
import ArAgeingTab from './_components/ArAgeingTab';
import LedgerTab from './_components/LedgerTab';
import UploadTab from './_components/UploadTab';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HoldingPlPage({ searchParams }: {
  searchParams?: {
    tab?: string; from?: string; to?: string;
    dept?: string; line_type?: string; flag?: string;
  };
}) {
  const tab: TabKey = (TABS.some((t) => t.key === searchParams?.tab)
    ? searchParams?.tab
    : 'overview') as TabKey;

  // Null when absent or malformed — the RPC then chooses the period.
  const qFrom = isoDateOrNull(searchParams?.from);
  const qTo = isoDateOrNull(searchParams?.to);

  const cfg = DEPT_CFG.holding_finance;
  const deptTabs: DashboardTab[] = cfg.subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === PL_PATH,
  }));

  const payload = await fetchHoldingPl(qFrom, qTo);

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

  const [monthly, arRows, ledgerRows, lineTypes] = await Promise.all([
    tab === 'departments' ? fetchPlMonthly(from, to) : Promise.resolve(null),
    tab === 'ar' ? fetchArAgeing() : Promise.resolve(null),
    tab === 'ledger' ? fetchPlLines({ from, to, dept, lineType, flag }) : Promise.resolve(null),
    tab === 'ledger' ? fetchLineTypes(from, to) : Promise.resolve([] as string[]),
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
      </div>

      {tab === 'overview' && <OverviewTab p={p} />}
      {tab === 'departments' && monthly && <DepartmentsTab p={p} monthly={monthly} />}
      {tab === 'ar' && arRows && <ArAgeingTab p={p} rows={arRows} />}
      {tab === 'ledger' && ledgerRows && (
        <LedgerTab
          p={p} rows={ledgerRows} lineTypes={lineTypes}
          from={from} to={to} dept={dept} lineType={lineType} flag={flag}
        />
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
