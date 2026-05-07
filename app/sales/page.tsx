import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import DeptDropdown from '@/components/nav/DeptDropdown';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function SalesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await supabase
    .from('v_compset_set_summary')
    .select('*')
    .limit(30);
  const rows = data ?? [];
  const top = rows[0] ?? {};

  return (
    <main style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <PageHeader pillar="Sales" tab="Overview" title="Sales Overview" lede="Inquiries, conversions, and comp-set positioning." />
        <DeptDropdown />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiBox label="Property" value={top.property_name ?? '—'} />
        <KpiBox label="Our Rate" value={top.our_rate != null ? `$${top.our_rate}` : '—'} />
        <KpiBox label="Comp Avg" value={top.comp_avg != null ? `$${top.comp_avg}` : '—'} />
        <KpiBox label="Index" value={top.rate_index ?? '—'} />
      </div>

      <DataTable
        columns={[
          { key: 'property_name', header: 'Property' },
          { key: 'our_rate',      header: 'Our Rate' },
          { key: 'comp_avg',      header: 'Comp Avg' },
          { key: 'rate_index',    header: 'Index' },
          { key: 'scraped_at',    header: 'Scraped At' },
        ]}
        rows={rows}
      />
    </main>
  );
}
