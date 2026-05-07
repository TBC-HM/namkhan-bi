// app/revenue-v2/parity/page.tsx
// Ticket #107 — wired to public.v_parity_observations_top (server component)
// Fix re: PBS comment on PR #58 + Vercel ERROR
// Root cause: JSX malformed in previous commit; rewritten clean.
// Assumptions:
//   1. View columns: channel, platform, our_rate, comp_rate, delta, delta_pct, parity_status, check_date, room_type
//   2. Service role key used server-side only
//   3. parity_status === 'at parity' (case-insensitive) = healthy; anything else = breach
//   4. Rates are USD (int/float), $ prefix applied
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
  if (val == null) return '\u2014';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '\u2014';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

function fmtDelta(val: number | null | undefined): string {
  if (val == null) return '\u2014';
  if (val < 0) return `\u2212$${Math.abs(val).toFixed(2)}`;
  if (val > 0) return `+$${val.toFixed(2)}`;
  return '$0.00';
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '\u2014';
  return val.slice(0, 10);
}

export default async function Page() {
  // createClient inside function — avoids build-time env-var errors
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
  const atParity = total - breaches;
  const parityRate = total > 0 ? `${(((total - breaches) / total) * 100).toFixed(1)}%` : '\u2014';
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
    channel: r.channel ?? '\u2014',
    platform: r.platform ?? '\u2014',
    room_type: r.room_type ?? '\u2014',
    our_rate: fmtUSD(r.our_rate),
    comp_rate: fmtUSD(r.comp_rate),
    delta: fmtDelta(r.delta),
    delta_pct: fmtPct(r.delta_pct),
    parity_status: r.parity_status ?? '\u2014',
  }));

  return (
    <main style={{ padding: '24px', background: '#000', minHeight: '100vh', color: '#fff' }}>
      <PageHeader pillar="Revenue" tab="Parity" title="Rate Parity" />

      {error && (
        <div
          role="alert"
          style={{
            background: '#2d0000',
            border: '1px solid #ff4444',
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 24,
            color: '#ff8888',
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
        <KpiBox label="Observations" value={total > 0 ? String(total) : '\u2014'} />
        <KpiBox label="Parity Rate" value={parityRate} />
        <KpiBox label="Breaches" value={total > 0 ? String(breaches) : '0'} />
        <KpiBox label="Avg \u0394 Rate" value={avgDelta} />
      </div>

      {/* Status summary pill */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <StatusPill
          status={breaches > 0 ? 'error' : 'ok'}
          label={`${breaches} breach${breaches !== 1 ? 'es' : ''}`}
        />
        <StatusPill
          status="ok"
          label={`${atParity} at parity`}
        />
      </div>

      {/* Observations table */}
      {rows.length === 0 && !error ? (
        <p style={{ color: '#888', marginTop: 32 }}>No parity observations found.</p>
      ) : (
        <DataTable columns={columns} rows={tableRows} />
      )}
    </main>
  );
}
