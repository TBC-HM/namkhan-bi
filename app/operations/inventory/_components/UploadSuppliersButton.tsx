'use client';

// app/operations/inventory/_components/UploadSuppliersButton.tsx
//
// Bulk-load suppliers from CSV. Same modal pattern as UploadProductsButton.
// POSTs JSON to /api/operations/suppliers/upload.
//
// Required columns: code, name, country
// Optional: legal_name, supplier_type, city, province, address, distance_km,
//           is_local_sourcing, email, phone, website, payment_terms_days,
//           lead_time_days, currency, minimum_order_usd, minimum_order_lak,
//           reliability_score, quality_score, sustainability_score,
//           tax_id, bank_account, payment_terms, status, notes

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type RowStatus = 'queued' | 'inserting' | 'ok' | 'skip' | 'error';

interface ParsedRow {
  rowIndex: number;
  code: string;
  name: string;
  country: string;
  raw: Record<string, string>;
  status: RowStatus;
  message?: string;
}

interface ApiResultRow {
  code: string;
  ok: boolean;
  action?: 'inserted' | 'updated' | 'skipped';
  message?: string;
}

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else cell += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); out.push(row); }
  return out.filter(r => r.length > 1 || (r.length === 1 && r[0].trim().length > 0));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s\-]+/g, '_');
}

export default function UploadSuppliersButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]);
    setFileName(null);
    setParseError(null);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onFile(list: FileList | null) {
    if (!list || list.length === 0) return;
    const f = list[0];
    setFileName(f.name);
    setParseError(null);
    try {
      const text = await f.text();
      const grid = parseCsv(text);
      if (grid.length < 2) {
        setParseError('CSV is empty or has no data rows.');
        setRows([]);
        return;
      }
      const headers = grid[0].map(normalizeHeader);
      const need = ['code', 'name', 'country'];
      const missing = need.filter(n => !headers.includes(n));
      if (missing.length) {
        setParseError(`Missing required column(s): ${missing.join(', ')}`);
        setRows([]);
        return;
      }
      const parsed: ParsedRow[] = grid.slice(1).map((r, i) => {
        const raw: Record<string, string> = {};
        headers.forEach((h, idx) => { raw[h] = (r[idx] ?? '').trim(); });
        return {
          rowIndex: i + 2,
          code: raw.code ?? '',
          name: raw.name ?? '',
          country: raw.country ?? '',
          raw,
          status: 'queued' as RowStatus,
        };
      }).filter(r => r.code.length > 0);
      setRows(parsed);
    } catch (e: any) {
      setParseError(`Failed to read file: ${e?.message ?? 'unknown'}`);
      setRows([]);
    }
  }

  async function uploadAll() {
    if (busy || rows.length === 0) return;
    setBusy(true);
    setRows(prev => prev.map(r => r.status === 'queued' ? { ...r, status: 'inserting' } : r));
    try {
      const payload = rows
        .filter(r => r.status === 'inserting' || r.status === 'queued')
        .map(r => r.raw);
      const resp = await fetch('/api/operations/suppliers/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suppliers: payload }),
      });
      const json: any = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = json?.error ?? `HTTP ${resp.status}`;
        setRows(prev => prev.map(r => r.status === 'inserting' ? { ...r, status: 'error', message: msg } : r));
      } else {
        const results: ApiResultRow[] = json?.results ?? [];
        const byCode = new Map<string, ApiResultRow>();
        results.forEach(rr => byCode.set(rr.code, rr));
        setRows(prev => prev.map(r => {
          const hit = byCode.get(r.code);
          if (!hit) return { ...r, status: 'error', message: 'No server response' };
          if (hit.ok) return { ...r, status: hit.action === 'skipped' ? 'skip' : 'ok', message: hit.message ?? hit.action ?? 'ok' };
          return { ...r, status: 'error', message: hit.message ?? 'Failed' };
        }));
      }
    } catch (e: any) {
      setRows(prev => prev.map(r => r.status === 'inserting' ? { ...r, status: 'error', message: e?.message ?? 'Network error' } : r));
    }
    setBusy(false);
    router.refresh();
  }

  const ok = rows.filter(r => r.status === 'ok').length;
  const skipped = rows.filter(r => r.status === 'skip').length;
  const err = rows.filter(r => r.status === 'error').length;
  const queued = rows.filter(r => r.status === 'queued' || r.status === 'inserting').length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm bg-emerald-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.10em] text-white hover:bg-emerald-800"
      >
        + Upload suppliers
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !busy) { setOpen(false); reset(); } }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-12"
        >
          <div className="w-full max-w-3xl rounded-md bg-white p-6 text-sm text-stone-800 shadow-xl">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-stone-900">
                Upload <em className="italic">suppliers</em>
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setOpen(false); reset(); }}
                className="text-xl text-stone-500 hover:text-stone-800 disabled:opacity-40"
              >×</button>
            </div>

            <div className="mb-4 rounded-sm border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-stone-500">Required CSV columns</div>
              <div className="font-mono">code, name, country</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-stone-500">Optional</div>
              <div className="font-mono">legal_name, supplier_type, city, province, address, distance_km, is_local_sourcing, email, phone, website, payment_terms_days, lead_time_days, currency, minimum_order_usd, minimum_order_lak, reliability_score, quality_score, sustainability_score, tax_id, bank_account, payment_terms, status, notes</div>
              <div className="mt-2 text-stone-500">Existing codes will be <strong>updated</strong> (upsert by code). is_local_sourcing accepts true/yes/1.</div>
            </div>

            <label className="mb-3 block cursor-pointer rounded-md border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center hover:bg-stone-100">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onFile(e.target.files)}
                className="hidden"
              />
              <div className="font-serif text-base italic text-stone-700">
                {fileName ? fileName : 'drop a CSV here or click to pick'}
              </div>
              <div className="mt-2 text-xs text-stone-500">
                One file at a time.
              </div>
            </label>

            {parseError && (
              <div className="mb-3 rounded-sm bg-rose-100 px-3 py-2 text-xs text-rose-800">
                {parseError}
              </div>
            )}

            {rows.length > 0 && (
              <div className="mb-3 max-h-72 overflow-y-auto rounded-sm border border-stone-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-stone-100 text-[10px] font-mono uppercase tracking-[0.12em] text-stone-500">
                    <tr>
                      <th className="px-2 py-1 text-right w-10">#</th>
                      <th className="px-2 py-1 text-left">Code</th>
                      <th className="px-2 py-1 text-left">Name</th>
                      <th className="px-2 py-1 text-left">Country</th>
                      <th className="px-2 py-1 text-left">Status</th>
                      <th className="px-2 py-1 text-left">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={`${r.rowIndex}-${r.code}`} className="border-t border-stone-100">
                        <td className="px-2 py-1 text-right font-mono text-stone-500">{r.rowIndex}</td>
                        <td className="px-2 py-1 font-mono">{r.code || '—'}</td>
                        <td className="px-2 py-1">{r.name || '—'}</td>
                        <td className="px-2 py-1 font-mono">{r.country || '—'}</td>
                        <td className="px-2 py-1">
                          <span className={
                            r.status === 'ok' ? 'rounded-sm bg-emerald-100 px-1.5 py-0.5 text-emerald-800' :
                            r.status === 'skip' ? 'rounded-sm bg-stone-100 px-1.5 py-0.5 text-stone-600' :
                            r.status === 'error' ? 'rounded-sm bg-rose-100 px-1.5 py-0.5 text-rose-800' :
                            r.status === 'inserting' ? 'rounded-sm bg-amber-100 px-1.5 py-0.5 text-amber-900' :
                            'rounded-sm bg-stone-100 px-1.5 py-0.5 text-stone-700'
                          }>{r.status}</span>
                        </td>
                        <td className="px-2 py-1 text-stone-600">{r.message ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-xs text-stone-600">
                {rows.length === 0
                  ? 'No file yet.'
                  : `${ok} ok · ${skipped} skip · ${err} error · ${queued} pending`}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setOpen(false); reset(); }}
                  className="rounded-sm border border-stone-300 px-3 py-1.5 text-xs uppercase tracking-[0.10em] text-stone-700 disabled:opacity-40"
                >Close</button>
                <button
                  type="button"
                  disabled={busy || rows.length === 0 || queued === 0}
                  onClick={uploadAll}
                  className="rounded-sm bg-emerald-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.10em] text-white hover:bg-emerald-800 disabled:opacity-40"
                >{busy ? 'Uploading…' : `Upload ${queued}`}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
