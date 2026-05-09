// app/settings/vat-rates/page.tsx
// Settings · VAT rates — per-USALI-subcategory tax rate used to net-down budget
// figures vs QuickBooks net actuals. Edit via inline form; writes via server
// action; budget view re-renders on next request (force-dynamic).

import Page from '@/components/page/Page';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

interface VatRow {
  id: number;
  usali_subcategory: string;
  vat_rate_pct: number;
  applies_to: 'budget' | 'actual' | 'both' | 'none';
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

async function saveVatRate(formData: FormData) {
  'use server';
  const id          = Number(formData.get('id'));
  const rate        = Number(formData.get('vat_rate_pct'));
  const appliesTo   = String(formData.get('applies_to'));
  const notes       = String(formData.get('notes') || '');

  if (!id || !isFinite(rate) || rate < 0 || rate > 100) return;
  if (!['budget','actual','both','none'].includes(appliesTo)) return;

  const sb = getSupabaseAdmin();
  await sb.from('vat_rates')
    .update({
      vat_rate_pct: rate,
      applies_to: appliesTo,
      notes,
      updated_at: new Date().toISOString(),
      updated_by: 'PBS',
    })
    .eq('id', id);

  revalidatePath('/settings/vat-rates');
  revalidatePath('/finance/pnl');
  revalidatePath('/finance');
}

export default async function VatRatesPage() {
  const sb = getSupabaseAdmin();
  const { data: rows } = await sb
    .schema('gl')
    .from('vat_rates')
    .select('*')
    .order('usali_subcategory');

  const list: VatRow[] = (rows ?? []) as VatRow[];

  return (
    <Page eyebrow="Settings · VAT rates" title={<>VAT <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>rates</em> · per USALI subcategory</>}>

      <div className="panel" style={{ padding: 18, marginTop: 18 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>USALI subcategory</th>
              <th className="num">VAT rate %</th>
              <th>Applies to</th>
              <th>Notes</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="lbl"><strong>{r.usali_subcategory}</strong></td>
                <td colSpan={5} style={{ padding: 0 }}>
                  <form action={saveVatRate} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 8px' }}>
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      type="number"
                      name="vat_rate_pct"
                      defaultValue={Number(r.vat_rate_pct)}
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      style={{ width: 72, padding: '4px 8px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', textAlign: 'right' }}
                    />
                    <span style={{ color: 'var(--ink-mute)' }}>%</span>
                    <select
                      name="applies_to"
                      defaultValue={r.applies_to}
                      style={{ padding: '4px 8px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}
                    >
                      <option value="budget">budget only</option>
                      <option value="actual">actual only</option>
                      <option value="both">both</option>
                      <option value="none">none (preserve gross)</option>
                    </select>
                    <input
                      type="text"
                      name="notes"
                      defaultValue={r.notes ?? ''}
                      placeholder="notes"
                      style={{ flex: 1, minWidth: 200, padding: '4px 8px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}
                    />
                    <span className="text-mute" style={{ fontSize: 'var(--t-xs)' }}>
                      {r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </span>
                    <button type="submit" className="btn primary" style={{ padding: '4px 14px' }}>Save</button>
                  </form>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                No VAT rates configured. Reseed via migration <code>create_gl_vat_rates_lookup</code>.
              </td></tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 14, padding: 12, background: 'var(--surf-2, #f5f1e7)', borderRadius: 4, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
          <strong>How it works:</strong> Budget rows in <code>plan.lines</code> are stored gross (VAT-inclusive).
          QuickBooks actuals come in net. The view <code>gl.v_budget_lines</code> divides each budget row by
          <code> 1 + rate/100</code> using the rate above, so /finance/pnl Budget column is net-of-VAT and
          comparable to actuals. Set <code>applies_to=none</code> to preserve a row gross (e.g. payroll, depreciation,
          interest — anything VAT-exempt).
        </div>
      </div>
    </Page>
  );
}
