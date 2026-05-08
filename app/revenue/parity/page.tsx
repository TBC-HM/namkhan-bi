'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';

interface ParityRow {
  channel?: string;
  platform?: string;
  our_rate?: number | null;
  comp_rate?: number | null;
  parity_status?: string | null;
  variance_pct?: number | null;
  date?: string | null;
  room_type?: string | null;
}

export default function ParityPage() {
  const [rows, setRows] = useState<ParityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/v_parity_summary?select=*&limit=100`;
    void fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
      },
    })
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalChannels = rows.length;
  const parityOk = rows.filter(
    (r) =>
      (r.parity_status ?? '').toLowerCase() === 'ok' ||
      (r.parity_status ?? '').toLowerCase() === 'parity'
  ).length;
  const parityBreaches = rows.filter(
    (r) =>
      (r.parity_status ?? '').toLowerCase() === 'breach' ||
      (r.parity_status ?? '').toLowerCase() === 'below'
  ).length;
  const avgVariance =
    rows.length > 0
      ? (rows.reduce((sum, r) => sum + (r.variance_pct ?? 0), 0) / rows.length).toFixed(1)
      : null;

  const columns = [
    { key: 'channel', header: 'Channel' },
    { key: 'platform', header: 'Platform' },
    { key: 'room_type', header: 'Room Type' },
    { key: 'date', header: 'Date' },
    { key: 'our_rate', header: 'Our Rate' },
    { key: 'comp_rate', header: 'Comp Rate' },
    { key: 'variance_pct', header: 'Variance %' },
    { key: 'parity_status', header: 'Status' },
  ];

  const displayRows = rows.map((r) => ({
    channel: r.channel ?? '\u2014',
    platform: r.platform ?? '\u2014',
    room_type: r.room_type ?? '\u2014',
    date: r.date ?? '\u2014',
    our_rate: r.our_rate != null ? `$${r.our_rate.toFixed(2)}` : '\u2014',
    comp_rate: r.comp_rate != null ? `$${r.comp_rate.toFixed(2)}` : '\u2014',
    variance_pct:
      r.variance_pct != null
        ? `${r.variance_pct >= 0 ? '+' : '\u2212'}${Math.abs(r.variance_pct).toFixed(1)}%`
        : '\u2014',
    parity_status: r.parity_status ?? '\u2014',
  }));

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '24px' }}>
      <PageHeader pillar="Revenue" tab="Parity" title="Rate Parity" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Channels Monitored" value={loading ? '...' : String(totalChannels)} />
        <KpiBox label="Parity OK" value={loading ? '...' : String(parityOk)} />
        <KpiBox label="Parity Breaches" value={loading ? '...' : String(parityBreaches)} />
        <KpiBox
          label="Avg Variance"
          value={loading ? '...' : avgVariance != null ? `${avgVariance}%` : '\u2014'}
        />
      </div>

      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {parityOk > 0 && <StatusPill status="success" label={`${parityOk} in parity`} />}
          {parityBreaches > 0 && (
            <StatusPill
              status="error"
              label={`${parityBreaches} breach${parityBreaches !== 1 ? 'es' : ''}`}
            />
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#888', textAlign: 'center', marginTop: 64 }}>Loading parity data...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#888', textAlign: 'center', marginTop: 64 }}>
          No parity data available — view may not exist yet.
        </p>
      ) : (
        <DataTable columns={columns} rows={displayRows} />
      )}
    </main>
  );
}
