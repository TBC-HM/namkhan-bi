import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import DeptDropdown from '@/components/nav/DeptDropdown';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function FinancePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await supabase
    .from('v_overview_kpis')
    .select('*')
    .limit(30);
  const rows = data ?? [];
  const top = rows[0] ?? {};

  return (
    <main style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <PageHeader pillar="Finance" tab="Overview" title="Finance Overview" lede="Revenue, cost, and P&amp;L signals across all departments." />
        <DeptDropdown />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiBox label="Occupancy" value={top.occupancy_pct != null ? `${top.occupancy_pct}%` : '—'} />
        <KpiBox label="ADR"       value={top.adr    != null ? `$${top.adr}`    : '—'} />
        <KpiBox label="RevPAR"    value={top.revpar != null ? `$${top.revpar}` : '—'} />
        <KpiBox label="Rooms Sold" value={top.rooms_sold ?? '—'} />
      </div>

      <DataTable
        columns={[
          { key: 'date',          header: 'Date' },
          { key: 'occupancy_pct', header: 'OCC %' },
          { key: 'adr',           header: 'ADR' },
          { key: 'revpar',        header: 'RevPAR' },
          { key: 'rooms_sold',    header: 'Rooms Sold' },
        ]}
        rows={rows}
      />
    </main>
  );
}
