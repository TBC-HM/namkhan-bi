'use client';

// app/revenue/pulse/page.tsx
// Marathon #195 child — Revenue · Pulse adapted to new design + wired to Supabase
// Assumptions:
//   - view `v_revenue_pulse` exists in public schema with columns: date, occupancy_pct,
//     adr_usd, revpar_usd, revenue_usd, rooms_sold, rooms_available
//   - Falls back to em-dash placeholders if view is empty or missing
//   - Client component used (no server-side createClient) to avoid SUPABASE_SERVICE_ROLE_KEY
//     requirement; uses NEXT_PUBLIC_SUPABASE_ANON_KEY with RLS read access for BI users

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PulseRow {
  date: string;
  occupancy_pct: number | null;
  adr_usd: number | null;
  revpar_usd: number | null;
  revenue_usd: number | null;
  rooms_sold: number | null;
  rooms_available: number | null;
}

const fmt = (v: number | null | undefined, prefix = '') =>
  v == null ? '—' : `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${Number(v).toFixed(1)}%`;

export default function RevenuePulsePage() {
  const [rows, setRows] = useState<PulseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('v_revenue_pulse')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);
      setRows((data as PulseRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const latest = rows[0] ?? null;

  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'rooms_sold', header: 'Rooms Sold' },
    { key: 'rooms_available', header: 'Rooms Avail.' },
    { key: 'occupancy_pct', header: 'OCC %' },
    { key: 'adr_usd', header: 'ADR (USD)' },
    { key: 'revpar_usd', header: 'RevPAR (USD)' },
    { key: 'revenue_usd', header: 'Revenue (USD)' },
  ];

  const tableRows = rows.map((r) => ({
    date: r.date ?? '—',
    rooms_sold: r.rooms_sold ?? '—',
    rooms_available: r.rooms_available ?? '—',
    occupancy_pct: fmtPct(r.occupancy_pct),
    adr_usd: fmt(r.adr_usd, '$'),
    revpar_usd: fmt(r.revpar_usd, '$'),
    revenue_usd: fmt(r.revenue_usd, '$'),
  }));

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        padding: '24px',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      <PageHeader pillar="Revenue" tab="Pulse" title="Pulse" />

      {loading ? (
        <p style={{ color: '#888', marginTop: 32 }}>Loading…</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 16,
              marginTop: 24,
              marginBottom: 32,
            }}
          >
            <KpiBox label="OCC" value={fmtPct(latest?.occupancy_pct)} />
            <KpiBox label="ADR" value={fmt(latest?.adr_usd, '$')} />
            <KpiBox label="RevPAR" value={fmt(latest?.revpar_usd, '$')} />
            <KpiBox label="Revenue" value={fmt(latest?.revenue_usd, '$')} />
            <KpiBox label="Rooms Sold" value={String(latest?.rooms_sold ?? '—')} />
          </div>

          <DataTable columns={columns} rows={tableRows} />
        </>
      )}
    </main>
  );
}
