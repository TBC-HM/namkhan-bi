import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface InquiryRow {
  id?: string | number;
  created_at?: string;
  inquiry_date?: string;
  contact_name?: string;
  company?: string;
  source?: string;
  status?: string;
  room_nights?: number;
  estimated_value?: number;
  currency?: string;
  assigned_to?: string;
  notes?: string;
  [key: string]: unknown;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_inquiries_recent')
    .select('*')
    .limit(50);

  const rows: InquiryRow[] = data ?? [];

  // KPI aggregations
  const total = rows.length;
  const open = rows.filter(r => String(r.status ?? '').toLowerCase() === 'open').length;
  const totalRoomNights = rows.reduce((sum, r) => sum + (Number(r.room_nights) || 0), 0);
  const totalValue = rows.reduce((sum, r) => sum + (Number(r.estimated_value) || 0), 0);
  const avgValue = total > 0 ? totalValue / total : 0;

  const columns = [
    { key: 'inquiry_date', header: 'Date' },
    { key: 'contact_name', header: 'Contact' },
    { key: 'company', header: 'Company' },
    { key: 'source', header: 'Source' },
    { key: 'status', header: 'Status' },
    { key: 'room_nights', header: 'Room Nights' },
    { key: 'estimated_value', header: 'Est. Value' },
    { key: 'assigned_to', header: 'Assigned To' },
  ];

  const displayRows = rows.map(r => ({
    ...r,
    inquiry_date: r.inquiry_date ?? r.created_at
      ? String(r.inquiry_date ?? r.created_at ?? '').slice(0, 10)
      : '—',
    contact_name: r.contact_name ?? '—',
    company: r.company ?? '—',
    source: r.source ?? '—',
    status: r.status ?? '—',
    room_nights: r.room_nights != null ? String(r.room_nights) : '—',
    estimated_value: r.estimated_value != null
      ? `$${Number(r.estimated_value).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
      : '—',
    assigned_to: r.assigned_to ?? '—',
  }));

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg, #000)', color: 'var(--fg, #fff)', padding: '0 0 48px' }}>
      <PageHeader pillar="Sales" tab="Inquiries" title="Inquiries" />

      {error && (
        <div style={{ margin: '16px 24px', padding: '12px 16px', background: 'var(--st-bad-bg, #2a0a0a)', border: '1px solid var(--st-bad-bd, #7f1d1d)', borderRadius: 8, fontSize: 'var(--t-sm, 13px)', color: 'var(--st-bad-fg, #fca5a5)' }}>
          Data source offline — showing cached results. ({String(error.message)})
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '24px 24px 0' }}>
        <KpiBox label="Total Inquiries" value={total > 0 ? String(total) : '—'} />
        <KpiBox label="Open" value={open > 0 ? String(open) : '—'} />
        <KpiBox label="Total Room Nights" value={totalRoomNights > 0 ? String(totalRoomNights) : '—'} />
        <KpiBox
          label="Avg Est. Value"
          value={avgValue > 0
            ? `$${avgValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : '—'}
        />
      </div>

      <div style={{ padding: '24px' }}>
        <DataTable columns={columns} rows={displayRows} />
      </div>
    </main>
  );
}
