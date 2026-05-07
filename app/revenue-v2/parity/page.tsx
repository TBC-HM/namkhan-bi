// app/revenue-v2/parity/page.tsx
// Ticket #107 — wired to public.v_parity_observations_top (server component)
// Assumptions:
//   1. View columns: channel, platform, our_rate, comp_rate, delta, delta_pct, parity_status, check_date, room_type
//   2. Service role key used server-side
//   3. parity_status === 'at parity' (case-insensitive) = healthy; anything else = breach
//   4. Rates are USD (integer or float), $ prefix applied
//   5. delta = our_rate − comp_rate; positive = we are higher

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ParityRow {
  channel?: string | null;
  platform?: string | null;
  our_rate?: number | null;
  comp_rate?: number | null;
  delta?: number | null;
  delta_pct?: number | null;
  parity_status?: string | null;
  check_date?: string | null;
  room_type?: string | null;
  [key: string]: unknown;
}

function fmtUSD(val: number | null | undefined): string {
  if (val == null) return '—';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

function fmtDelta(val: number | null | undefined): string {
  if (val == null) return '—';
  if (val < 0) return `\u2212$${Math.abs(val).toFixed(2)}`;
  if (val > 0) return `+$${val.toFixed(2)}`;
  return '$0.00';
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  return val.slice(0, 10);
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_parity_observations_top')
    .select('*')
    .limit(50);

  const rows: ParityRow[] = data ?? [];

  // KPI derivations
  const total = rows.length;
  const breaches = rows.filter(
    (r) => r.parity_status != null && r.parity_status.toLowerCase() !== 'at parity'
  ).length;
  const parityRate =
    total > 0 ? (((total - breaches) / total) * 100).toFixed(1) + '%' : '—';
  const avgDeltaRaw =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + (r.delta ?? 0), 0) / rows.length
      : null;
  const avgDelta = fmtDelta(avgDeltaRaw);

  const columns = [
    { key: 'check_date', header: 'Date' },
    { key: 'channel', header: 'Channel' },
    { key: 'platform', header: 'Platform' },
    { key: 'room_type', header: 'Room Type' },
    { key: 'our_rate', header: 'Our Rate' },
    { key: 'comp_rate', header: 'Comp Rate' },
    { key: 'delta', header: '\u0394 Rate' },
    { key: 'delta_pct', header: '\u0394 %' },
    { key: 'parity_status', header: 'Status' },
  ];

  const tableRows = rows.map((r) => ({
    check_date: fmtDate(r.check_date),
    channel: r.channel ?? '—',
    platform: r.platform ?? '—',
    room_type: r.room_type ?? '—',
    our_rate: fmtUSD(r.our_rate),
    comp_rate: fmtUSD(r.comp_rate),
    delta: fmtDelta(r.delta),
    delta_pct: fmtPct(r.delta_pct),
    parity_status: r.parity_status ?? '—',
  }));

  return (
    <main style={{ padding: '24px' }}>
      <PageHeader pillar="Revenue" tab="Parity" title="Rate Parity" />

      {error && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #f87171',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            color: '#991b1b',
          }}
        >
          Error loading parity data: {error.message}
        </div>
      )}

      {/* KPI tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Observations" value={total > 0 ? String(total) : '—'} />
        <KpiBox label="Parity Rate" value={parityRate} />
        <KpiBox label="Breaches" value={breaches > 0 ? String(breaches) : '0'} />
        <KpiBox label="Avg Delta" value={avgDelta} />
      </div>

      {/* Status summary pill */}
      <div style={{ marginBottom: 24 }}>
        <StatusPill
          status={breaches > 0 ? 'error' : 'ok'}
          label={`${breaches} breach${breaches !== 1 ? 'es' : ''}`}
        />
      </div>

      {/* Observations table */}
      {rows.length === 0 && !error ? (
        <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
          No parity observations found.
        </p>
      ) : (
        <DataTable columns={columns} rows={tableRows} />
      )}
    </main>
  );
}
