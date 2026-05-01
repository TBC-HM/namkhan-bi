'use client';

// app/operations/staff/_components/UploadPayslipsButton.tsx
// Header-mounted button on /operations/staff. Opens a modal that lets the
// owner drop a batch of PDFs at once. Filenames are parsed
// (TNK_<id>_<YYYY-MM>_<kind>.pdf) and matched to active staff.
//
// Each file is POSTed individually to /api/operations/staff/payslip so per-file
// success/failure surfaces inline.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type FileStatus = 'queued' | 'uploading' | 'ok' | 'error';

interface QueueItem {
  id: string;
  name: string;
  size: number;
  file: File;
  status: FileStatus;
  message?: string;
}

function defaultPeriod(): string {
  // last closed month, YYYY-MM
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function UploadPayslipsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [period, setPeriod] = useState(defaultPeriod());
  const [kind, setKind] = useState<string>('payslip');
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setItems([]);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onFiles(list: FileList | null) {
    if (!list) return;
    const next: QueueItem[] = Array.from(list).map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      size: f.size,
      file: f,
      status: 'queued',
    }));
    setItems(prev => [...prev, ...next]);
  }

  async function uploadAll() {
    if (busy || items.length === 0) return;
    setBusy(true);
    for (const it of items) {
      if (it.status === 'ok') continue;
      setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'uploading', message: undefined } : p));
      try {
        const fd = new FormData();
        fd.append('file', it.file);
        // Apply form-level overrides for files that don't match the filename pattern
        fd.append('period', period);
        fd.append('hr_doc_kind', kind);
        const resp = await fetch('/api/operations/staff/payslip', { method: 'POST', body: fd });
        const json: any = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'error', message: json?.error ?? `HTTP ${resp.status}` } : p));
          continue;
        }
        const r = (json?.results ?? [])[0] ?? {};
        if (r.ok) {
          setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'ok', message: `${r.emp_id ?? r.staff_id?.slice(0,8) ?? '?'} · ${r.period?.slice(0,7) ?? '?'}` } : p));
        } else {
          setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'error', message: r.error ?? 'Upload failed' } : p));
        }
      } catch (e: any) {
        setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'error', message: e?.message ?? 'Network error' } : p));
      }
    }
    setBusy(false);
    router.refresh();
  }

  const successCount = items.filter(i => i.status === 'ok').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const queuedCount = items.filter(i => i.status === 'queued' || i.status === 'uploading').length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm bg-emerald-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.10em] text-white hover:bg-emerald-800"
      >
        + Upload payslips
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !busy) { setOpen(false); reset(); } }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-12"
        >
          <div className="w-full max-w-3xl rounded-md bg-white p-6 text-sm text-stone-800 shadow-xl">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-stone-900">
                Upload <em className="italic">payslips</em>
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setOpen(false); reset(); }}
                className="text-xl text-stone-500 hover:text-stone-800 disabled:opacity-40"
              >×</button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.16em] text-stone-500">Period</label>
                <input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.16em] text-stone-500">Document type</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm"
                >
                  <option value="payslip">Payslip</option>
                  <option value="contract">Contract</option>
                  <option value="id_copy">ID copy</option>
                  <option value="tax_form">Tax form</option>
                  <option value="work_permit">Visa / work permit</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <label className="mb-3 block cursor-pointer rounded-md border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center hover:bg-stone-100">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => onFiles(e.target.files)}
                className="hidden"
              />
              <div className="font-serif text-base italic text-stone-700">drop PDFs here or click to pick</div>
              <div className="mt-2 text-xs text-stone-500">
                Filename pattern <code className="font-mono">TNK_&lt;id&gt;_YYYY-MM_&lt;kind&gt;.pdf</code> auto-matches to staff.
                <br />Files that don't match the pattern use the Period + Document type selected above (and need a single staff_id — coming next deploy).
              </div>
            </label>

            {items.length > 0 && (
              <div className="mb-3 max-h-72 overflow-y-auto rounded-sm border border-stone-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-stone-100 text-[10px] font-mono uppercase tracking-[0.12em] text-stone-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Filename</th>
                      <th className="px-2 py-1 text-right">Size</th>
                      <th className="px-2 py-1 text-left">Status</th>
                      <th className="px-2 py-1 text-left">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.id} className="border-t border-stone-100">
                        <td className="px-2 py-1 font-mono">{i.name}</td>
                        <td className="px-2 py-1 text-right font-mono">{(i.size / 1e6).toFixed(2)} MB</td>
                        <td className="px-2 py-1">
                          <span className={
                            i.status === 'ok' ? 'rounded-sm bg-emerald-100 px-1.5 py-0.5 text-emerald-800' :
                            i.status === 'error' ? 'rounded-sm bg-rose-100 px-1.5 py-0.5 text-rose-800' :
                            i.status === 'uploading' ? 'rounded-sm bg-amber-100 px-1.5 py-0.5 text-amber-900' :
                            'rounded-sm bg-stone-100 px-1.5 py-0.5 text-stone-700'
                          }>{i.status}</span>
                        </td>
                        <td className="px-2 py-1 text-stone-600">{i.message ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-xs text-stone-600">
                {items.length === 0 ? 'No files yet.' : `${successCount} ok · ${errorCount} error · ${queuedCount} queued`}
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
                  disabled={busy || items.length === 0 || queuedCount === 0}
                  onClick={uploadAll}
                  className="rounded-sm bg-emerald-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.10em] text-white hover:bg-emerald-800 disabled:opacity-40"
                >{busy ? 'Uploading…' : `Upload ${queuedCount}`}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
