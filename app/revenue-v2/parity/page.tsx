// app/revenue-v2/parity/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types inferred from view name: v_parity_observations_top
// Adjust column names if DB schema differs — all cells fall back to '—'
// ---------------------------------------------------------------------------
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
  nights?: number | null;
}

function fmtUSD(val: number | null | undefined): string {
  if (val == null) return '—';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDelta(val: number | null | undefined): string {
  if (val == null) return '—';
  if (val === 0) return '$0';
  const sign = val > 0 ? '+' : '−';
  return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—';
  const sign = val > 0 ? '+' : val < 0 ? '−' : '';
  return `${sign}${Math.abs(val).toFixed(1)}%`;
}

export default async function ParityPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_parity_observations_top')
    .select('*')
    .limit(50);

  const rows: ParityRow[] = data ?? [];

  // ── KPI aggregates ─────────────────────────────────────────────────────────
  const total = rows.length;
  const atParity = rows.filter(
    (r) => (r.parity_status ?? '').toLowerCase() === 'at parity'
  ).length;
  const breachCount = total - atParity;
  const parityRate = total > 0 ? Math.round((atParity / total) * 100) : null;

  const avgDelta =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + (r.delta ?? 0), 0) / rows.length
      : null;

  // ── DataTable columns ──────────────────────────────────────────────────────
  const columns = [
    { key: 'check_date', header: 'Date' },
    { key: 'platform', header: 'Platform' },
    { key: 'channel', header: 'Channel' },
    { key: 'room_type', header: 'Room Type' },
    { key: 'our_rate', header: 'Our Rate' },
    { key: 'comp_rate', header: 'Comp Rate' },
    { key: 'delta', header: 'Delta' },
    { key: 'delta_pct', header: 'Δ %' },
    { key: 'parity_status', header: 'Status' },
  ];

  // Transform rows for display
  const tableRows = rows.map((r, i) => ({
    _key: i,
    check_date: r.check_date ?? '—',
    platform: r.platform ?? '—',
    channel: r.channel ?? '—',
    room_type: r.room_type ?? '—',
    our_rate: fmtUSD(r.our_rate),
    comp_rate: fmtUSD(r.comp_rate),
    delta: fmtDelta(r.delta),
    delta_pct: fmtPct(r.delta_pct),
    parity_status: r.parity_status ?? '—',
  }));

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Parity" title="Rate Parity" />

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 16px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 6,
            fontSize: 13,
            color: '#856404',
          }}
        >
          ⚠ Data load error: {error.message}
        </div>
      )}

      {/* ── KPI row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiBox
          label="Observations"
          value={total > 0 ? String(total) : '—'}
        />
        <KpiBox
          label="Parity Rate"
          value={parityRate != null ? `${parityRate}%` : '—'}
        />
        <KpiBox
          label="Breaches"
          value={breachCount > 0 ? String(breachCount) : '—'}
        />
        <KpiBox
          label="Avg Delta"
          value={avgDelta != null ? fmtDelta(Math.round(avgDelta)) : '—'}
        />
      </div>

      {/* ── Breach-status summary pills ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatusPill label={`At Parity: ${atParity}`} status="ok" />
        <StatusPill label={`Breaches: ${breachCount}`} status={breachCount > 0 ? 'warn' : 'ok'} />
      </div>

      {/* ── Main table ── */}
      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
