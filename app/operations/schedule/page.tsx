// app/operations/schedule/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function SchedulePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: scheduleData } = await supabase
    .from('operations_schedule')
    .select('*')
    .order('scheduled_date', { ascending: true })
    .limit(100);

  const rows = scheduleData ?? [];

  return (
    <main className="p-6">
      <PageHeader pillar="Operations" tab="Schedule" title="Schedule" />

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 mt-8">No schedule entries found.</p>
      ) : (
        <DataTable
          columns={[
            { key: 'scheduled_date', header: 'Date' },
            { key: 'shift', header: 'Shift' },
            { key: 'staff_name', header: 'Staff' },
            { key: 'department', header: 'Department' },
            { key: 'role', header: 'Role' },
            { key: 'start_time', header: 'Start' },
            { key: 'end_time', header: 'End' },
            { key: 'status', header: 'Status' },
          ]}
          rows={rows}
        />
      )}
    </main>
  );
}
