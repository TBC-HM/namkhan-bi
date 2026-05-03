'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  lastUploadAt: string | null;
}

export default function BudgetUpload({ lastUploadAt }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; details?: any } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/finance/budget/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, msg: json?.error || `HTTP ${res.status}`, details: json });
      } else {
        setResult({ ok: true, msg: `Uploaded ${json.rows_upserted} rows from ${json.source_file || 'file'}.`, details: json });
        startTransition(() => router.refresh());
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message ?? 'upload failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="upload-block">
      <h2>Upload CSV</h2>
      <div className="upload-row">
        <a href="/api/finance/budget/upload" className="btn-secondary" download>
          Download template (12 months × 14 USALI subcats)
        </a>
        <input type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" className="btn-primary" disabled={!file || busy} onClick={handleUpload}>
          {busy ? 'Uploading…' : 'Upload to gl.budgets'}
        </button>
      </div>
      <div className="meta-line">
        Last upload: {lastUploadAt ? new Date(lastUploadAt).toLocaleString('en-GB') : 'never'} ·
        Required header: <code>period_yyyymm,usali_subcategory,usali_department,amount_usd</code> ·
        usali_department is optional (leave blank for undistributed lines).
      </div>
      {result && (
        <div className={`result ${result.ok ? 'ok' : 'err'}`}>
          {result.ok ? '✓ ' : '✗ '}{result.msg}
          {result.details?.parse_errors && result.details.parse_errors.length > 0 && (
            <ul className="errors">
              {result.details.parse_errors.slice(0, 10).map((e: string, i: number) => <li key={i}>{e}</li>)}
              {result.details.parse_errors.length > 10 && <li>…and {result.details.parse_errors.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}
      <style>{`
        .upload-block { margin: 16px 0; padding: 16px; background: var(--surf-2, #f5f1e7); border: 1px solid var(--line, #e7e2d8); border-radius: 8px; }
        .upload-block h2 { font-family: var(--font-display); font-weight: 500; font-size: 18px; margin-bottom: 12px; }
        .upload-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .btn-primary { padding: 8px 16px; background: var(--green-2, #2e4a36); color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: 500; }
        .btn-primary:hover { background: var(--green-1, #1f3526); }
        .btn-primary:disabled { background: var(--ink-mute, #8a8170); cursor: not-allowed; }
        .btn-secondary { padding: 8px 14px; background: #fff; color: var(--green-2); border: 1px solid var(--line); border-radius: 4px; font-size: 13px; text-decoration: none; }
        .btn-secondary:hover { background: var(--surf-hover, #faf7ee); }
        input[type=file] { font-size: 13px; }
        .meta-line { font-size: 11px; color: var(--ink-mute, #8a8170); margin-top: 4px; }
        .meta-line code { background: rgba(0,0,0,.04); padding: 1px 5px; border-radius: 3px; font-size: 10px; }
        .result { margin-top: 12px; padding: 10px 14px; border-radius: 4px; font-size: 13px; }
        .result.ok { background: rgba(46, 74, 54, .1); color: var(--green-2); }
        .result.err { background: rgba(180, 70, 70, .1); color: #b34939; }
        .errors { margin: 8px 0 0 16px; font-size: 12px; }
      `}</style>
    </section>
  );
}
