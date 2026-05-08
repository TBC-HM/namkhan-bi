'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

interface PricingRow {
  date?: string;
  room_type?: string;
  bar_rate?: number | null;
  bar_rate_lak?: number | null;
  occupancy_pct?: number | null;
  channel?: string;
  status?: string;
  [key: string]: unknown;
}

export default function PricingPage() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/revenue/pricing')
      .then((r) => r.json())
      .then((d) => {
        setRows(Array.isArray(d) ? d : (d?.data ?? []));
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const avgBar = rows.length
    ? rows.reduce((s, r) => s + (r.bar_rate ?? 0), 0) / rows.length
    : null;

  const avgOcc = rows.length
    ? rows.reduce((s, r) => s + (r.occupancy_pct ?? 0), 0) / rows.length
    : null;

  const activeRooms = rows.filter(
    (r) => r.status === 'open' || r.status === 'active'
  ).length;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        padding: '24px',
      }}
    >
      <PageHeader pillar="Revenue" tab="Pricing" title="Pricing" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Avg BAR (USD)"
          value={avgBar != null ? `$${avgBar.toFixed(2)}` : '—'}
        />
        <KpiBox
          label="Avg Occupancy"
          value={avgOcc != null ? `${avgOcc.toFixed(1)}%` : '—'}
        />
        <KpiBox
          label="Open Rate Rows"
          value={loading ? '…' : String(activeRooms)}
        />
        <KpiBox
          label="Total Rows"
          value={loading ? '…' : String(rows.length)}
        />
      </div>

      <DataTable
        columns={[
          { key: 'date', header: 'Date' },
          { key: 'room_type', header: 'Room Type' },
          { key: 'bar_rate', header: 'BAR (USD)' },
          { key: 'bar_rate_lak', header: 'BAR (₭)' },
          { key: 'occupancy_pct', header: 'Occ %' },
          { key: 'channel', header: 'Channel' },
          { key: 'status', header: 'Status' },
        ]}
        rows={rows.map((r) => ({
          ...r,
          date: r.date ?? '—',
          room_type: r.room_type ?? '—',
          bar_rate: r.bar_rate != null ? `$${Number(r.bar_rate).toFixed(2)}` : '—',
          bar_rate_lak:
            r.bar_rate_lak != null
              ? `₭${Number(r.bar_rate_lak).toLocaleString()}`
              : '—',
          occupancy_pct:
            r.occupancy_pct != null ? `${Number(r.occupancy_pct).toFixed(1)}%` : '—',
          channel: r.channel ?? '—',
          status: r.status ?? '—',
        }))}
      />
    </main>
  );
}
