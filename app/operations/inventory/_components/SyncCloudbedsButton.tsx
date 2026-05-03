'use client';

// app/operations/inventory/_components/SyncCloudbedsButton.tsx
// Pulls "products we sell" from public.items (Cloudbeds-synced) into inv.items
// via POST /api/operations/inventory/sync-cloudbeds.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CB_CATEGORIES = [
  { code: 'Nk F&B',                label: 'F&B', tangible: true,  hint: '~144 items' },
  { code: 'NK Retail',             label: 'Retail', tangible: true, hint: '~81 items' },
  { code: 'NK other Room Related', label: 'Room amenities', tangible: true, hint: '~19 items' },
  { code: 'The I Mekong',          label: 'I-Mekong outlet', tangible: true, hint: '~17 items' },
  { code: 'Farm products',         label: 'Farm products', tangible: true,  hint: '~1 item' },
  { code: 'Minibar',               label: 'Minibar', tangible: true, hint: '~0 items' },
  { code: 'Nk Spa',                label: 'Spa services', tangible: false, hint: '~39 items (services)' },
  { code: 'NK Activities',         label: 'Activities', tangible: false, hint: '~48 items (services)' },
  { code: 'Nk Pacs (Retreats)',    label: 'Retreat packages', tangible: false, hint: '~25 packages' },
  { code: 'Nk  Pacs (Day)',        label: 'Day packages', tangible: false, hint: '~11 packages' },
  { code: 'Nk Resale 3rd Party',   label: '3rd party resale', tangible: false, hint: '~25 items' },
  { code: 'Nk Transportation',     label: 'Transportation', tangible: false, hint: '~19 items' },
  { code: 'NK Fees',               label: 'Fees', tangible: false, hint: '~7 items' },
];

interface SyncResult {
  ok: boolean;
  summary?: { fetched: number; skipped: number; inserted: number; updated: number; failed: number };
  error?: string;
}

export default function SyncCloudbedsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(CB_CATEGORIES.filter(c => c.tangible).map(c => c.code)));
  const [result, setResult] = useState<SyncResult | null>(null);

  function toggle(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  }

  async function runSync() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const resp = await fetch('/api/operations/inventory/sync-cloudbeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: Array.from(selected), onlyTangible: false }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setResult({ ok: false, error: json?.error ?? `HTTP ${resp.status}` });
      } else {
        setResult(json);
      }
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
        ⇣ Sync from Cloudbeds
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !busy) { setOpen(false); setResult(null); } }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-12"
        >
          <div className="w-full max-w-2xl rounded-md bg-white p-6 text-sm text-stone-800 shadow-xl">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-stone-900">
                Sync from <em className="italic">Cloudbeds POS</em>
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setOpen(false); setResult(null); }}
                className="text-xl text-stone-500 hover:text-stone-800 disabled:opacity-40"
              >×</button>
            </div>

            <div className="mb-4 rounded-sm border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
              <div>Cloudbeds POS items live-sync to <code className="font-mono">public.items</code> via the existing <code className="font-mono">sync-cloudbeds</code> Edge Function. This sync mirrors selected categories into <code className="font-mono">inv.items</code> so they appear in the catalog.</div>
              <div className="mt-1">SKU pattern: <code className="font-mono">CB-{`{cloudbeds_item_id}`}</code>. Re-running this sync upserts; it never deletes.</div>
              <div className="mt-1 text-stone-500">Note: Cloudbeds <code className="font-mono">unit_price</code> is the SALE price, used here as a stand-in for cost. Replace via CSV upload once you have real cost data.</div>
            </div>

            <div className="mb-3">
              <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.16em] text-stone-500">Tangible / stockable (recommended)</div>
              <div className="grid grid-cols-2 gap-2">
                {CB_CATEGORIES.filter(c => c.tangible).map(c => (
                  <label key={c.code} className="flex items-center gap-2 rounded-sm border border-stone-200 px-3 py-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.has(c.code)}
                      onChange={() => toggle(c.code)}
                    />
                    <span className="flex-1">{c.label}</span>
                    <span className="font-mono text-[10px] text-stone-400">{c.hint}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 mb-2 text-[10px] font-mono uppercase tracking-[0.16em] text-stone-500">Services & packages (optional)</div>
              <div className="grid grid-cols-2 gap-2">
                {CB_CATEGORIES.filter(c => !c.tangible).map(c => (
                  <label key={c.code} className="flex items-center gap-2 rounded-sm border border-stone-200 px-3 py-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.has(c.code)}
                      onChange={() => toggle(c.code)}
                    />
                    <span className="flex-1">{c.label}</span>
                    <span className="font-mono text-[10px] text-stone-400">{c.hint}</span>
                  </label>
                ))}
              </div>
            </div>

            {result && (
              <div className={`mb-3 rounded-sm px-3 py-2 text-xs ${result.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-100 text-rose-800'}`}>
                {result.ok && result.summary ? (
                  <div>
                    <div className="font-semibold">Sync complete.</div>
                    <div className="mt-1 font-mono">
                      {result.summary.fetched} fetched · {result.summary.skipped} skipped (filter) · {result.summary.inserted} inserted · {result.summary.updated} updated · {result.summary.failed} failed
                    </div>
                  </div>
                ) : (
                  <div>{result.error ?? 'Sync failed.'}</div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-xs text-stone-500">{selected.size} categor{selected.size === 1 ? 'y' : 'ies'} selected</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setOpen(false); setResult(null); }}
                  className="rounded-sm border border-stone-300 px-3 py-1.5 text-xs uppercase tracking-[0.10em] text-stone-700 disabled:opacity-40"
                >Close</button>
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  onClick={runSync}
                  className="rounded-sm bg-emerald-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.10em] text-white hover:bg-emerald-800 disabled:opacity-40"
                >{busy ? 'Syncing…' : 'Run sync'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
