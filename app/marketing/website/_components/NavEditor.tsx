'use client';
// app/marketing/website/_components/NavEditor.tsx
// website_module-owner-findings-v1 work-order item 1 — header nav menu editor.
// Self-loading: GET /api/website/nav on mount, POST /api/website/nav on save.
// The preview site (preview/[...slug]) renders SiteNav from the same
// website.nav_menus row, so a save here changes the rendered nav.
import { useEffect, useState } from 'react';

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A';
const GREEN = '#2E7D32'; const RED = '#B8542A'; const BG = '#F4EFE2';

const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 12.5, color: INK, borderBottom: `1px solid ${HAIR}`, verticalAlign: 'middle' };
const head: React.CSSProperties = { ...cell, color: INK_M, fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4, background: BG };
const input: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 13, border: `1px solid ${HAIR}`, borderRadius: 4, color: INK, background: '#FFFFFF', boxSizing: 'border-box' };
const btn: React.CSSProperties = { padding: '7px 14px', fontSize: 12.5, fontWeight: 600, border: `1px solid ${HAIR}`, borderRadius: 4, background: '#FFFFFF', color: INK, cursor: 'pointer' };
const btnSm: React.CSSProperties = { ...btn, fontSize: 11.5, padding: '3px 8px' };

export type NavItem = { label: string; href: string };

export default function NavEditor() {
  const [items, setItems] = useState<NavItem[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/website/nav');
        if (!r.ok) throw new Error(`${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        setItems((j.menu?.items as NavItem[] | undefined) ?? []);
        setUpdatedAt(j.menu?.updated_at ?? null);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setMsg({ kind: 'err', text: `Load nav failed: ${e}` });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function patch(idx: number, field: keyof NavItem, value: string) {
    setItems((prev) => (prev ? prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) : prev));
    setDirty(true);
  }

  function move(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      if (!prev) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    setDirty(true);
  }

  function remove(idx: number) {
    setItems((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
    setDirty(true);
  }

  function add() {
    setItems((prev) => [...(prev ?? []), { label: '', href: '/' }]);
    setDirty(true);
  }

  async function save() {
    if (!items) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/website/nav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `${r.status}`);
      setItems((j.menu?.items as NavItem[] | undefined) ?? items);
      setUpdatedAt(j.menu?.updated_at ?? null);
      setDirty(false);
      setMsg({ kind: 'ok', text: 'Nav saved — reload the preview site to see it' });
    } catch (e) {
      setMsg({ kind: 'err', text: `Save failed: ${e}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details style={{ margin: '0 20px 30px', color: INK, fontFamily: 'system-ui, sans-serif' }}>
      <summary style={{ fontSize: 14, fontWeight: 600, color: INK_M, cursor: 'pointer', marginBottom: 10 }}>
        Header Navigation ({items?.length ?? '…'})
      </summary>

      {msg && (
        <div style={{ padding: 10, marginBottom: 12, fontSize: 13, borderRadius: 4, background: msg.kind === 'ok' ? '#E8F5E9' : '#FFEBEE', color: msg.kind === 'ok' ? GREEN : RED }}>
          {msg.text}
        </div>
      )}

      {items === null ? (
        <div style={{ fontSize: 13, color: INK_M }}>Loading nav…</div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={{ ...head, width: '30%' }}>Label</th>
                <th style={head}>Path</th>
                <th style={{ ...head, width: 150 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td style={cell} colSpan={3}>
                    <span style={{ color: INK_M }}>No nav items — the site falls back to the built-in default menu. Add items to take control.</span>
                  </td>
                </tr>
              )}
              {items.map((it, idx) => (
                <tr key={idx} style={{ background: '#FFFFFF' }}>
                  <td style={cell}>
                    <input type="text" value={it.label} placeholder="Label" onChange={(e) => patch(idx, 'label', e.target.value)} style={input} />
                  </td>
                  <td style={cell}>
                    <input type="text" value={it.href} placeholder="/path" onChange={(e) => patch(idx, 'href', e.target.value)} style={input} />
                  </td>
                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} style={btnSm} title="Move up">↑</button>
                    <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} style={{ ...btnSm, marginLeft: 4 }} title="Move down">↓</button>
                    <button onClick={() => remove(idx)} style={{ ...btnSm, marginLeft: 4, color: RED }} title="Remove">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={add} style={btn}>+ Add item</button>
            <button onClick={save} disabled={busy || !dirty} style={{ ...btn, background: dirty ? GREEN : '#FFFFFF', color: dirty ? '#FFFFFF' : INK_M, borderColor: dirty ? GREEN : HAIR }}>
              {busy ? 'Saving…' : 'Save nav'}
            </button>
            <span style={{ fontSize: 11.5, color: INK_M }}>
              {updatedAt ? `Last saved ${String(updatedAt).replace('T', ' ').slice(0, 16)}` : 'Never saved'}
              {dirty ? ' · unsaved changes' : ''}
            </span>
          </div>
        </>
      )}
    </details>
  );
}
