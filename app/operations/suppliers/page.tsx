// app/operations/suppliers/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SupplierRow {
  id?: string | number;
  supplier_name?: string;
  category?: string;
  contact_name?: string;
  contact_email?: string;
  phone?: string;
  currency?: string;
  payment_terms_days?: number | null;
  status?: string;
  country?: string;
  notes?: string;
  // fallback if view uses slightly different column names
  name?: string;
  is_active?: boolean | null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function SuppliersPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: schema-qualified view
  const { data: viewData } = await supabase
    .schema('suppliers')
    .from('v_active_suppliers')
    .select('*')
    .limit(100);

  // Fallback: raw table in suppliers schema
  const { data: tableData } = !viewData?.length
    ? await supabase.schema('suppliers').from('suppliers').select('*').limit(100)
    : { data: null };

  // Second fallback: public schema
  const { data: publicData } = !viewData?.length && !tableData?.length
    ? await supabase.from('suppliers').select('*').limit(100)
    : { data: null };

  const rows: SupplierRow[] = (viewData ?? tableData ?? publicData ?? []) as SupplierRow[];

  // ---------------------------------------------------------------------------
  // KPI derivations
  // ---------------------------------------------------------------------------
  const totalSuppliers = rows.length;

  const activeSuppliers = rows.filter(
    (r) =>
      r.status?.toLowerCase() === 'active' ||
      r.is_active === true ||
      r.status == null // treat null as active when no status column
  ).length;

  const categories = Array.from(new Set(rows.map((r) => r.category).filter(Boolean)));
  const uniqueCategories = categories.length;

  const currencies = Array.from(new Set(rows.map((r) => r.currency).filter(Boolean)));
  const uniqueCurrencies = currencies.length;

  // ---------------------------------------------------------------------------
  // Table columns — guard every field with ?? '—'
  // ---------------------------------------------------------------------------
  const columns = [
    { key: 'supplier_name', header: 'Supplier' },
    { key: 'category', header: 'Category' },
    { key: 'contact_name', header: 'Contact' },
    { key: 'contact_email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'currency', header: 'Currency' },
    { key: 'payment_terms_days', header: 'Payment Terms' },
    { key: 'country', header: 'Country' },
    { key: 'status', header: 'Status' },
  ];

  // Normalise rows so every expected key is present
  const normalisedRows = rows.map((r) => ({
    ...r,
    supplier_name: r.supplier_name ?? r.name ?? '—',
    category: r.category ?? '—',
    contact_name: r.contact_name ?? '—',
    contact_email: r.contact_email ?? '—',
    phone: r.phone ?? '—',
    currency: r.currency ?? '—',
    payment_terms_days:
      r.payment_terms_days != null ? `${r.payment_terms_days} days` : '—',
    country: r.country ?? '—',
    status: r.status ?? (r.is_active === false ? 'Inactive' : 'Active'),
  }));

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader
        pillar="Operations"
        tab="Suppliers"
        title="Suppliers"
        lede="Active vendor and supplier register — payment terms, contacts, and categories."
      />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Total Suppliers"
          value={totalSuppliers > 0 ? String(totalSuppliers) : '—'}
        />
        <KpiBox
          label="Active Suppliers"
          value={activeSuppliers > 0 ? String(activeSuppliers) : '—'}
        />
        <KpiBox
          label="Categories"
          value={uniqueCategories > 0 ? String(uniqueCategories) : '—'}
        />
        <KpiBox
          label="Currencies"
          value={uniqueCurrencies > 0 ? String(uniqueCurrencies) : '—'}
        />
      </div>

      {/* Supplier register table */}
      <DataTable columns={columns} rows={normalisedRows} />
    </main>
  );
}
