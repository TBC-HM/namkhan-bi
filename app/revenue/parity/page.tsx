// app/revenue/parity/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ParityRow {
  channel?: string | null;
  check_date?: string | null;
  our_rate?: number | null;
  competitor_rate?: number | null;
  parity_gap?: number | null;
  parity_status?: string | null;
  room_type?: string | null;
  los?: number | null;
  stay_date?: string | null;
  [key: string]: unknown;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_parity_observations_top')
    .select('*')
    .limit(100);

  const rows: ParityRow[] = data ?? [];

  // ── Derived KPIs ─────────────────────────────────────────────────────────
  const totalObs = rows.length;

  const withGap = rows.filter(
    (r) => r.parity_gap !== null && r.parity_gap !== undefined,
  );
  const avgGap =
    withGap.length > 0
      ? withGap.reduce((sum, r) => sum + (r.parity_gap as number), 0) /
        withGap.length
      : null;

  const parityBreaches = rows.filter(
    (r) =>
      r.parity_status != null &&
      String(r.parity_status).toLowerCase() !== 'parity',
  ).length;

  const parityPct =
    totalObs > 0
      ? (((totalObs - parityBreaches) / totalObs) * 100).toFixed(1) + '%'
      : '—';

  const formatGap = (v: number | null) => {
    if (v === null || v === undefined) return '—';
    const prefix = v > 0 ? '+$' : v < 0 ? '−$' : '$';
    return `${prefix}${Math.abs(v).toFixed(0)}`;
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    { key: 'stay_date', header: 'Stay Date' },
    { key: 'channel', header: 'Channel' },
    { key: 'room_type', header: 'Room Type' },
    { key: 'our_rate', header: 'Our Rate' },
    { key: 'competitor_rate', header: 'Comp Rate' },
    { key: 'parity_gap', header: 'Gap' },
    { key: 'parity_status', header: 'Status' },
    { key: 'check_date', header: 'Checked' },
  ];

  // ── Normalise rows for display ────────────────────────────────────────────
  const displayRows = rows.map((r) => ({
    ...r,
    stay_date: r.stay_date ?? '—',
    channel: r.channel ?? '—',
    room_type: r.room_type ?? '—',
    our_rate: r.our_rate != null ? `$${Number(r.our_rate).toFixed(0)}` : '—',
    competitor_rate:
      r.competitor_rate != null
        ? `$${Number(r.competitor_rate).toFixed(0)}`
        : '—',
    parity_gap: formatGap(r.parity_gap as number | null),
    parity_status: r.parity_status ?? '—',
    check_date: r.check_date ?? '—',
  }));

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Parity" title="Rate Parity Observations" />

      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Observations"
          value={totalObs > 0 ? String(totalObs) : '—'}
        />
        <KpiBox
          label="In-Parity"
          value={parityPct}
        />
        <KpiBox
          label="Breaches"
          value={parityBreaches > 0 ? String(parityBreaches) : '0'}
        />
        <KpiBox
          label="Avg Gap"
          value={avgGap !== null ? formatGap(avgGap) : '—'}
        />
      </div>

      {/* Error / Empty state */}
      {error && (
        <p
          style={{
            color: '#b91c1c',
            background: '#fee2e2',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          ⚠️ Data unavailable: {error.message}
        </p>
      )}

      {rows.length === 0 && !error && (
        <p
          style={{
            color: '#6b7280',
            padding: '32px 0',
            textAlign: 'center',
            fontSize: 14,
          }}
        >
          No parity observations found. Check back after the next data refresh.
        </p>
      )}

      {/* Main table */}
      {displayRows.length > 0 && (
        <DataTable columns={columns} rows={displayRows} />
      )}
    </main>
  );
}
