// app/revenue/_components/ShortcutsPanel.tsx
// PBS 2026-07-08 v2: replaces Attention on every HoD landing.
// Curated dropdown of that dept's subpages · pin any of them to the HoD landing.
// Accepts a `subpages` prop so the SAME panel works on Revenue / Guest / Finance / Sales / Marketing / Ops.

'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { SUBPAGES_BY_DEPT, type SubpageOption } from '@/app/_components/hod_subpages_catalog';

export interface Shortcut { id: number; label: string; href: string }

export default function ShortcutsPanel({
  initial, propertyId, deptSlug = 'revenue', userEmail = 'pbsbase@gmail.com',
  subpages,
}: {
  initial: Shortcut[];
  propertyId: number;
  deptSlug?: string;
  userEmail?: string;
  /** Override the default catalog for this dept. Falls back to SUBPAGES_BY_DEPT[deptSlug]. */
  subpages?: SubpageOption[];
}) {
  const catalog: SubpageOption[] = subpages ?? SUBPAGES_BY_DEPT[deptSlug] ?? SUBPAGES_BY_DEPT.revenue;
  const [items, setItems] = useState<Shortcut[]>(initial);
  const [picked, setPicked] = useState<string>(catalog[0]?.href ?? '');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const submit = () => {
    const opt = catalog.find((o) => o.href === picked);
    if (!opt) return;
    const label = opt.label;
    const href  = opt.href;
    if (items.some((s) => s.href === href)) { setMsg('already pinned'); setTimeout(() => setMsg(null), 2000); return; }
    startTransition(async () => {
      try {
        const r = await fetch('/api/shortcuts/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: propertyId, dept_slug: deptSlug, user_email: userEmail, label, href, kind: 'internal' }),
        });
        if (!r.ok) throw new Error(`add failed (${r.status})`);
        const { id } = await r.json();
        setItems((arr) => [...arr, { id, label, href }]);
      } catch (e) { setMsg(`✗ ${(e as Error).message}`); }
    });
  };

  const remove = (id: number) => startTransition(async () => {
    try {
      const r = await fetch('/api/shortcuts/remove', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!r.ok) throw new Error(`remove failed (${r.status})`);
      setItems((arr) => arr.filter((x) => x.id !== id));
    } catch (e) { setMsg(`✗ ${(e as Error).message}`); }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.length === 0 && (
        <div style={{ fontSize: 11, color: '#5A5A5A', fontStyle: 'italic', padding: '4px 0' }}>
          No shortcuts yet. Pick any {deptSlug} subpage below and Pin.
        </div>
      )}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {items.map((s) => (
            <span key={s.id} style={chipStyle}>
              <a href={s.href} style={{ color: '#084838', textDecoration: 'none', fontWeight: 600 }}>{s.label}</a>
              <button type="button" onClick={() => remove(s.id)} disabled={pending}
                      style={{ padding: '0 2px 0 6px', border: 'none', background: 'transparent', color: '#5A5A5A', cursor: 'pointer', fontSize: 12 }}
                      aria-label={`remove ${s.label}`}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <select value={picked} onChange={(e) => setPicked(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          {catalog.map((o) => (
            <option key={o.href} value={o.href}>{o.label}</option>
          ))}
        </select>
        <button type="button" onClick={submit} disabled={pending || !picked} style={btnStyle}>
          {pending ? '…' : '+ Pin'}
        </button>
      </div>
      {msg && <div style={{ fontSize: 11, color: '#B04A2F' }}>{msg}</div>}
    </div>
  );
}

const chipStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 4px 3px 10px', background: '#FAFAF7', border: '1px solid #E6DFCC',
  borderRadius: 999, fontSize: 11,
};
const inputStyle: CSSProperties = {
  padding: '3px 6px', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 11,
  background: '#FFFFFF', color: '#1B1B1B', fontFamily: 'inherit',
};
const btnStyle: CSSProperties = {
  padding: '3px 10px', border: '1px solid #084838', background: '#084838', color: '#FFFFFF',
  borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
