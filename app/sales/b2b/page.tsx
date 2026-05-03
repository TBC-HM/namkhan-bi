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

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const STATUS_PILL: Record<string, { bg: string; bd: string; fg: string; label: string }> = {
  active:    { bg: 'var(--st-good-bg)', bd: 'var(--st-good-bd)', fg: 'var(--moss-glow)', label: 'Active' },
  expiring:  { bg: 'var(--st-warn-bg)', bd: 'var(--st-warn-bd)', fg: 'var(--brass)', label: 'Expiring' },
  expired:   { bg: 'var(--st-bad-bg)', bd: 'var(--st-bad-bd)', fg: 'var(--st-bad)', label: 'Expired' },
  draft:     { bg: '#eee',    bd: '#ccc',    fg: '#555',    label: 'Draft' },
  suspended: { bg: '#eee',    bd: '#ccc',    fg: '#555',    label: 'Suspended' },
  no_contract: { bg: 'var(--st-bad-bg)', bd: 'var(--st-bad-bd)', fg: 'var(--st-bad)', label: 'No contract' },
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

      <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--paper-warm)', textAlign: 'left', color: 'var(--ink-mute)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>Partner</th>
              <th style={{ padding: '10px 12px' }}>Country</th>
              <th style={{ padding: '10px 12px' }}>Type</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px' }}>Effective</th>
              <th style={{ padding: '10px 12px' }}>Expires</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Days</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Bookings</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Revenue</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Renew</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row) => {
              const pill = STATUS_PILL[row.status] ?? STATUS_PILL.draft;
              const dayColor =
                row.daysToExpiry == null ? 'var(--ink-mute)' :
                row.daysToExpiry < 0 ? 'var(--st-bad)' :
                row.daysToExpiry < 90 ? 'var(--brass)' : 'var(--ink-soft)';
              const isUncontracted = row.contract_id == null;
              return (
                <tr
                  key={row.key}
                  style={{
                    borderTop: '1px solid var(--paper-warm)',
                    background: isUncontracted ? 'var(--paper-warm)' : 'var(--paper-warm)',
                  }}
                >
                  <td style={{ padding: '10px 12px' }}>
                    {row.contract_id ? (
                      <Link href={`/sales/b2b/partner/${row.contract_id}`} style={{ color: 'var(--ink-soft)', textDecoration: 'none', fontWeight: 500 }}>
                        {row.partner_short_name}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--st-bad)', fontWeight: 500 }}>{row.partner_short_name}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{row.flag ?? ''} {row.country ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{row.type}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: pill.bg, border: `1px solid ${pill.bd}`, color: pill.fg, padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 600 }}>
                      {pill.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink-mute)', fontSize: 11.5 }}>{row.effective ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink-mute)', fontSize: 11.5 }}>{row.expires ?? '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: dayColor }}>
                    {row.daysToExpiry == null ? '—' :
                      row.daysToExpiry > 0 ? `${row.daysToExpiry}` :
                      row.daysToExpiry === 0 ? 'today' : `${Math.abs(row.daysToExpiry)}d ago`}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{row.reservationCount || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    {row.revenue > 0 ? `USD ${row.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--ink-mute)' }}>
                    {row.autoRenew ? '✓' : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: 11.5 }}>
        <strong>✓ Wired.</strong> {contractRows.length} contracts on file · {uncontractedRows.length} uncontracted sources sending LPA business. Yellow rows = revenue at risk — create contracts for them via Reconciliation queue.
      </div>
    </>
  );
}
