'use client';

// app/sales/b2b/page.tsx
// Marathon #195 — Sales · B2B
// Carla assumptions:
//   • View: sales.v_b2b_contracts (columns below inferred from standard B2B schema)
//   • Columns: company_name, segment, contract_value_usd, room_nights, adr_usd, status, valid_from, valid_to
//   • KPIs: total_contracts, total_room_nights, total_contract_value_usd, avg_adr_usd
//   • Status pill colours: active=green, expired=red, pending=amber, draft=grey
//   • Supabase client uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
//     (client component cannot access SUPABASE_SERVICE_ROLE_KEY)

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import PageHeader from '@/components/layout/PageHeader';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface B2BContract {
  company_name: string;
  segment: string;
  contract_value_usd: number | null;
  room_nights: number | null;
  adr_usd: number | null;
  status: string;
  valid_from: string | null;
  valid_to: string | null;
}

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return d.slice(0, 10); // YYYY-MM-DD
}

const STATUS_COLOUR: Record<string, 'green' | 'red' | 'amber' | 'grey'> = {
  active: 'green',
  expired: 'red',
  pending: 'amber',
  draft: 'grey',
};

export default function SalesB2BPage() {
  const [rows, setRows] = useState<B2BContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabase
        .from('v_b2b_contracts')
        .select('*')
        .order('company_name', { ascending: true })
        .limit(200);
      if (err) setError(err.message);
      setRows((data as B2BContract[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // KPI aggregations
  const totalContracts = rows.length;
  const totalRoomNights = rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const totalValue = rows.reduce((s, r) => s + (r.contract_value_usd ?? 0), 0);
  const avgAdr =
    rows.filter((r) => r.adr_usd != null).length > 0
      ? rows.reduce((s, r) => s + (r.adr_usd ?? 0), 0) /
        rows.filter((r) => r.adr_usd != null).length
      : null;

  const columns = [
    { key: 'company_name', header: 'Company' },
    { key: 'segment', header: 'Segment' },
    {
      key: 'contract_value_usd',
      header: 'Contract Value',
      render: (r: B2BContract) => fmt(r.contract_value_usd, '$'),
    },
    {
      key: 'room_nights',
      header: 'Room Nights',
      render: (r: B2BContract) => fmt(r.room_nights),
    },
    {
      key: 'adr_usd',
      header: 'ADR',
      render: (r: B2BContract) => fmt(r.adr_usd, '$'),
    },
    {
      key: 'valid_from',
      header: 'Valid From',
      render: (r: B2BContract) => fmtDate(r.valid_from),
    },
    {
      key: 'valid_to',
      header: 'Valid To',
      render: (r: B2BContract) => fmtDate(r.valid_to),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: B2BContract) => (
        <StatusPill
          label={r.status ?? '—'}
          colour={STATUS_COLOUR[r.status?.toLowerCase()] ?? 'grey'}
        />
      ),
    },
  ];

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Sales" tab="B2B" title="B2B Contracts" />

      {error && (
        <p style={{ color: '#c0392b', margin: '8px 0' }}>
          ⚠ Data error: {error}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          margin: '24px 0',
        }}
      >
        <KpiBox
          label="Total Contracts"
          value={loading ? '…' : String(totalContracts)}
        />
        <KpiBox
          label="Total Room Nights"
          value={loading ? '…' : fmt(totalRoomNights)}
        />
        <KpiBox
          label="Total Contract Value"
          value={loading ? '…' : fmt(totalValue, '$')}
        />
        <KpiBox
          label="Avg ADR"
          value={loading ? '…' : fmt(avgAdr, '$')}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="No B2B contracts found."
      />
    </main>
  );
}
