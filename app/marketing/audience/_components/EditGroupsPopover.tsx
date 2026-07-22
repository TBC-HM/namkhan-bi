'use client';
// app/marketing/audience/_components/EditGroupsPopover.tsx
// PBS 2026-07-21 · Compact per-row group editor.
// Pencil icon opens a popover with checkboxes for each existing group.
// Save → POST /api/marketing/audience/subscriber-groups-set → fn_subscriber_groups_set RPC.
// Only supported for subscriber rows (prospects have no membership table yet).

import { useEffect, useRef, useState } from 'react';
import type { GroupRow } from './AudienceUnifiedClient';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const BRAND = '#084838';
const WARM  = '#F5F0E1';

interface Props {
  subscriberId: number;
  currentSlugs: string[];
  groups: GroupRow[];
  onSaved: (newSlugs: string[]) => void;
}

export default function EditGroupsPopover({ subscriberId, currentSlugs, groups, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(currentSlugs));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Reset selection when the popover opens or currentSlugs change.
  useEffect(() => { setSelected(new Set(currentSlugs)); setErr(null); }, [currentSlugs, open]);

  // Click-outside close.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(slug)) n.delete(slug); else n.add(slug);
      return n;
    });
  };

  const save = async () => {
    setSaving(true); setErr(null);
    const chosen = groups.filter((g) => selected.has(g.slug));
    const ids = chosen.map((g) => g.id);
    try {
      const r = await fetch('/api/marketing/audience/subscriber-groups-set', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscriber_id: subscriberId, group_ids: ids }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setErr(j?.error ?? r.statusText);
        setSaving(false);
        return;
      }
      onSaved(chosen.map((g) => g.slug));
      setOpen(false);
    } catch (e) {
      setErr((e as Error).message ?? 'save_failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Edit groups"
        aria-label="Edit groups"
        style={{
          padding: '3px 8px', background: WHITE, color: INK_S,
          border: `1px solid ${HAIR}`, borderRadius: 3, fontSize: 11, cursor: 'pointer',
        }}
      >&#9998;</button>
      {open && (
        <div
          role="dialog"
          aria-label="Edit groups"
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20,
            background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4,
            padding: 8, minWidth: 220, maxHeight: 320, overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ fontSize: 10, color: INK_S, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            Groups
          </div>
          {groups.length === 0 && (
            <div style={{ fontSize: 11, color: INK_S }}>No groups defined.</div>
          )}
          {groups.map((g) => {
            const on = selected.has(g.slug);
            return (
              <label key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px',
                fontSize: 12, color: INK, cursor: 'pointer',
                background: on ? WARM : 'transparent', borderRadius: 2,
              }}>
                <input type="checkbox" checked={on} onChange={() => toggle(g.slug)} />
                <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, display: 'inline-block' }} />
                <span style={{ flex: 1 }}>{g.name}</span>
              </label>
            );
          })}
          {err && <div style={{ marginTop: 6, fontSize: 11, color: '#B03826' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: '4px 10px', background: WHITE, color: INK_S,
                border: `1px solid ${HAIR}`, borderRadius: 3, fontSize: 11, cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              onClick={save} disabled={saving}
              style={{
                padding: '4px 10px', background: BRAND, color: WHITE,
                border: `1px solid ${BRAND}`, borderRadius: 3, fontSize: 11,
                cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
