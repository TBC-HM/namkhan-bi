// app/sales/b2b/page.tsx
// Sales › B2B/DMC — Contracts list. Shows ALL partners:
//   - contracts on file (governance.dmc_contracts)
//   - PLUS sources sending LPA reservations with NO contract on file (revenue at risk)
//
// PBS 2026-06-30: migrated chrome to DashboardPage + Container (v6/v7).
// Data layer was already dynamic (force-dynamic + revalidate=60) — no behaviour
// change there. Added BackButton.

import B2bSubNav from './_components/B2bSubNav';
import B2bKpiStrip from './_components/B2bKpiStrip';
import UploadContractButton from './_components/UploadContractButton';
import B2bContractsTable, { type DisplayRow } from './_components/B2bContractsTable';
import { getDmcContracts, getLpaReservations, matchSourceToContract } from '@/lib/dmc';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import BackButton from '@/components/nav/BackButton';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function B2bDmcContractsPage() {
  const [contracts, reservations] = await Promise.all([
    getDmcContracts(),
    getLpaReservations(),
  ]);

  // Aggregate LPA reservation totals per source_name
  const bySource = new Map<string, { count: number; revenue: number }>();
  for (const r of reservations) {
    if (r.is_cancelled) continue;
    const src = r.source_name ?? '(unknown)';
    const cur = bySource.get(src) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(r.total_amount) || 0;
    bySource.set(src, cur);
  }

  // Pre-compute which contract each source matches to (so we don't double-count)
  const sourcesByContract = new Map<string, { totalCount: number; totalRevenue: number; sources: string[] }>();
  const matchedSources = new Set<string>();
  for (const [src, agg] of bySource) {
    const m = matchSourceToContract(src, contracts);
    if (m.contract_id) {
      matchedSources.add(src);
      const cur = sourcesByContract.get(m.contract_id) ?? { totalCount: 0, totalRevenue: 0, sources: [] };
      cur.totalCount += agg.count;
      cur.totalRevenue += agg.revenue;
      cur.sources.push(src);
      sourcesByContract.set(m.contract_id, cur);
    }
  }

  // Build display rows: contracts (with their aggregated res counts) + uncontracted sources
  const contractRows: DisplayRow[] = contracts.map((c) => {
    const a = sourcesByContract.get(c.contract_id) ?? { totalCount: 0, totalRevenue: 0, sources: [] };
    return {
      key: `c:${c.contract_id}`,
      contract_id: c.contract_id,
      partner_short_name: c.partner_short_name,
      country: c.country,
      flag: c.country_flag,
      type: c.partner_type,
      status: c.computed_status,
      effective: c.effective_date,
      expires: c.expiry_date,
      daysToExpiry: c.days_to_expiry,
      contact: c.contact_name,
      autoRenew: c.auto_renew,
      reservationCount: a.totalCount,
      revenue: a.totalRevenue,
    };
  });

  const uncontractedRows: DisplayRow[] = Array.from(bySource.entries())
    .filter(([src]) => !matchedSources.has(src))
    .map(([src, agg]) => ({
      key: `s:${src}`,
      contract_id: null,
      partner_short_name: src,
      country: null,
      flag: null,
      type: '—',
      status: 'no_contract',
      effective: null,
      expires: null,
      daysToExpiry: null,
      contact: null,
      autoRenew: false,
      reservationCount: agg.count,
      revenue: agg.revenue,
    }));

  // Sort: contracts first by status (active before expiring), then uncontracted by revenue desc
  contractRows.sort((a, b) => {
    const order: Record<string, number> = { active: 0, expiring: 1, expired: 2, draft: 3, suspended: 4 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.revenue - a.revenue;
  });
  uncontractedRows.sort((a, b) => b.revenue - a.revenue);
  const allRows = [...contractRows, ...uncontractedRows];

  const salesTabs: DashboardTab[] = SALES_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.startsWith('/sales/b2b'),
  }));

  return (
    <DashboardPage
      title="B2B / DMC partners"
      subtitle={`${contracts.length} contracts on file · ${uncontractedRows.length} uncontracted sources sending LPA business`}
      tabs={salesTabs}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <BackButton fallback="/sales" label="← Sales" />
          <UploadContractButton />
        </div>
      }
    >
      <Container title="KPIs · live" subtitle="Contract pipeline + revenue at risk · refreshes every 60s">
        <B2bSubNav />
        <B2bKpiStrip />
      </Container>

      <Container
        title={`Partners · ${allRows.length}`}
        subtitle="Contracts on file (top) followed by uncontracted sources sending LPA business (yellow rows = revenue at risk)"
      >
        <B2bContractsTable rows={allRows} />
      </Container>

      <div style={{ gridColumn: '1 / -1', marginTop: 4, padding: '10px 14px', background: 'var(--st-good-bg, #EEF5EE)', border: '1px solid var(--st-good-bd, #C8DFC8)', borderRadius: 6, color: 'var(--moss, #2C5F4F)', fontSize: 12 }}>
        <strong>✓ Wired.</strong> {contractRows.length} contracts on file · {uncontractedRows.length} uncontracted sources sending LPA business. Yellow rows = revenue at risk — create contracts for them via the Reconciliation queue.
      </div>
    </DashboardPage>
  );
}
