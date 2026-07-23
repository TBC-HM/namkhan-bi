// app/h/[property_id]/operations/inventory/spa/page.tsx
// PBS 2026-07-24: Spa treatment matrix + recipe form (up to 5 products per treatment).
// When a treatment is delivered, fn_inv_deduct_treatment_products deducts consumables.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import SpaRecipeClient from './SpaRecipeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtQty = (n: number | null) => n == null ? '—' : Math.round(Number(n)).toLocaleString();
const fmtUsd = (n: number | null) => n == null ? '—' : `$${Number(n).toFixed(0)}`;
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

interface TreatmentRow {
  product: string;
  jan_qty: number | null; feb_qty: number | null; mar_qty: number | null;
  apr_qty: number | null; may_qty: number | null; jun_qty: number | null;
  jul_qty: number | null; total_qty: number; total_net_usd: number;
  avg_net_price_usd: number;
}

export default async function SpaPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/spa`);
  }

  const sb = getSupabaseAdmin();
  const [salesRes, recipesRes, itemsRes] = await Promise.all([
    sb.from('v_pms_product_sales_2026')
      .select('product,jan_qty,feb_qty,mar_qty,apr_qty,may_qty,jun_qty,jul_qty,total_qty,total_net_usd,avg_net_price_usd')
      .eq('department', 'Spa')
      .eq('property_id', propertyId)
      .order('total_qty', { ascending: false }),
    sb.schema('inv').from('treatment_recipes')
      .select('recipe_id,treatment_name,sort_order,item_id,qty_per_treatment,uom_id,notes')
      .eq('property_id', propertyId)
      .order('treatment_name').order('sort_order'),
    sb.schema('inv').from('items')
      .select('item_id,item_name,uom_id')
      .eq('property_id', propertyId)
      .eq('catalog_status', 'approved')
      .eq('is_active', true)
      .in('category_id', [15, 6]) // Spa Consumables + Spa Products
      .order('item_name'),
  ]);

  const treatments = (salesRes.data ?? []) as TreatmentRow[];
  const recipes = recipesRes.data ?? [];
  const spaItems = (itemsRes.data ?? []) as Array<{ item_id: string; item_name: string; uom_id: number }>;

  const totalTreatments = treatments.reduce((s, r) => s + (r.total_qty || 0), 0);
  const totalRev = treatments.reduce((s, r) => s + Number(r.total_net_usd || 0), 0);
  const treatmentNames = treatments.map(t => t.product);

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  const TH: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', padding: '6px 8px', textAlign: 'right', borderBottom: '2px solid #1B1B1B', whiteSpace: 'nowrap' };
  const THL: React.CSSProperties = { ...TH, textAlign: 'left' };
  const TD: React.CSSProperties = { fontSize: 12, color: '#1B1B1B', padding: '5px 8px', textAlign: 'right', borderBottom: '1px solid #E6DFCC', fontVariantNumeric: 'tabular-nums' };
  const TDL: React.CSSProperties = { ...TD, textAlign: 'left' };

  return (
    <DashboardPage title="Spa · Treatments 2026" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow size="sm" tiles={[
          { label: 'Treatments delivered', value: fmtInt(totalTreatments), footnote: 'Jan–Jul 2026' },
          { label: 'Net revenue', value: `$${Math.round(totalRev).toLocaleString()}`, footnote: 'excl. service charge + tax' },
          { label: 'Distinct treatments', value: fmtInt(treatments.length), footnote: 'in PMS' },
          { label: 'Recipes configured', value: fmtInt(new Set(recipes.map(r => r.treatment_name)).size), footnote: `of ${treatments.length} treatments` },
        ]} />
      </div>

      {/* Treatment sales matrix */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Treatment sales matrix" subtitle="Net prices · Source: Cloudbeds PMS daily sync · Spa category filtered ≥ $20 avg" density="compact">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={THL}>Treatment</th>
                  <th style={TH}>Jan</th><th style={TH}>Feb</th><th style={TH}>Mar</th>
                  <th style={TH}>Apr</th><th style={TH}>May</th><th style={TH}>Jun</th>
                  <th style={TH}>Jul</th>
                  <th style={{ ...TH, borderLeft: '2px solid #E6DFCC' }}>Total</th>
                  <th style={TH}>Avg net $</th>
                  <th style={TH}>Total net $</th>
                </tr>
              </thead>
              <tbody>
                {treatments.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFAF7' }}>
                    <td style={{ ...TDL, fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product}</td>
                    <td style={TD}>{fmtQty(r.jan_qty)}</td>
                    <td style={TD}>{fmtQty(r.feb_qty)}</td>
                    <td style={TD}>{fmtQty(r.mar_qty)}</td>
                    <td style={TD}>{fmtQty(r.apr_qty)}</td>
                    <td style={TD}>{fmtQty(r.may_qty)}</td>
                    <td style={TD}>{fmtQty(r.jun_qty)}</td>
                    <td style={TD}>{fmtQty(r.jul_qty)}</td>
                    <td style={{ ...TD, fontWeight: 700, borderLeft: '2px solid #E6DFCC' }}>{fmtInt(r.total_qty)}</td>
                    <td style={TD}>{fmtUsd(r.avg_net_price_usd)}</td>
                    <td style={{ ...TD, color: '#1F3A2E', fontWeight: 600 }}>{fmtUsd(r.total_net_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </div>

      {/* Recipe configurator */}
      <div style={{ gridColumn: '1 / -1' }}>
        <SpaRecipeClient
          treatmentNames={treatmentNames}
          spaItems={spaItems}
          existingRecipes={recipes as any[]}
          propertyId={propertyId}
        />
      </div>
    </DashboardPage>
  );
}
