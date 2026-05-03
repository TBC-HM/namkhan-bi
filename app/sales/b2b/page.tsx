// app/sales/b2b/page.tsx
// Sales › B2B/DMC — Contracts list. Shows ALL partners:
//   - contracts on file (governance.dmc_contracts)
//   - PLUS sources sending LPA reservations with NO contract on file (revenue at risk)

import Link from 'next/link';
import B2bSubNav from './_components/B2bSubNav';
import B2bKpiStrip from './_components/B2bKpiStrip';
import UploadContractButton from './_components/UploadContractButton';
import { getDmcContracts, getLpaReservations, matchSourceToContract } from '@/lib/dmc';
import PageHeader from '@/components/layout/PageHeader';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, fmtCountry, fmtBool, EMPTY } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  active:      { tone: 'active',   label: 'Active' },
  expiring:    { tone: 'pending',  label: 'Expiring' },
  expired:     { tone: 'expired',  label: 'Expired' },
  draft:       { tone: 'inactive', label: 'Draft' },
  suspended:   { tone: 'inactive', label: 'Suspended' },
  no_contract: { tone: 'expired',  label: 'No contract' },
};

interface DisplayRow {
  key: string;
  contract_id: string | null;
  partner_short_name: string;
  country: string | null;
  flag: string | null;
  type: string;
  status: string;
  effective: string | null;
  expires: string | null;
  daysToExpiry: number | null;
  contact: string | null;
  autoRenew: boolean;
  reservationCount: number;
  revenue: number;
}

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

  return (
    <>
      <PageHeader
        pillar="Sales"
        tab="B2B / DMC › Partners"
        title={<>B2B / DMC · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{contracts.length} on file · {uncontractedRows.length} uncontracted</em></>}
        lede={<>Every partner with a contract <strong>or</strong> sending business via the LPA rate plan. Uncontracted sources highlighted — that's revenue with no anti-publication clause / parity guard / payment terms.</>}
        rightSlot={<UploadContractButton />}
      />

      <B2bSubNav />
      <B2bKpiStrip />

      {(() => {
        const columns: Column<DisplayRow>[] = [
          {
            key: 'partner',
            header: 'PARTNER',
            sortValue: (r) => r.partner_short_name.toLowerCase(),
            render: (r) =>
              r.contract_id ? (
                <Link href={`/sales/b2b/partner/${r.contract_id}`} style={{ color: 'var(--ink-soft)', textDecoration: 'none', fontWeight: 500 }}>
                  {r.partner_short_name}
                </Link>
              ) : (
                <span style={{ color: 'var(--st-bad)', fontWeight: 500 }}>{r.partner_short_name}</span>
              ),
          },
          {
            key: 'country',
            header: 'COUNTRY',
            sortValue: (r) => r.country ?? '',
            render: (r) => fmtCountry(r.flag, r.country),
          },
          { key: 'type',     header: 'TYPE',     sortValue: (r) => r.type, render: (r) => r.type },
          {
            key: 'status',
            header: 'STATUS',
            align: 'center',
            sortValue: (r) => r.status,
            render: (r) => {
              const t = STATUS_TONE[r.status] ?? STATUS_TONE.draft;
              return <StatusPill tone={t.tone}>{t.label}</StatusPill>;
            },
          },
          { key: 'effective', header: 'EFFECTIVE', sortValue: (r) => r.effective ?? '', render: (r) => fmtIsoDate(r.effective) },
          { key: 'expires',   header: 'EXPIRES',   sortValue: (r) => r.expires ?? '',   render: (r) => fmtIsoDate(r.expires) },
          {
            key: 'days',
            header: 'DAYS',
            numeric: true,
            sortValue: (r) => r.daysToExpiry ?? Number.MAX_SAFE_INTEGER,
            render: (r) =>
              r.daysToExpiry == null ? EMPTY :
              r.daysToExpiry > 0 ? `${r.daysToExpiry}` :
              r.daysToExpiry === 0 ? 'today' : `${Math.abs(r.daysToExpiry)}d ago`,
          },
          {
            key: 'bookings',
            header: 'BOOKINGS',
            numeric: true,
            sortValue: (r) => r.reservationCount,
            render: (r) => r.reservationCount > 0 ? r.reservationCount.toLocaleString('en-US') : EMPTY,
          },
          {
            key: 'revenue',
            header: 'REVENUE',
            numeric: true,
            sortValue: (r) => r.revenue,
            render: (r) => r.revenue > 0 ? fmtTableUsd(r.revenue) : EMPTY,
          },
          {
            key: 'renew',
            header: 'RENEW',
            align: 'center',
            sortValue: (r) => r.autoRenew ? 1 : 0,
            render: (r) => fmtBool(r.autoRenew),
          },
        ];
        return (
          <DataTable<DisplayRow>
            columns={columns}
            rows={allRows}
            rowKey={(r) => r.key}
            rowClassName={(r) => r.contract_id == null ? 'row-warn' : undefined}
            emptyState="No partners on file."
          />
        );
      })()}

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: "var(--t-sm)" }}>
        <strong>✓ Wired.</strong> {contractRows.length} contracts on file · {uncontractedRows.length} uncontracted sources sending LPA business. Yellow rows = revenue at risk — create contracts for them via Reconciliation queue.
      </div>
    </>
  );
}
