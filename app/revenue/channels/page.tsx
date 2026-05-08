'use client';

import { useEffect, useState } from 'react';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

// NOTE: mv_channel_economics is not in the PostgREST allowlist, so we fetch
// via a dedicated API route that uses the service-role key server-side.
// Assumption: /api/revenue/channels returns { rows: ChannelRow[] }.
// Fallback: renders em-dash placeholders if API is unavailable.

interface ChannelRow {
  channel: string;
  channel_group?: string;
  room_nights?: number;
  revenue_usd?: number;
  adr_usd?: number;
  occupancy_pct?: number;
  commission_pct?: number;
  net_revenue_usd?: number;
  contribution_pct?: number;
  reservations?: number;
}

type Column<T> = {
  key: string;
  header: string;
  numeric?: boolean;
  render?: (row: T) => React.ReactNode;
};

const fmt = (v: number | undefined | null, prefix = '', decimals = 0): string =>
  v == null ? '—' : `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const fmtPct = (v: number | undefined | null): string =>
  v == null ? '—' : `${v.toFixed(1)}%`;

const columns: Column<ChannelRow>[] = [
  { key: 'channel',          header: 'CHANNEL',         render: r => r.channel ?? '—' },
  { key: 'channel_group',    header: 'GROUP',            render: r => r.channel_group ?? '—' },
  { key: 'reservations',     header: 'RESERVATIONS',     numeric: true, render: r => fmt(r.reservations) },
  { key: 'room_nights',      header: 'ROOM NIGHTS',      numeric: true, render: r => fmt(r.room_nights) },
  { key: 'revenue_usd',      header: 'REVENUE',          numeric: true, render: r => fmt(r.revenue_usd, '$') },
  { key: 'adr_usd',          header: 'ADR',              numeric: true, render: r => fmt(r.adr_usd, '$', 2) },
  { key: 'commission_pct',   header: 'COMMISSION',       numeric: true, render: r => fmtPct(r.commission_pct) },
  { key: 'net_revenue_usd',  header: 'NET REVENUE',      numeric: true, render: r => fmt(r.net_revenue_usd, '$') },
  { key: 'contribution_pct', header: 'CONTRIBUTION %',   numeric: true, render: r => fmtPct(r.contribution_pct) },
];

export default function ChannelsPage() {
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/revenue/channels')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ rows: ChannelRow[] }>;
      })
      .then(data => {
        setRows(data.rows ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      });
  }, []);

  // Aggregate KPIs from rows
  const totalRevenue   = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const totalNights    = rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const totalNet       = rows.reduce((s, r) => s + (r.net_revenue_usd ?? 0), 0);
  const avgAdr         = totalNights > 0
    ? rows.reduce((s, r) => s + (r.adr_usd ?? 0) * (r.room_nights ?? 0), 0) / totalNights
    : null;
  const topChannel     = rows.length > 0
    ? rows.reduce((best, r) => (r.revenue_usd ?? 0) > (best.revenue_usd ?? 0) ? r : best, rows[0])
    : null;

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader
        pillar="Revenue"
        tab="Channels"
        title="Channel Economics"
        lede="Revenue, ADR, and net contribution by booking channel."
      />

      {error && (
        <div style={{ color: 'var(--red, #c0392b)', marginBottom: 16, fontSize: 13 }}>
          ⚠ Data unavailable: {error}. Check /api/revenue/channels route.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiBox
          label="Total Revenue"
          value={loading ? '…' : totalRevenue > 0 ? `$${totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
          unit="usd"
          tooltip="Sum of gross revenue across all channels · mv_channel_economics"
        />
        <KpiBox
          label="Avg ADR"
          value={loading ? '…' : avgAdr != null ? `$${avgAdr.toFixed(2)}` : '—'}
          unit="usd"
          tooltip="Weighted average daily rate across channels · mv_channel_economics"
        />
        <KpiBox
          label="Net Revenue"
          value={loading ? '…' : totalNet > 0 ? `$${totalNet.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
          unit="usd"
          tooltip="Gross revenue minus commissions · mv_channel_economics"
        />
        <KpiBox
          label="Top Channel"
          value={loading ? '…' : topChannel?.channel ?? '—'}
          unit="text"
          tooltip="Channel generating highest gross revenue · mv_channel_economics"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r: ChannelRow) => r.channel}
        emptyState={loading ? 'Loading channel data…' : 'No channel data available.'}
      />
    </main>
  );
}
