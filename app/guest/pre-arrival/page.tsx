'use client';

// app/guest/pre-arrival/page.tsx
import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';

interface PreArrivalRow {
  reservation_id?: string;
  guest_name?: string;
  arrival_date?: string;
  room_type?: string;
  nights?: number;
  source?: string;
  status?: string;
  special_requests?: string;
  nationality?: string;
  adults?: number;
  children?: number;
  estimated_revenue?: number | null;
}

export default function GuestPreArrivalPage() {
  const [rows, setRows] = useState<PreArrivalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/guest/pre-arrival')
      .then((r) => r.json())
      .then((d: { data?: PreArrivalRow[] }) => {
        setRows(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const arriving48h = rows.filter((r) => {
    if (!r.arrival_date) return false;
    const diff =
      (new Date(r.arrival_date).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 2;
  }).length;
  const totalExpected = rows.length;
  const withRequests = rows.filter(
    (r) => r.special_requests && r.special_requests.trim() !== ''
  ).length;
  const totalRevenue = rows.reduce(
    (acc, r) => acc + (r.estimated_revenue ?? 0),
    0
  );

  const columns = [
    { key: 'arrival_date', header: 'Arrival' },
    { key: 'guest_name', header: 'Guest' },
    { key: 'room_type', header: 'Room Type' },
    { key: 'nights', header: 'Nights' },
    { key: 'adults', header: 'Adults' },
    { key: 'children', header: 'Children' },
    { key: 'source', header: 'Source' },
    { key: 'nationality', header: 'Nationality' },
    { key: 'special_requests', header: 'Requests' },
    { key: 'status', header: 'Status' },
    { key: 'estimated_revenue', header: 'Est. Revenue' },
  ];

  const tableRows = rows.map((r) => ({
    ...r,
    arrival_date: r.arrival_date ?? '—',
    guest_name: r.guest_name ?? '—',
    room_type: r.room_type ?? '—',
    nights: r.nights ?? '—',
    adults: r.adults ?? '—',
    children: r.children ?? '—',
    source: r.source ?? '—',
    nationality: r.nationality ?? '—',
    special_requests: r.special_requests ?? '—',
    estimated_revenue:
      r.estimated_revenue != null
        ? `$${Number(r.estimated_revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        : '—',
    status: r.status ?? '—',
  }));

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        padding: '24px',
      }}
    >
      <PageHeader pillar="Guest" tab="Pre-Arrival" title="Pre-Arrival" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox
          label="Expected Arrivals"
          value={loading ? '…' : String(totalExpected)}
        />
        <KpiBox
          label="Arriving in 48 h"
          value={loading ? '…' : String(arriving48h)}
        />
        <KpiBox
          label="Special Requests"
          value={loading ? '…' : String(withRequests)}
        />
        <KpiBox
          label="Est. Revenue"
          value={
            loading
              ? '…'
              : `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          }
        />
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>Loading pre-arrival data…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#888' }}>No upcoming arrivals found.</p>
      ) : (
        <DataTable columns={columns} rows={tableRows} />
      )}
    </main>
  );
}
