// app/settings/manual-entries/page.tsx
// Settings · Manual entries — for P&L lines QuickBooks doesn't track:
// Mgmt Fees, Depreciation, Interest, Income Tax, FX, accruals.
// Surfaces in /finance/pnl actuals via gl.v_actuals_with_manual once exposed.

import Page from '@/components/page/Page';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

interface ManualRow {
  id: number;
  period_yyyymm: string;
  usali_subcategory: string;
  usali_department: string;
  amount_usd: number;
  kind: 'manual' | 'accrual' | 'estimate' | 'override';
  notes: string | null;
  updated_at: string;
}

const SUBCATS = [
  'Revenue', 'Cost of Sales', 'Payroll & Related', 'Other Operating Expenses',
  'A&G', 'Sales & Marketing', 'POM', 'Utilities', 'Mgmt Fees',
  'Depreciation', 'Interest', 'Income Tax', 'FX Gain/Loss', 'Non-Operating',
];
const DEPTS = ['Undistributed', 'Rooms', 'F&B', 'Spa', 'Activities', 'Mekong Cruise', 'Other Operated'];

async function createEntry(formData: FormData) {
  'use server';
  const period = String(formData.get('period_yyyymm'));
  const subcat = String(formData.get('usali_subcategory'));
  const dept   = String(formData.get('usali_department'));
  const amount = Number(formData.get('amount_usd'));
  const kind   = String(formData.get('kind'));
  const notes  = String(formData.get('notes') || '');

  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period)) return;
  if (!SUBCATS.includes(subcat)) return;
  if (!DEPTS.includes(dept)) return;
  if (!isFinite(amount)) return;

  const sb = getSupabaseAdmin();
  await sb.schema('gl').from('manual_entries').insert({
    period_yyyymm: period,
    usali_subcategory: subcat,
    usali_department: dept,
    amount_usd: amount,
    kind,
    notes,
  });

  revalidatePath('/settings/manual-entries');
  revalidatePath('/finance/pnl');
}

async function deleteEntry(formData: FormData) {
  'use server';
  const id = Number(formData.get('id'));
  if (!id) return;
  const sb = getSupabaseAdmin();
  await sb.schema('gl').from('manual_entries').delete().eq('id', id);
  revalidatePath('/settings/manual-entries');
  revalidatePath('/finance/pnl');
}

export default async function ManualEntriesPage() {
  const sb = getSupabaseAdmin();
  const { data: rows } = await sb
    .schema('gl')
    .from('manual_entries')
    .select('*')
    .order('period_yyyymm', { ascending: false })
    .order('usali_subcategory');

  const list: ManualRow[] = (rows ?? []) as ManualRow[];
  const totalEntries = list.length;
  const sumByPeriod = new Map<string, number>();
  for (const r of list) {
    sumByPeriod.set(r.period_yyyymm, (sumByPeriod.get(r.period_yyyymm) || 0) + Number(r.amount_usd));
  }

  // Default new-entry period = current month
  const today = new Date();
  const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  return (
    <Page eyebrow="Settings · Manual entries" title={<>Manual <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>entries</em> · non-QB lines</>}>

      {/* Add new */}
      <div className="panel" style={{ padding: 16, marginTop: 18 }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontWeight: 500 }}>
          Add <em style={{ color: 'var(--brass)' }}>entry</em>
        </h3>
        <form action={createEntry} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Period</span>
            <input
              type="text" name="period_yyyymm" defaultValue={defaultPeriod}
              pattern="[0-9]{4}-(0[1-9]|1[0-2])" required placeholder="2026-04"
              style={{ width: 100, padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}
            />
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Subcategory</span>
            <select name="usali_subcategory" required style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}>
              {SUBCATS.map(sc => <option key={sc} value={sc}>{sc}</option>)}
            </select>
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Department</span>
            <select name="usali_department" defaultValue="Undistributed" style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}>
              {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Amount USD</span>
            <input
              type="number" name="amount_usd" step="0.01" required
              style={{ width: 120, padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', textAlign: 'right' }}
            />
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Kind</span>
            <select name="kind" defaultValue="manual" style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}>
              <option value="manual">manual</option>
              <option value="accrual">accrual</option>
              <option value="estimate">estimate</option>
              <option value="override">override</option>
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 200 }}>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Notes</span>
            <input
              type="text" name="notes"
              placeholder="e.g. Mgmt fee per contract, monthly depreciation"
              style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}
            />
          </label>
          <button type="submit" className="btn primary" style={{ height: 32 }}>Add entry</button>
        </form>
      </div>

      {/* Existing entries */}
      <div className="panel" style={{ padding: 16, marginTop: 14, overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontWeight: 500 }}>
          Existing <em style={{ color: 'var(--brass)' }}>entries</em>
        </h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Period</th>
              <th>Subcategory</th>
              <th>Dept</th>
              <th className="num">Amount</th>
              <th>Kind</th>
              <th>Notes</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="lbl text-mono">{r.period_yyyymm}</td>
                <td className="lbl"><strong>{r.usali_subcategory}</strong></td>
                <td className="lbl text-mute">{r.usali_department}</td>
                <td className={`num ${r.amount_usd < 0 ? 'var-amber' : ''}`}>${Number(r.amount_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td><span className="pill">{r.kind}</span></td>
                <td className="lbl text-mute">{r.notes || '—'}</td>
                <td className="lbl text-mute" style={{ fontSize: 'var(--t-xs)' }}>{r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</td>
                <td>
                  <form action={deleteEntry} style={{ display: 'inline' }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="btn" style={{ padding: '2px 10px', fontSize: 'var(--t-xs)' }}>Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                No manual entries yet. Use the form above to add one.
              </td></tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 14, padding: 12, background: 'var(--surf-2, #f5f1e7)', borderRadius: 4, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
          <strong>How it works:</strong> Manual entries are aggregated alongside QuickBooks actuals via <code>gl.v_actuals_with_manual</code>.
          They surface on <a href="/finance/pnl">/finance/pnl</a> in the actual columns. Use for: monthly mgmt fees per contract,
          straight-line depreciation, accrued interest, FX adjustments, or one-off accruals between close cycles.
          For VAT rates see <a href="/settings/vat-rates">/settings/vat-rates</a>.
        </div>
      </div>
    </Page>
  );
}
