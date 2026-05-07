import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import DeptDropdown from '@/components/nav/DeptDropdown';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function OperationsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await supabase
    .from('v_dq_open')
    .select('*')
    .limit(30);
  const rows = data ?? [];

  return (
    <main style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <PageHeader pillar="Operations" tab="Overview" title="Operations Overview" lede="Open data-quality issues, maintenance flags, and daily ops pulse." />
        <DeptDropdown />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiBox label="Open Issues" value={rows.length} />
        <KpiBox label="Oldest Issue" value={rows[0]?.created_at?.slice(0, 10) ?? '—'} />
        <KpiBox label="Top Rule" value={rows[0]?.rule_name ?? '—'} />
        <KpiBox label="Severity" value={rows[0]?.severity ?? '—'} />
      </div>

      <DataTable
        columns={[
          { key: 'rule_name',  header: 'Rule' },
          { key: 'severity',   header: 'Severity' },
          { key: 'table_name', header: 'Table' },
          { key: 'detail',     header: 'Detail' },
          { key: 'created_at', header: 'Opened' },
        ]}
        rows={rows}
      />
    </main>
  );
}
