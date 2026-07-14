// app/marketing/media/_client/BulkSelectBar.tsx
// PBS 2026-07-14 · #203 — Sticky bulk-actions bar. Shown when >0 photos selected.
// Actions: Assign to Room / Facility / Activity / property_area · Set tier · Clear taxonomy · Delete.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface BulkOption { id: number | string; name: string; }

interface Props {
  selectedIds: string[];
  onClear: () => void;
  rooms: BulkOption[];
  facilities: BulkOption[];
  activities: BulkOption[];
  areaChoices: string[];
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B23A2E';
const CREAM  = '#FFF9EA';

const TIERS = [
  { k: 'tier_ota_profile',  label: 'OTA' },
  { k: 'tier_website_hero', label: 'Website' },
  { k: 'tier_social_pool',  label: 'Social' },
  { k: 'tier_internal',     label: 'Internal' },
  { k: 'tier_logos',        label: 'Logos' },
  { k: 'tier_archive',      label: 'Archive' },
];

export default function BulkSelectBar({ selectedIds, onClear, rooms, facilities, activities, areaChoices }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<'room'|'facility'|'activity'|'area'|'tier'|null>(null);

  if (selectedIds.length === 0) return null;

  async function submit(payload: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/bulk-assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_ids: selectedIds, ...payload }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error ?? 'failed');
      setMsg(`Updated ${j.updated} photo${j.updated === 1 ? '' : 's'}`);
      onClear();
      router.refresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setMsg('Failed: ' + err);
    } finally { setBusy(false); setOpenMenu(null); }
  }

  return (
    <div style={{
      position: 'sticky', top: 12, zIndex: 20,
      background: CREAM, border: '1px solid ' + HAIR, borderRadius: 6, padding: '10px 14px',
      marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>
        {selectedIds.length} photo{selectedIds.length === 1 ? '' : 's'} selected
      </span>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpenMenu(openMenu === 'room' ? null : 'room')} disabled={busy} style={btn}>
          Assign to Room ▾
        </button>
        {openMenu === 'room' && (
          <div style={menu}>
            {rooms.map(r => (
              <button key={'r-'+r.id} onClick={() => submit({ kind: 'room', ref_id: r.id })} style={menuItem}>{r.name}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpenMenu(openMenu === 'facility' ? null : 'facility')} disabled={busy} style={btn}>
          Assign to Facility ▾
        </button>
        {openMenu === 'facility' && (
          <div style={menu}>
            {facilities.map(f => (
              <button key={'f-'+f.id} onClick={() => submit({ kind: 'facility', ref_id: f.id })} style={menuItem}>{f.name}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpenMenu(openMenu === 'activity' ? null : 'activity')} disabled={busy} style={btn}>
          Assign to Activity ▾
        </button>
        {openMenu === 'activity' && (
          <div style={menu}>
            {activities.map(a => (
              <button key={'a-'+a.id} onClick={() => submit({ kind: 'activity', ref_id: a.id })} style={menuItem}>{a.name}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpenMenu(openMenu === 'area' ? null : 'area')} disabled={busy} style={btn}>
          Set property_area ▾
        </button>
        {openMenu === 'area' && (
          <div style={menu}>
            {areaChoices.map(a => (
              <button key={'ar-'+a} onClick={() => submit({ kind: 'property_area', property_area: a })} style={menuItem}>{a}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpenMenu(openMenu === 'tier' ? null : 'tier')} disabled={busy} style={btn}>
          Set tier ▾
        </button>
        {openMenu === 'tier' && (
          <div style={menu}>
            {TIERS.map(t => (
              <button key={'t-'+t.k} onClick={() => submit({ kind: 'tier', tier: t.k })} style={menuItem}>{t.label}</button>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => submit({ kind: 'clear' })} disabled={busy} style={{ ...btn, color: INK_M }}>
        Clear taxonomy
      </button>

      <button onClick={() => { if (window.confirm(`Soft-delete ${selectedIds.length} photos?`)) submit({ kind: 'delete' }); }} disabled={busy} style={{ ...btn, color: RED, borderColor: RED }}>
        Delete
      </button>

      <button onClick={onClear} disabled={busy} style={{ ...btn, marginLeft: 'auto', background: 'transparent', border: 'none', color: INK_M }}>
        Clear selection ✕
      </button>

      {msg && (
        <span style={{ fontSize: 11, color: msg.startsWith('Failed') ? RED : FOREST, marginLeft: 8 }}>{msg}</span>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '6px 12px', fontSize: 11, fontWeight: 600,
  background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 3,
  cursor: 'pointer', whiteSpace: 'nowrap',
};
const menu: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, marginTop: 4,
  background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 200, maxHeight: 300, overflow: 'auto', zIndex: 30,
};
const menuItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px',
  fontSize: 11, background: 'transparent', border: 'none', color: INK,
  cursor: 'pointer', borderBottom: '1px solid ' + HAIR,
};
