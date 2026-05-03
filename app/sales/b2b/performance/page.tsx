// app/sales/b2b/performance/page.tsx
// Sales › B2B/DMC › Performance scorecard.
// WIRED: aggregates real LPA reservations grouped by source_name + matches against contracts.

import B2bSubNav from '../_components/B2bSubNav';
import B2bKpiStrip from '../_components/B2bKpiStrip';
import B2bPerformanceTable, { type PerfRow } from '../_components/B2bPerformanceTable';
import { getLpaReservations, getDmcContracts, matchSourceToContract } from '@/lib/dmc';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PartnerRow {
  source_name: string;
  reservation_count: number;
  rns: number;
  revenue: number;
  cancelled_count: number;
  matched_contract_id: string | null;
  matched_partner: string | null;
}

export default async function PerformancePage() {
  const [reservations, contracts] = await Promise.all([
    getLpaReservations(),
    getDmcContracts(),
  ]);

  // Aggregate by source_name
  const byPartner = new Map<string, PartnerRow>();
  for (const r of reservations) {
    const src = r.source_name ?? '(unknown)';
    if (!byPartner.has(src)) {
      const m = matchSourceToContract(src, contracts);
      byPartner.set(src, {
        source_name: src,
        reservation_count: 0,
        rns: 0,
        revenue: 0,
        cancelled_count: 0,
        matched_contract_id: m.contract_id,
        matched_partner: m.partner_short_name,
      });
    }
    const row = byPartner.get(src)!;
    if (r.is_cancelled) {
      row.cancelled_count += 1;
    } else {
      row.reservation_count += 1;
      row.rns += Number(r.nights) || 0;
      row.revenue += Number(r.total_amount) || 0;
    }
  }

  const partners = Array.from(byPartner.values()).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = partners.reduce((s, p) => s + p.revenue, 0);
  const totalRns = partners.reduce((s, p) => s + p.rns, 0);
  const totalRes = partners.reduce((s, p) => s + p.reservation_count, 0);

  return (
    <>
      <PageHeader
        pillar="Sales"
        tab="B2B / DMC › Performance"
        title={<>Partner scorecard · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>all-time</em></>}
        lede={<>{partners.length} unique sources on LPA rate plan. Aggregated from <code>public.reservations</code>.</>}
      />

      <B2bSubNav />
      <B2bKpiStrip />

      <B2bPerformanceTable rows={partners as PerfRow[]} />

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: "var(--t-sm)" }}>
        <strong>✓ Wired.</strong> Real revenue + RNs from {partners.length} sources on LPA rate plan. Sources without contracts = revenue at risk (no anti-publication clause / parity guard / payment terms enforced).
      </div>
    </>
  );
}
