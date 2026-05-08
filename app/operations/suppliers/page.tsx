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

  const { data, error } = await supabase
    .from('operations_suppliers')
    .select('*')
    .order('supplier_name', { ascending: true })
    .limit(100);

  const rows = data ?? [];

  const active = rows.filter((r) => r.status === 'active').length;
  const inactive = rows.filter((r) => r.status !== 'active').length;
  const total = rows.length;
  const withContract = rows.filter((r) => r.contract_expiry).length;

  return (
    <main style={{ background: '#000', minHeight: '100vh', padding: '24px' }}>
      <PageHeader pillar="Operations" tab="Suppliers" title="Suppliers" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Total Suppliers" value={String(total)} />
        <KpiBox label="Active" value={String(active)} />
        <KpiBox label="Inactive" value={String(inactive)} />
        <KpiBox label="With Contract" value={String(withContract)} />
      </div>

      <DataTable
        columns={[
          { key: 'supplier_name', header: 'Supplier' },
          { key: 'category', header: 'Category' },
          { key: 'contact_name', header: 'Contact' },
          { key: 'contact_email', header: 'Email' },
          { key: 'phone', header: 'Phone' },
          { key: 'contract_expiry', header: 'Contract Expiry' },
          { key: 'payment_terms', header: 'Payment Terms' },
          { key: 'status', header: 'Status' },
          { key: 'notes', header: 'Notes' },
        ]}
        rows={rows.map((r) => ({
          supplier_name: r.supplier_name ?? '—',
          category: r.category ?? '—',
          contact_name: r.contact_name ?? '—',
          contact_email: r.contact_email ?? '—',
          phone: r.phone ?? '—',
          contract_expiry: r.contract_expiry ?? '—',
          payment_terms: r.payment_terms ?? '—',
          status: r.status ?? '—',
          notes: r.notes ?? '—',
        }))}
      />

      {error && (
        <p style={{ color: '#f87171', marginTop: 16, fontSize: 12 }}>
          Data error: {error.message}
        </p>
      )}
    </main>
  );
}
