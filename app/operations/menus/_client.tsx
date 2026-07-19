'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode, type CSSProperties } from 'react';

const ENDPOINT = '/api/operations/menus';

export function ActBtn({ op, params, children, style }: { op: string; params?: any; children: ReactNode; style?: CSSProperties }) {
  const r = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} style={style} onClick={async () => {
      setBusy(true);
      try { await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, ...(params || {}) }) }); } catch (_) {}
      setBusy(false);
      r.refresh();
    }}>{busy ? '…' : children}</button>
  );
}

export function ActForm({ op, params, children, style }: { op: string; params?: any; children: ReactNode; style?: CSSProperties }) {
  const r = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <form style={style} onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const body: any = { op, ...(params || {}) };
      fd.forEach((v, k) => { body[k] = v; });
      setBusy(true);
      try { await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (_) {}
      setBusy(false);
      form.reset();
      r.refresh();
    }}>{busy ? <span style={{ fontSize: 12, color: '#5A5A5A' }}>working…</span> : children}</form>
  );
}
