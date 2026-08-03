'use client';
// app/holding/it2/modules/findings/[module]/FindingsClient.tsx
// owner-findings-ui-v1 (ADR-218): findings list + add form + resolve controls.
// Client component (forms, toasts, uploads). Dates via iso.slice() — hydration law 712.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Finding = {
  id: number;
  module_doc_type: string;
  finding: string;
  severity: string | null;
  source: string | null;
  blocking: boolean | null;
  status: string | null;
  resolution_note: string | null;
  created_by: string | null;
  created_at: string | null;
  resolved_at: string | null;
  screenshot_ref: string | null;
};

const SEV: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#B71C1C', color: '#FFFFFF' },
  high:     { bg: '#FFEBEE', color: '#B71C1C' },
  medium:   { bg: '#FFF3E0', color: '#E65100' },
  low:      { bg: '#F4EFE2', color: '#5A5A5A' },
};

const STATUS_COLOR: Record<string, string> = {
  open: '#B71C1C', acknowledged: '#E65100', fixed: '#2E7D32', refuted: '#5A5A5A', waived: '#8A8A8A',
};

function d(iso: string | null): string {
  return iso ? iso.slice(0, 16).split('T').join(' ') : '—';
}

export default function FindingsClient({ module: moduleName, findings }: { module: string; findings: Finding[] }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [file, setFile] = useState<File | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);
  const [resStatus, setResStatus] = useState('fixed');
  const [resNote, setResNote] = useState('');

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  }

  async function addFinding(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('module', moduleName);
      fd.set('finding', text);
      fd.set('severity', severity);
      if (file) fd.set('screenshot', file);
      const res = await fetch('/api/holding/module-findings', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) { flash(j?.error ?? `HTTP ${res.status}`, false); return; }
      flash(`Finding #${j.id} filed`, true);
      setText(''); setFile(null); setSeverity('medium');
      router.refresh();
    } catch (err: any) {
      flash(err?.message ?? 'network error', false);
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/holding/module-findings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: resStatus, resolution_note: resNote, actor: 'it2-ui' }),
      });
      const j = await res.json();
      if (!res.ok) { flash(j?.error ?? `HTTP ${res.status}`, false); return; }
      flash(`Finding #${id} → ${resStatus}`, true);
      setResolving(null); setResNote('');
      router.refresh();
    } catch (err: any) {
      flash(err?.message ?? 'network error', false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '10px 16px', borderRadius: 6,
          background: toast.ok ? '#1F3A2E' : '#B71C1C', color: '#FFFFFF', fontSize: 12, fontWeight: 600,
          maxWidth: 420, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
          {toast.msg}
        </div>
      )}

      {/* Add-finding form */}
      <form onSubmit={addFinding} style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
        padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1B1B1B', letterSpacing: '0.04em' }}>FILE A FINDING</div>
        <textarea value={text} onChange={e => setText(e.target.value)} required minLength={5} rows={3}
          placeholder="What is wrong, in plain language. This blocks completion until resolved."
          style={{ fontSize: 12, padding: 8, border: '1px solid #E6DFCC', borderRadius: 4, resize: 'vertical',
            fontFamily: 'inherit', color: '#1B1B1B' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={severity} onChange={e => setSeverity(e.target.value)}
            style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #E6DFCC', borderRadius: 4, color: '#1B1B1B' }}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 11, color: '#5A5A5A' }} />
          <button type="submit" disabled={busy || text.trim().length < 5} style={{ marginLeft: 'auto', fontSize: 12,
            fontWeight: 700, padding: '8px 18px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: busy ? '#B8A878' : '#1F3A2E', color: '#FFFFFF' }}>
            {busy ? 'Saving…' : 'File finding'}
          </button>
        </div>
      </form>

      {/* Findings list */}
      {findings.length === 0 ? (
        <div style={{ fontSize: 12, color: '#8A8A8A', padding: '16px 0' }}>No findings for this module yet.</div>
      ) : findings.map(f => {
        const sev = SEV[f.severity ?? 'medium'] ?? SEV.medium;
        const stColor = STATUS_COLOR[f.status ?? 'open'] ?? '#5A5A5A';
        const isOpen = f.status === 'open' || f.status === 'acknowledged';
        return (
          <div key={f.id} style={{ background: '#FFFFFF', border: `1px solid ${isOpen && f.blocking ? '#B71C1C' : '#E6DFCC'}`,
            borderRadius: 6, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A' }}>#{f.id}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: sev.bg, color: sev.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {f.severity ?? 'medium'}
              </span>
              {f.blocking && isOpen && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  background: '#FFEBEE', color: '#B71C1C' }}>BLOCKING</span>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: stColor, textTransform: 'uppercase' }}>{f.status}</span>
              <span style={{ fontSize: 10, color: '#8A8A8A', marginLeft: 'auto' }}>
                {f.created_by ?? '—'} · {d(f.created_at)}{f.source ? ` · ${f.source}` : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#1B1B1B', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.finding}</div>
            {f.screenshot_ref && (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={f.screenshot_ref} target="_blank" rel="noreferrer">
                <img src={f.screenshot_ref} alt={`screenshot for finding ${f.id}`}
                  style={{ maxWidth: 260, maxHeight: 160, borderRadius: 4, border: '1px solid #E6DFCC', objectFit: 'cover' }} />
              </a>
            )}
            {f.resolution_note && (
              <div style={{ fontSize: 11, color: '#2E7D32', background: '#E8F5E9', borderRadius: 4, padding: '6px 10px' }}>
                Resolved {d(f.resolved_at)}: {f.resolution_note}
              </div>
            )}
            {isOpen && (
              resolving === f.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={resStatus} onChange={e => setResStatus(e.target.value)}
                    style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #E6DFCC', borderRadius: 4 }}>
                    <option value="fixed">fixed</option>
                    <option value="refuted">refuted</option>
                    <option value="waived">waived</option>
                    <option value="acknowledged">acknowledged</option>
                  </select>
                  <input value={resNote} onChange={e => setResNote(e.target.value)}
                    placeholder="Resolution note (mandatory)" style={{ flex: 1, minWidth: 200, fontSize: 11,
                      padding: '5px 8px', border: '1px solid #E6DFCC', borderRadius: 4 }} />
                  <button onClick={() => resolve(f.id)} disabled={busy} style={{ fontSize: 11, fontWeight: 700,
                    padding: '6px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: '#1F3A2E', color: '#FFFFFF' }}>Save</button>
                  <button onClick={() => setResolving(null)} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px',
                    borderRadius: 4, border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#5A5A5A', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => { setResolving(f.id); setResStatus('fixed'); setResNote(''); }}
                  style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 4,
                    border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#1B1B1B', cursor: 'pointer' }}>
                  Resolve…
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
