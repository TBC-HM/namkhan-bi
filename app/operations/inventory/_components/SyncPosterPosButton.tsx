'use client';

// app/operations/inventory/_components/SyncPosterPosButton.tsx
// Pulls every distinct PRODUCT actually sold (per public.transactions, the
// Poster POS feed flowing through Cloudbeds) into inv.items as POS-* SKUs.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SyncResult {
  ok: boolean;
  summary?: { fetched: number; mapped: number; inserted: number; updated: number; failed: number };
  error?: string;
}

export default function SyncPosterPosButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [minLines, setMinLines] = useState(2);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function runSync() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const resp = await fetch('/api/operations/inventory/sync-poster-pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minLines }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) setResult({ ok: false, error: json?.error ?? `HTTP ${resp.status}` });
      else setResult(json);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? 'Network error' });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm border border-emerald-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.10em] text-emerald-900 hover:bg-emerald-900 hover:text-white"
        style={{ marginRight: 8 }}
      >
        ⇣ Sync Poster POS
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !busy) { setOpen(false); setResult(null); } }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-12"
        >
          <div className="w-full max-w-xl rounded-md bg-white p-6 text-sm text-stone-800 shadow-xl">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-stone-900">
                Sync from <em className="italic">Poster POS</em>
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setOpen(false); setResult(null); }}
                className="text-xl text-stone-500 hover:text-stone-800 disabled:opacity-40"
              >×</button>
            </div>

            <div className="mb-4 rounded-sm border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
              <div>Pulls every distinct product actually sold from <code className="font-mono">public.transactions</code> (the Poster POS feed flowing into Cloudbeds) into <code className="font-mono">inv.items</code>.</div>
              <div className="mt-1">Excludes tax / fee / payment / room rate lines automatically. SKU pattern: <code className="font-mono">POS-&lt;hash&gt;</code>. Re-runnable; upserts.</div>
              <div className="mt-1 text-stone-500">Last cost defaults to average sale price across all historic transactions for that product.</div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-mono uppercase tracking-[0.16em] text-stone-500">Min txn lines per product</label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={minLines}
                  onChange={(e) => setMinLines(Math.max(1, Number(e.target.value) || 2))}
                  className="w-20 rounded-sm border border-stone-300 px-2 py-1 text-sm font-mono"
                />
                <span className="text-xs text-stone-500">Skip products sold fewer than N times. Use 1 to include single-sales.</span>
              </div>
            </div>

            {result && (
              <div className={`mb-3 rounded-sm px-3 py-2 text-xs ${result.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-100 text-rose-800'}`}>
                {result.ok && result.summary ? (
                  <div>
                    <div className="font-semibold">Sync complete.</div>
                    <div className="mt-1 font-mono">
                      {result.summary.fetched} distinct · {result.summary.mapped} mapped · {result.summary.inserted} new · {result.summary.updated} updated · {result.summary.failed} failed
                    </div>
                  </div>
                ) : (
                  <div>{result.error ?? 'Sync failed.'}</div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => { setOpen(false); setResult(null); }}
                className="rounded-sm border border-stone-300 px-3 py-1.5 text-xs uppercase tracking-[0.10em] text-stone-700 disabled:opacity-40"
              >Close</button>
              <button
                type="button"
                disabled={busy}
                onClick={runSync}
                className="rounded-sm bg-emerald-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.10em] text-white hover:bg-emerald-800 disabled:opacity-40"
              >{busy ? 'Syncing…' : 'Run sync'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
