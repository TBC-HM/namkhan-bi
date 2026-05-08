// app/revenue/compset/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // v_compset_set_summary lives in public schema — service role required
  const { data, error } = await supabase
    .from('v_compset_set_summary')
    .select('*')
    .limit(50);

  const rows = data ?? [];

  // Derive headline KPIs from first row (summary view returns aggregated fields)
  const headline = rows[0] ?? {};
  const compCount: number = typeof headline.property_count === 'number' ? headline.property_count : rows.length;
  const avgRate: string =
    typeof headline.avg_rate === 'number'
      ? `$${(headline.avg_rate as number).toFixed(2)}`
      : typeof headline.avg_competitor_rate === 'number'
      ? `$${(headline.avg_competitor_rate as number).toFixed(2)}`
      : '—';
  const namkhanRate: string =
    typeof headline.namkhan_rate === 'number'
      ? `$${(headline.namkhan_rate as number).toFixed(2)}`
      : typeof headline.our_rate === 'number'
      ? `$${(headline.our_rate as number).toFixed(2)}`
      : '—';
  const priceDelta: string =
    typeof headline.rate_delta === 'number'
      ? (headline.rate_delta >= 0 ? `+$${headline.rate_delta.toFixed(2)}` : `−$${Math.abs(headline.rate_delta).toFixed(2)}`)
      : '—';

  return (
    <main className="p-6 space-y-6">
      <PageHeader pillar="Revenue" tab="Comp Set" title="Comp Set" />

      {error && (
        <p className="text-sm text-red-500">
          Data unavailable: {error.message}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiBox label="Competitors Tracked" value={compCount > 0 ? String(compCount) : '—'} />
        <KpiBox label="Avg Comp Rate" value={avgRate} />
        <KpiBox label="Namkhan Rate" value={namkhanRate} />
        <KpiBox label="Rate Delta vs Comp" value={priceDelta} />
      </div>

      <DataTable
        columns={[
          { key: 'property_name', header: 'Property' },
          { key: 'room_type', header: 'Room Type' },
          { key: 'rate_date', header: 'Date' },
          { key: 'rate', header: 'Rate (USD)' },
          { key: 'source', header: 'Source' },
          { key: 'collected_at', header: 'Collected At' },
        ]}
        rows={rows}
      />
    </main>
  );
}
