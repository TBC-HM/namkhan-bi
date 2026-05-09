// app/operations/suppliers/page.tsx
// PBS 2026-05-09: "There used to be a Supplier tab in the Operations area; if
// you don't find we must make a new one similar concept like channels just
// suppliers". Lists the canonical supplier registry (suppliers.suppliers) +
// top QB-based spend (public.v_finance_top_suppliers).

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { fmtUSD } from '@/lib/format';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { OPERATIONS_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Supplier {
  supplier_id: string;
  code: string | null;
  name: string;
  supplier_type: string | null;
  country: string | null;
  city: string | null;
  is_local_sourcing: boolean | null;
  payment_terms: string | null;
  payment_terms_days: number | null;
  lead_time_days: number | null;
  reliability_score: number | null;
  quality_score: number | null;
  sustainability_score: number | null;
  status: string | null;
  email: string | null;
  phone: string | null;
}

interface QBTopVendor {
  vendor_name: string;
  gross_spend_usd: number | string | null;
  line_count: number | null;
  rank_month: number | null;
}

async function getSuppliers(): Promise<Supplier[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('suppliers')
    .from('suppliers')
    .select('supplier_id,code,name,supplier_type,country,city,is_local_sourcing,payment_terms,payment_terms_days,lead_time_days,reliability_score,quality_score,sustainability_score,status,email,phone')
    .order('name', { ascending: true })
    .limit(500);
  if (error) {
    console.error('getSuppliers error', error);
    return [];
  }
  return (data ?? []) as Supplier[];
}

async function getQBTopVendors(): Promise<QBTopVendor[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('v_finance_top_suppliers')
    .select('vendor_name,gross_spend_usd,line_count,rank_month')
    .order('rank_month', { ascending: true })
    .limit(15);
  if (error) {
    console.error('getQBTopVendors error', error);
    return [];
  }
  return (data ?? []) as QBTopVendor[];
}

export default async function SuppliersPage() {
  const [suppliers, topVendors] = await Promise.all([getSuppliers(), getQBTopVendors()]);

  const active = suppliers.filter((s) => (s.status ?? 'active').toLowerCase() === 'active').length;
  const local = suppliers.filter((s) => s.is_local_sourcing).length;
  const avgLead = suppliers.length > 0
    ? suppliers.reduce((s, v) => s + (v.lead_time_days ?? 0), 0) / suppliers.length
    : 0;
  const totalSpend = topVendors.reduce((s, v) => s + Number(v.gross_spend_usd ?? 0), 0);

  return (
    <Page
      eyebrow="Operations · Suppliers"
      title={<>Supplier <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>register</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={suppliers.length} unit="count" label="Registered"     tooltip="Rows in suppliers.suppliers (canonical supplier registry)." />
        <KpiBox value={active}            unit="count" label="Active"        tooltip="Suppliers with status = active." />
        <KpiBox value={local}             unit="count" label="Local sourcing" tooltip="Suppliers flagged is_local_sourcing = true. Lao Lao sustainability KPI." />
        <KpiBox value={avgLead}           unit="nights" dp={1} label="Avg lead time (d)" tooltip="Mean lead_time_days across registered suppliers." />
        <KpiBox value={topVendors.length} unit="count" label="QB vendors paid" tooltip="Distinct QuickBooks vendors with spend this month. Source: v_finance_top_suppliers." />
        <KpiBox value={totalSpend}        unit="usd"   label="Spend (top vendors)" tooltip="Sum of gross_spend_usd across the top vendors this month." />
      </div>

      <Panel
        title="Supplier register · suppliers.suppliers"
        eyebrow={`${suppliers.length} rows`}
        actions={<ArtifactActions context={{ kind: 'table', title: 'Supplier register', dept: 'operations' }} />}
      >
        {suppliers.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>
            No suppliers registered yet. Add rows to <code>suppliers.suppliers</code> via Supabase
            dashboard or the upcoming upload UI.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Payment</th>
                  <th className="num">Lead (d)</th>
                  <th className="num">Reliability</th>
                  <th className="num">Quality</th>
                  <th className="num">Sustainability</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.supplier_id}>
                    <td className="lbl">
                      <strong>{s.name}</strong>
                      {s.code && <span style={{ color: 'var(--ink-mute)', marginLeft: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{s.code}</span>}
                    </td>
                    <td className="lbl text-mute">{s.supplier_type ?? '—'}</td>
                    <td className="lbl text-mute">
                      {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                      {s.is_local_sourcing && <span style={{ marginLeft: 6, color: '#7ad790', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>local</span>}
                    </td>
                    <td className="lbl text-mute">{s.payment_terms ?? (s.payment_terms_days ? `${s.payment_terms_days}d` : '—')}</td>
                    <td className="num">{s.lead_time_days ?? '—'}</td>
                    <td className="num">{s.reliability_score?.toFixed(1) ?? '—'}</td>
                    <td className="num">{s.quality_score?.toFixed(1) ?? '—'}</td>
                    <td className="num">{s.sustainability_score?.toFixed(1) ?? '—'}</td>
                    <td className="lbl">{s.status ?? 'active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ height: 14 }} />

      <Panel
        title="Top QB vendors (this month)"
        eyebrow="public.v_finance_top_suppliers"
        actions={<ArtifactActions context={{ kind: 'table', title: 'Top QB vendors', dept: 'operations' }} />}
      >
        {topVendors.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>
            No QB vendor activity this month.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Vendor</th>
                  <th className="num">Gross spend</th>
                  <th className="num">Lines</th>
                </tr>
              </thead>
              <tbody>
                {topVendors.map((v) => (
                  <tr key={`${v.rank_month}-${v.vendor_name}`}>
                    <td className="num">{v.rank_month}</td>
                    <td className="lbl"><strong>{v.vendor_name}</strong></td>
                    <td className="num">{fmtUSD(Number(v.gross_spend_usd ?? 0))}</td>
                    <td className="num">{v.line_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
