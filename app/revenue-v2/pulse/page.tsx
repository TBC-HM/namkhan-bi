// app/revenue-v2/pulse/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface KpiSnapshot {
  id: string;
  metric_key: string;
  metric_value: number | null;
  currency: string | null;
  period_label: string | null;
  stly_value: number | null;
  recorded_at: string;
}

function formatValue(row: KpiSnapshot): string {
  if (row.metric_value === null || row.metric_value === undefined) return '—';
  const v = row.metric_value;
  if (row.metric_key === 'occupancy_pct') return `${v.toFixed(1)}%`;
  if (row.currency === 'USD') return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (row.currency === 'LAK') return `₭${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return v.toLocaleString('en-US');
}

function formatChange(row: KpiSnapshot): string {
  if (row.metric_value === null || row.stly_value === null || row.stly_value === 0) return '—';
  const pct = ((row.metric_value - row.stly_value) / Math.abs(row.stly_value)) * 100;
  const sign = pct >= 0 ? '+' : '−';
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

const KEY_ORDER = ['occupancy_pct', 'adr', 'revpar', 'rooms_sold', 'total_revenue'];

const LABEL_MAP: Record<string, string> = {
  occupancy_pct: 'Occupancy',
  adr: 'ADR',
  revpar: 'RevPAR',
  rooms_sold: 'Rooms Sold',
  total_revenue: 'Total Revenue',
};

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Pull latest snapshot per metric key
  const { data, error } = await supabase
    .from('cockpit_kpi_snapshots')
    .select('id, metric_key, metric_value, currency, period_label, stly_value, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[pulse] kpi_snapshots fetch error:', error.message);
  }

  const rows: KpiSnapshot[] = data ?? [];

  // Deduplicate: keep the latest snapshot per metric_key
  const latest = new Map<string, KpiSnapshot>();
  for (const row of rows) {
    if (!latest.has(row.metric_key)) {
      latest.set(row.metric_key, row);
    }
  }

  // Ordered KPI tiles (known keys first, then any extras)
  const orderedKeys = [
    ...KEY_ORDER.filter((k) => latest.has(k)),
    ...[...latest.keys()].filter((k) => !KEY_ORDER.includes(k)),
  ];

  // Table rows — all snapshots for trend view
  const tableRows = rows.map((r) => ({
    ...r,
    recorded_at_fmt: r.recorded_at ? r.recorded_at.slice(0, 10) : '—',
    value_fmt: formatValue(r),
    change_vs_stly: formatChange(r),
    label: LABEL_MAP[r.metric_key] ?? r.metric_key,
  }));

  return (
    <main className="p-6 space-y-6">
      <PageHeader pillar="Revenue" tab="Pulse" title="Revenue Pulse" />

      {/* KPI tile grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        {orderedKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full">No KPI data available.</p>
        ) : (
          orderedKeys.map((key) => {
            const row = latest.get(key)!;
            return (
              <KpiBox
                key={key}
                label={LABEL_MAP[key] ?? key}
                value={formatValue(row)}
                subLabel={row.period_label ?? undefined}
                delta={formatChange(row)}
              />
            );
          })
        )}
      </div>

      {/* Historical snapshots table */}
      <DataTable
        columns={[
          { key: 'recorded_at_fmt', header: 'Date' },
          { key: 'label', header: 'Metric' },
          { key: 'value_fmt', header: 'Value' },
          { key: 'change_vs_stly', header: 'vs STLY' },
          { key: 'period_label', header: 'Period' },
        ]}
        rows={tableRows}
      />
    </main>
  );
}
