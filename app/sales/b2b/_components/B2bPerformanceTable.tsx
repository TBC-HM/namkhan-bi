'use client';

// Client renderer for /sales/b2b/performance partner scorecard.
// Owns column definitions (functions can't cross the RSC boundary).

import Link from 'next/link';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd, EMPTY } from '@/lib/format';

export interface PerfRow {
  source_name: string;
  reservation_count: number;
  rns: number;
  revenue: number;
  cancelled_count: number;
  matched_contract_id: string | null;
  matched_partner: string | null;
}

interface Props {
  rows: PerfRow[];
}

export default function B2bPerformanceTable({ rows }: Props) {
  const totalRevenue = rows.reduce((s, p) => s + p.revenue, 0);
  const totalRns = rows.reduce((s, p) => s + p.rns, 0);
  const totalRes = rows.reduce((s, p) => s + p.reservation_count, 0);

  const columns: Column<PerfRow>[] = [
    {
      key: '#', header: '#', numeric: true, width: '52px',
      render: (_r, ctx) => ctx.rowIndex + 1,
    },
    {
      key: 'source', header: 'SOURCE (CLOUDBEDS)',
      sortValue: (r) => r.source_name.toLowerCase(),
      render: (r) => <span style={{ fontWeight: 500 }}>{r.source_name}</span>,
    },
    {
      key: 'matched', header: 'MATCHED CONTRACT',
      sortValue: (r) => r.matched_partner ?? '',
      render: (r) =>
        r.matched_contract_id ? (
          <Link href={`/sales/b2b/partner/${r.matched_contract_id}`} style={{ color: 'var(--moss-glow)', textDecoration: 'none', fontWeight: 500 }}>
            ✓ {r.matched_partner}
          </Link>
        ) : (
          <span style={{ color: 'var(--st-bad)', fontStyle: 'italic' }}>no contract on file</span>
        ),
    },
    { key: 'bookings', header: 'BOOKINGS', numeric: true, sortValue: (r) => r.reservation_count, render: (r) => r.reservation_count > 0 ? r.reservation_count.toLocaleString('en-US') : EMPTY },
    {
      key: 'cxl', header: 'CXL', numeric: true,
      sortValue: (r) => r.cancelled_count,
      render: (r) => r.cancelled_count > 0
        ? <span style={{ color: 'var(--st-bad)' }}>{r.cancelled_count.toLocaleString('en-US')}</span>
        : EMPTY,
    },
    { key: 'rns',     header: 'RNS',     numeric: true, sortValue: (r) => r.rns, render: (r) => r.rns.toLocaleString('en-US') },
    { key: 'revenue', header: 'REVENUE', numeric: true, sortValue: (r) => r.revenue, render: (r) => fmtTableUsd(r.revenue) },
    {
      key: 'adr', header: 'ADR', numeric: true,
      sortValue: (r) => r.rns > 0 ? r.revenue / r.rns : 0,
      render: (r) => r.rns > 0 ? fmtTableUsd(r.revenue / r.rns) : EMPTY,
    },
    {
      key: 'share', header: 'SHARE', numeric: true,
      sortValue: (r) => totalRevenue > 0 ? r.revenue / totalRevenue : 0,
      render: (r) => totalRevenue > 0 ? `${((r.revenue / totalRevenue) * 100).toFixed(1)}%` : EMPTY,
    },
  ];

  const footer = (
    <>
      <td colSpan={3} style={{ padding: '12px 14px' }}>Total · {rows.length} sources</td>
      <td className="align-right tabular" style={{ padding: '12px 14px' }}>{totalRes.toLocaleString('en-US')}</td>
      <td></td>
      <td className="align-right tabular" style={{ padding: '12px 14px' }}>{totalRns.toLocaleString('en-US')}</td>
      <td className="align-right tabular" style={{ padding: '12px 14px' }}>{fmtTableUsd(totalRevenue)}</td>
      <td className="align-right tabular" style={{ padding: '12px 14px' }}>{totalRns > 0 ? fmtTableUsd(totalRevenue / totalRns) : EMPTY}</td>
      <td className="align-right" style={{ padding: '12px 14px' }}>100.0%</td>
    </>
  );

  return (
    <DataTable<PerfRow>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.source_name}
      defaultSort={{ key: 'revenue', dir: 'desc' }}
      footer={footer}
      emptyState="No LPA reservations on file."
    />
  );
}
