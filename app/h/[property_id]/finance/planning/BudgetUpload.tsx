'use client';

// FP&C Module v1 — budget xlsx upload (A2). Mirrors the legacy BudgetUpload
// pattern: FormData POST, per-row named errors, template download.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  propertyId: number;
  latestVersion: number | null;
  latestVersionAt: string | null;
}

export default function BudgetUpload({ propertyId, latestVersion, latestVersionAt }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; errors?: string[] } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('property_id', String(propertyId));
      const res = await fetch('/api/finance/planning/budget-import', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, msg: json?.error || `HTTP ${res.status}`, errors: json?.parse_errors });
      } else {
        setResult({ ok: true, msg: `Loaded ${json.rows_inserted} rows as budget version ${json.version} (${json.source_file}).` });
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'upload failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <a
          href={`/api/finance/planning/budget-import?property_id=${propertyId}`}
          download
          style={{ fontSize: 13, textDecoration: 'underline', color: 'var(--primary)' }}
        >
          Download xlsx template (12 months × valid classes)
        </a>
        <input
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ fontSize: 13 }}
        />
        <button
          type="button"
          disabled={!file || busy}
          onClick={handleUpload}
          style={{
            padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: !file || busy ? 'default' : 'pointer',
            background: 'var(--primary)', color: 'var(--paper)', border: 'none', borderRadius: 6,
            opacity: !file || busy ? 0.5 : 1,
          }}
        >
          {busy ? 'Importing…' : 'Import budget'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
        Current budget: {latestVersion == null ? 'none loaded' : `version ${latestVersion}${latestVersionAt ? ` · ${new Date(latestVersionAt).toLocaleString('en-GB')}` : ''}`}
        {' '}· Required columns: <code>year_month, gl_class, amount_usd</code> · Versioned append-forward — imports never overwrite prior versions.
      </div>
      {result && (
        <div style={{ fontSize: 13, color: result.ok ? 'var(--status-green)' : 'var(--status-red)' }}>
          {result.ok ? '✓ ' : '✗ '}{result.msg}
          {result.errors && result.errors.length > 0 && (
            <ul style={{ margin: '8px 0 0 16px', color: 'var(--status-red)' }}>
              {result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
              {result.errors.length > 20 && <li>… {result.errors.length - 20} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
