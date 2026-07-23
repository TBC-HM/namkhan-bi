// app/h/[property_id]/operations/inventory/dishes/page.tsx
// PBS 2026-07-24: Dish sales matrix from PMS transactions (live, net prices).
// Placeholder for BOM/recipe layer — will link ingredients when built.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtQty = (n: number | null) => n == null ? '—' : Math.round(Number(n)).toLocaleString('en-US');
const fmtUsd = (n: number | null) => n == null ? '—' : `$${Number(n).toFixed(2)}`;
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

interface DishRow {
  product: string;
  category: string;
  jan_qty: number | null; feb_qty: number | null; mar_qty: number | null;
  apr_qty: number | null; may_qty: number | null; jun_qty: number | null;
  jul_qty: number | null; total_qty: number; total_net_usd: number;
  avg_net_price_usd: number;
}

const CAT_ORDER = ['Starters','Salads','Main Courses','Sides','Desserts','Childrens Menu','Meals','Experience Dinners','To Eat'];

export default async function DishesPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/dishes`);
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_pms_product_sales_2026')
    .select('product,category,jan_qty,feb_qty,mar_qty,apr_qty,may_qty,jun_qty,jul_qty,total_qty,total_net_usd,avg_net_price_usd')
    .eq('department', 'Food')
    .eq('property_id', propertyId)
    .order('total_qty', { ascending: false });

  if (error) console.error('[dishes]', error);
  const rows = (data ?? []) as DishRow[];

  // Group by category in defined order
  const grouped = new Map<string, DishRow[]>();
  CAT_ORDER.forEach(c => grouped.set(c, []));
  rows.forEach(r => {
    const c = r.category ?? 'Other';
    if (!grouped.has(c)) grouped.set(c, []);
    grouped.get(c)!.push(r);
  });

  const totalQty = rows.reduce((s, r) => s + (r.total_qty || 0), 0);
  const totalRev = rows.reduce((s, r) => s + Number(r.total_net_usd || 0), 0);

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  const TH: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', padding: '6px 8px', textAlign: 'right', borderBottom: '2px solid #1B1B1B', whiteSpace: 'nowrap' };
  const THL: React.CSSProperties = { ...TH, textAlign: 'left' };
  const TD: React.CSSProperties = { fontSize: 12, color: '#1B1B1B', padding: '5px 8px', textAlign: 'right', borderBottom: '1px solid #E6DFCC', fontVariantNumeric: 'tabular-nums' };
  const TDL: React.CSSProperties = { ...TD, textAlign: 'left' };

  return (
    <DashboardPage title="Dishes · Sales 2026" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow size="sm" tiles={[
          { label: 'Dishes tracked', value: fmtInt(rows.length), footnote: 'from PMS transactions · net of fees/tax' },
          { label: 'Total sold Jan–Jul', value: fmtInt(totalQty), footnote: 'covers' },
          { label: 'Net revenue Jan–Jul', value: `$${Math.round(totalRev).toLocaleString('en-US')}`, footnote: 'excl. service charge + tax' },
          { label: 'BOM status', value: 'Pending', footnote: 'Ingredients per dish — coming next' },
        ]} />
      </div>

      <div style={{ gridColumn: '1 / -1', padding: '8px 0 4px', color: '#5A5A5A', fontSize: 11, fontStyle: 'italic' }}>
        Source: <code style={{ background: '#F4EFE2', padding: '1px 5px', borderRadius: 3 }}>pms.transactions</code> — live from Cloudbeds daily sync · Net prices (service charge + VAT billed separately) · Data since Jan 2026
      </div>

      {Array.from(grouped.entries()).map(([cat, catRows]) => {
        if (!catRows.length) return null;
        return (
          <div key={cat} style={{ gridColumn: '1 / -1' }}>
            <Container title={cat} subtitle={`${catRows.length} dishes · ${fmtInt(catRows.reduce((s,r)=>s+(r.total_qty||0),0))} covers Jan–Jul`} density="compact">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={THL}>Dish</th>
                      <th style={TH}>Jan</th><th style={TH}>Feb</th><th style={TH}>Mar</th>
                      <th style={TH}>Apr</th><th style={TH}>May</th><th style={TH}>Jun</th>
                      <th style={TH}>Jul</th>
                      <th style={{ ...TH, borderLeft: '2px solid #E6DFCC' }}>Total</th>
                      <th style={TH}>Avg net $</th>
                      <th style={TH}>Total net $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catRows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFAF7' }}>
                        <td style={{ ...TDL, fontWeight: 500 }}>{r.product}</td>
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
        );
      })}
    </DashboardPage>
  );
}
