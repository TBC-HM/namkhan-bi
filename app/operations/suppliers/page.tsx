// app/operations/suppliers/page.tsx
// PBS 2026-07-07 evening: Operations Suppliers page. Pulls active vendors for
// Namkhan (property 260955) from public.v_operations_suppliers — a bridge
// view over gl.vendors + finance.v_gl_supplier_overview.
//
// This is the ops-facing supplier list ("who do we buy from"). It complements
// /finance/supplier-mapping (which is the USALI-dept mapping cockpit).
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, Container, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtMoney } from '@/lib/format';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface SupplierRow {
  vendor_name: string;
  display_name: string | null;
  category: string | null;
  email: string | null;
  phone: string | null;
  currency: string | null;
  terms: string | null;
  is_active: boolean;
  property_id: number;
  line_count: number;
  first_txn_date: string | null;
  last_txn_date: string | null;
  gross_spend_usd: number | string;
  net_amount_usd: number | string;
  distinct_accounts: number;
  distinct_classes: number;
  is_active_recent: boolean;
}

async function getData(): Promise<SupplierRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e) {
    console.error('[ops/suppliers] supabaseAdmin', e);
    return [];
  }
  const { data, error } = await admin
    .from('v_operations_suppliers')
    .select('*')
    .limit(1500);
  if (error) {
    console.error('[ops/suppliers] fetch', error);
    return [];
  }
  return (data ?? []) as SupplierRow[];
}

export default async function OperationsSuppliersPage() {
  const rows = await getData();
  const cfg = DEPT_CFG.operations;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/operations/suppliers',
  }));

  const totalSpend = rows.reduce((s, r) => s + Number(r.gross_spend_usd || 0), 0);
  const withTxns   = rows.filter(r => Number(r.line_count || 0) > 0).length;
  const recent     = rows.filter(r => r.is_active_recent).length;
  const withEmail  = rows.filter(r => r.email && r.email.trim() !== '').length;

  const tiles: KpiTileProps[] = [
    { label: 'Active vendors',  value: rows.length,             size: 'sm', footnote: 'gl.vendors · property 260955' },
    { label: 'With recent txns',value: recent,                   size: 'sm', footnote: 'activity in last period',   status: recent > 0 ? 'green' : 'amber' },
    { label: 'With any txns',   value: withTxns,                 size: 'sm', footnote: 'ever booked in GL' },
    { label: 'Spend (all-time)',value: Math.round(totalSpend), currency: 'USD', size: 'sm', footnote: 'gross · from overview view' },
    { label: 'With email',      value: withEmail,                size: 'sm', footnote: 'contact hydrated',           status: withEmail > 0 ? 'green' : 'amber' },
    { label: 'Missing email',   value: rows.length - withEmail,  size: 'sm', footnote: 'contact gap',                status: (rows.length - withEmail) > 0 ? 'amber' : 'green' },
  ];

  // sort by spend desc, then name
  const sorted = [...rows].sort((a, b) => {
    const sa = Number(a.gross_spend_usd || 0);
    const sb = Number(b.gross_spend_usd || 0);
    if (sb !== sa) return sb - sa;
    return String(a.vendor_name).localeCompare(String(b.vendor_name));
  });

  const subtitle = `v_operations_suppliers · ${rows.length} active vendors · ${fmtMoney(totalSpend, 'USD')} tracked`;

  return (
    <DashboardPage title="Operations · Suppliers" subtitle={subtitle} tabs={tabs}>
      <div style={fullRow}>
        <Container title="Headline" subtitle="active vendor master · Namkhan property 260955" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      <div style={fullRow}>
        <Container
          title="Vendor list"
          subtitle={`${sorted.length} active · sorted by spend desc · click Finance mapping to classify`}
          density="compact"
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={tblStyle}>
              <thead>
                <tr>
                  <th style={thL}>Name</th>
                  <th style={thL}>Category</th>
                  <th style={thL}>Contact</th>
                  <th style={thL}>Terms</th>
                  <th style={thR}>Currency</th>
                  <th style={thR}>Spend USD</th>
                  <th style={thR}>Txns</th>
                  <th style={thL}>Last txn</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ ...tdL, textAlign: 'center', color: '#8A8A8A', padding: 20 }}>
                      No active suppliers found for property 260955.
                    </td>
                  </tr>
                )}
                {sorted.map((r, i) => {
                  const name = r.display_name || r.vendor_name;
                  const spend = Number(r.gross_spend_usd || 0);
                  return (
                    <tr key={`${r.vendor_name}-${i}`} style={i % 2 === 0 ? trEven : trOdd}>
                      <td style={tdL}><strong style={{ color: '#1B1B1B' }}>{name}</strong></td>
                      <td style={tdL}>{r.category || <span style={muted}>—</span>}</td>
                      <td style={tdL}>
                        {r.email ? <div style={{ fontSize: 11 }}>{r.email}</div> : null}
                        {r.phone ? <div style={{ fontSize: 11, color: '#5A5A5A' }}>{r.phone}</div> : null}
                        {!r.email && !r.phone ? <span style={muted}>—</span> : null}
                      </td>
                      <td style={tdL}>{r.terms || <span style={muted}>—</span>}</td>
                      <td style={tdR}>{r.currency || <span style={muted}>—</span>}</td>
                      <td style={tdR}>{spend > 0 ? fmtMoney(spend, 'USD') : <span style={muted}>—</span>}</td>
                      <td style={tdR}>{Number(r.line_count) || <span style={muted}>0</span>}</td>
                      <td style={tdL}>{r.last_txn_date || <span style={muted}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Related" density="compact">
          <div style={{ fontSize: 12, color: '#3A3A3A', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 6px' }}>
              <strong>Classify vendor spend</strong> → <TenantLink href="/finance/supplier-mapping" style={lnk}>Finance · Supplier mapping</TenantLink>
              (vendor × USALI dept · no-class + unmapped-account leakage detection).
            </p>
            <p style={{ margin: '0 0 6px' }}>
              <strong>Map GL accounts</strong> → <TenantLink href="/finance/mapping" style={lnk}>Finance · Account mapping</TenantLink>
              (set USALI subcategory / line label on GL accounts).
            </p>
            <p style={{ margin: 0 }}>
              <strong>Vendor list source</strong>: <code>public.v_operations_suppliers</code> — bridge over
              <code> gl.vendors</code> (contact + terms) + <code>finance.v_gl_supplier_overview</code> (spend + activity).
            </p>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const lnk: React.CSSProperties = { color: '#1F3A2E', textDecoration: 'underline', fontWeight: 600 };
const muted: React.CSSProperties = { color: '#B8B8B8' };

const tblStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  background: '#FFFFFF',
  color: '#1B1B1B',
};
const thBase: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: '#5A5A5A',
  borderBottom: '1px solid #E6DFCC',
  background: '#FFFFFF',
  position: 'sticky',
  top: 0,
};
const thL: React.CSSProperties = { ...thBase, textAlign: 'left' };
const thR: React.CSSProperties = { ...thBase, textAlign: 'right' };
const tdBase: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #F0EBDB', verticalAlign: 'top' };
const tdL: React.CSSProperties = { ...tdBase, textAlign: 'left' };
const tdR: React.CSSProperties = { ...tdBase, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const trEven: React.CSSProperties = { background: '#FFFFFF' };
const trOdd:  React.CSSProperties = { background: '#FFFFFF' };
