// app/revenue-v2/parity/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ParityRow {
  channel: string;
  platform: string;
  check_date: string;
  our_rate: number | null;
  ota_rate: number | null;
  parity_gap: number | null;
  parity_status: string | null;
  room_type: string | null;
  currency: string | null;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('v_parity_observations_top')
    .select('*')
    .limit(50);

  const rows: ParityRow[] = data ?? [];

  // Derive KPI summaries from rows
  const totalChecks = rows.length;
  const parityBreaches = rows.filter(
    (r) => r.parity_status && r.parity_status.toLowerCase() !== 'parity'
  ).length;
  const parityRate =
    totalChecks > 0
      ? Math.round(((totalChecks - parityBreaches) / totalChecks) * 1000) / 10
      : null;
  const avgGap =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + (r.parity_gap ?? 0), 0) / rows.length
      : null;

  const columns = [
    {
      key: 'check_date',
      header: 'Date',
      align: 'left' as const,
      render: (r: ParityRow) => r.check_date ?? '—',
      sortValue: (r: ParityRow) => r.check_date ?? '',
    },
    {
      key: 'platform',
      header: 'Platform',
      align: 'left' as const,
      render: (r: ParityRow) => r.platform ?? '—',
      sortValue: (r: ParityRow) => r.platform ?? '',
    },
    {
      key: 'room_type',
      header: 'Room Type',
      align: 'left' as const,
      render: (r: ParityRow) => r.room_type ?? '—',
    },
    {
      key: 'our_rate',
      header: 'Our Rate',
      align: 'right' as const,
      numeric: true,
      render: (r: ParityRow) =>
        r.our_rate != null
          ? `${r.currency === 'LAK' ? '₭' : '$'}${r.our_rate.toLocaleString()}`
          : '—',
      sortValue: (r: ParityRow) => r.our_rate ?? 0,
    },
    {
      key: 'ota_rate',
      header: 'OTA Rate',
      align: 'right' as const,
      numeric: true,
      render: (r: ParityRow) =>
        r.ota_rate != null
          ? `${r.currency === 'LAK' ? '₭' : '$'}${r.ota_rate.toLocaleString()}`
          : '—',
      sortValue: (r: ParityRow) => r.ota_rate ?? 0,
    },
    {
      key: 'parity_gap',
      header: 'Gap',
      align: 'right' as const,
      numeric: true,
      render: (r: ParityRow) => {
        if (r.parity_gap == null) return '—';
        const sign = r.parity_gap < 0 ? '−' : '+';
        return `${sign}${Math.abs(r.parity_gap).toLocaleString()}`;
      },
      sortValue: (r: ParityRow) => r.parity_gap ?? 0,
    },
    {
      key: 'parity_status',
      header: 'Status',
      align: 'center' as const,
      render: (r: ParityRow) => {
        const s = r.parity_status ?? '—';
        const isOk =
          s.toLowerCase() === 'parity' || s.toLowerCase() === 'ok';
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              background: isOk ? '#d1fae5' : '#fee2e2',
              color: isOk ? '#065f46' : '#991b1b',
            }}
          >
            {s.toUpperCase()}
          </span>
        );
      },
    },
  ];

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader
        pillar="Revenue"
        tab="Parity"
        title="Rate Parity"
        lede="Live OTA rate parity observations — top breaches and recent checks."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          margin: '24px 0',
        }}
      >
        <KpiBox
          label="Total Checks"
          value={totalChecks}
          unit="nights"
          dp={0}
          tooltip="Number of parity observations loaded"
        />
        <KpiBox
          label="Parity Breaches"
          value={parityBreaches}
          unit="nights"
          dp={0}
          tooltip="Observations where OTA rate differs from our rate"
        />
        <KpiBox
          label="Parity Rate"
          value={parityRate}
          unit="pct"
          dp={1}
          tooltip="% of checks where rates are in parity"
        />
        <KpiBox
          label="Avg Gap"
          value={avgGap}
          unit="usd"
          dp={0}
          tooltip="Average rate gap across all observations"
        />
      </div>

      <DataTable<ParityRow>
        columns={columns}
        rows={rows}
        rowKey={(r, i) => `${r.platform}-${r.check_date}-${i}`}
        defaultSort={{ key: 'parity_gap', dir: 'desc' }}
        rowClassName={(r) =>
          r.parity_status && r.parity_status.toLowerCase() !== 'parity'
            ? 'parity-breach-row'
            : undefined
        }
        emptyState="No parity observations found."
      />
    </main>
  );
}
