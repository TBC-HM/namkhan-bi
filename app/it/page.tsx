import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import DeptDropdown from '@/components/nav/DeptDropdown';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function ITPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await supabase
    .from('cockpit_tickets')
    .select('id, arm, status, parsed_summary, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(30);
  const rows = data ?? [];

  const open   = rows.filter((r) => r.status !== 'completed').length;
  const closed = rows.filter((r) => r.status === 'completed').length;
  const arms   = [...new Set(rows.map((r) => r.arm))].join(', ') || '—';

  return (
    <main style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <PageHeader pillar="IT" tab="Overview" title="IT Overview" lede="Cockpit tickets, incidents, and system health at a glance." />
        <DeptDropdown />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiBox label="Open Tickets"   value={open} />
        <KpiBox label="Closed Tickets" value={closed} />
        <KpiBox label="Total (30)"     value={rows.length} />
        <KpiBox label="Active Arms"    value={arms} />
      </div>

      <DataTable
        columns={[
          { key: 'id',             header: 'ID' },
          { key: 'arm',            header: 'Arm' },
          { key: 'status',         header: 'Status' },
          { key: 'parsed_summary', header: 'Summary' },
          { key: 'created_at',     header: 'Created' },
        ]}
        rows={rows}
      />
    </main>
  );
}
