'use client';

// app/revenue-v2/parity/page.tsx
// Ticket #107 — wired to public.v_parity_observations_top
// Assumptions:
//   1. View columns: channel, scraped_at, our_rate, comp_rate, delta_pct, status (best-guess from domain)
//   2. View is PostgREST-exposed; fetched client-side via anon key (service-role not available in client component)
//   3. StatusPill accepts `status` prop string; KpiBox accepts `label` + `value` strings
//   4. If view returns zero rows the page renders empty state gracefully

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ParityRow {
  channel?: string;
  scraped_at?: string;
  our_rate?: number | null;
  comp_rate?: number | null;
  delta_pct?: number | null;
  status?: string | null;
  [key: string]: unknown;
}

function fmtUSD(val: number | null | undefined): string {
  if (val == null) return '—';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—';
  const sign = val > 0 ? '+' : val < 0 ? '−' : '';
  return `${sign}${Math.abs(val).toFixed(1)}%`;
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  return val.slice(0, 10); // ISO YYYY-MM-DD
}

export default function ParityPage() {
  const [rows, setRows] = useState<ParityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabase
        .from('v_parity_observations_top')
        .select('*')
        .limit(50);
      if (err) setError(err.message);
      else setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  // KPI summary derived from rows
  const total = rows.length;
  const violations = rows.filter((r) => r.status === 'violation' || (r.delta_pct != null && r.delta_pct > 0)).length;
  const avgDelta =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + (r.delta_pct ?? 0), 0) / rows.length
      : null;
  const channels = new Set(rows.map((r) => r.channel).filter(Boolean)).size;

  const columns = [
    { key: 'channel', header: 'Channel' },
    { key: 'scraped_at', header: 'Scraped At' },
    { key: 'our_rate', header: 'Our Rate' },
    { key: 'comp_rate', header: 'Comp Rate' },
    { key: 'delta_pct', header: 'Δ %' },
    { key: 'status', header: 'Status' },
  ];

  const tableRows = rows.map((r) => ({
    channel: r.channel ?? '—',
    scraped_at: fmtDate(r.scraped_at),
    our_rate: fmtUSD(r.our_rate),
    comp_rate: fmtUSD(r.comp_rate),
    delta_pct: fmtPct(r.delta_pct),
    status: r.status ? <StatusPill status={r.status} /> : '—',
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Revenue" tab="Parity" title="Rate Parity" />

      {loading && (
        <p style={{ color: '#6b7280', marginTop: 16 }}>Loading parity data…</p>
      )}

      {error && (
        <p style={{ color: '#ef4444', marginTop: 16 }}>
          Error loading data: {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginTop: 24,
              marginBottom: 32,
            }}
          >
            <KpiBox label="Observations" value={total > 0 ? String(total) : '—'} />
            <KpiBox label="Violations" value={violations > 0 ? String(violations) : '—'} />
            <KpiBox label="Avg Δ%" value={fmtPct(avgDelta)} />
            <KpiBox label="Channels" value={channels > 0 ? String(channels) : '—'} />
          </div>

          {tableRows.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No parity observations found.</p>
          ) : (
            <DataTable columns={columns} rows={tableRows} />
          )}
        </>
      )}
    </main>
  );
}
