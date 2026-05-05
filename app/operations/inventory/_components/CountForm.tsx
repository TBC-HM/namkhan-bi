'use client';

// CountForm — Page 9 mobile-first count entry form.
// Receives par_levels rows (item × location with stock_balance + cost).
// Submits to /api/inv/count which inserts inv.counts + count_lines.
// DQ trigger fires automatically — no extra client work needed.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CountRow {
  item_id: string;
  sku: string;
  item_name: string;
  category_name: string;
  expected: number;
  unit_cost_usd: number | null;
}

interface Props {
  locationId: number;
  rows: CountRow[];
}

export default function CountForm({ locationId, rows }: Props) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);

  async function save(asDraft: boolean) {
    setBusy(true); setErr(null);
    const lines = rows
      .filter((r) => counts[r.item_id] !== undefined && counts[r.item_id] !== '')
      .map((r) => ({
        item_id: r.item_id,
        counted_quantity: Number(counts[r.item_id]),
        system_quantity: r.expected,
        unit_cost_usd: r.unit_cost_usd,
      }));
    if (lines.length === 0) { setErr('Enter at least one count'); setBusy(false); return; }
    try {
      const resp = await fetch('/api/inv/count', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count_date: new Date().toISOString().slice(0, 10),
          location_id: locationId,
          count_type: 'periodic',
          status: asDraft ? 'draft' : 'submitted',
          lines,
        }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || `HTTP ${resp.status}`); setBusy(false); return; }
      setSubmitted(`Saved — ${j.lines_inserted} lines · count_id=${j.count_id}`);
      setTimeout(() => router.push('/operations/inventory/counts'), 1500);
    } catch (e: any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(false); }
  }

  const filledCount = Object.values(counts).filter((v) => v !== '').length;

  return (
    <>
      <table className="inv-table">
        <thead>
          <tr>
            <th>SKU</th><th>Item</th><th>Category</th>
            <th style={{ textAlign: 'right' }}>Expected</th>
            <th style={{ textAlign: 'right' }}>Counted</th>
            <th style={{ textAlign: 'right' }}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const counted = counts[r.item_id];
            const delta = counted !== undefined && counted !== '' ? Number(counted) - r.expected : null;
            return (
              <tr key={r.item_id}>
                <td>{r.sku}</td>
                <td>{r.item_name}</td>
                <td>{r.category_name}</td>
                <td style={{ textAlign: 'right' }}>{r.expected}</td>
                <td style={{ textAlign: 'right' }}>
                  <input
                    type="number" step="0.001" inputMode="decimal"
                    value={counted ?? ''}
                    onChange={(e) => setCounts({ ...counts, [r.item_id]: e.target.value })}
                    className="inv-input inv-input-narrow"
                  />
                </td>
                <td style={{ textAlign: 'right' }} className={delta == null ? '' : delta < 0 ? 'qty-out' : delta > 0 ? 'qty-in' : ''}>
                  {delta == null ? '—' : delta > 0 ? `+${delta}` : delta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="inv-count-progress">
        Progress: <strong>{filledCount}</strong> / {rows.length} items counted
      </div>

      {err && <div className="inv-error">{err}</div>}
      {submitted && <div className="inv-success">{submitted}</div>}

      <div className="inv-actions">
        <button type="button" className="btn-ghost"   onClick={() => save(true)}  disabled={busy}>
          {busy ? 'Saving…' : 'Save draft'}
        </button>
        <button type="button" className="btn-primary" onClick={() => save(false)} disabled={busy || filledCount === 0}>
          {busy ? 'Submitting…' : `Submit count (${filledCount})`}
        </button>
      </div>
    </>
  );
}
