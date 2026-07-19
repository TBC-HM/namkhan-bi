// app/marketing/media/_client/BulkSelectBar.tsx
// PBS 2026-07-14 · #203 — Sticky bulk-actions bar. Shown when >0 photos selected.
// PBS 2026-07-19 · #275+ · unified "Assign to folder" dropdown mirrors the
// Clarify tab dropdown — shows the FULL taxonomy (rooms · facilities · jungle spa ·
// F&B · activities · retreats · transport · imekong · certifications · destination)
// instead of the old hard-coded property_area short list that was missing
// Roots Food pics / Laos / Luang Prabang / etc.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface BulkOption { id: number | string; name: string; }

export interface AreaTaxonomyRow {
  kind: string;
  ref_id: string | null;
  area_key: string;
  name: string;
  photo_count?: number | null;
  sort_order?: number;
}

interface Props {
  selectedIds: string[];
  onClear: () => void;
  rooms: BulkOption[];
  facilities: BulkOption[];
  activities: BulkOption[];
  areaChoices: string[];
  // PBS 2026-07-19 · new prop — full taxonomy from v_media_area_taxonomy so the
  // bar can show Destination + F&B sub-folders + everything Settings drives.
  areaTaxonomy?: AreaTaxonomyRow[];
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

const KIND_LABEL: Record<string, string> = {
  rooms: 'Accommodation',
  facilities: 'Facilities',
  jungle_spa: 'Jungle Spa',
  fnb: 'F&B',
  activities: 'Activities',
  retreats: 'Retreats',
  transport: 'Transport',
  imekong: 'Imekong',
  certifications: 'Certifications',
  destination: 'Destination',
  other: 'Other',
  uncategorized: 'Uncategorized',
};

const KIND_ORDER = ['rooms','facilities','jungle_spa','fnb','activities','retreats','transport','imekong','certifications','destination'];

export default function BulkSelectBar({ selectedIds, onClear, rooms, facilities, activities, areaChoices, areaTaxonomy = [] }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<'all'|'tier'|null>(null);

  const taxonomyGroups = useMemo(() => {
    const groups: Array<{ kind: string; label: string; rows: AreaTaxonomyRow[] }> = [];
    const byKind = new Map<string, AreaTaxonomyRow[]>();
    for (const r of areaTaxonomy) {
      if (!byKind.has(r.kind)) byKind.set(r.kind, []);
      byKind.get(r.kind)!.push(r);
    }
    for (const k of KIND_ORDER) {
      const rows = byKind.get(k);
      if (rows && rows.length) groups.push({ kind: k, label: KIND_LABEL[k] ?? k, rows });
    }
    return groups;
  }, [areaTaxonomy]);

  if (selectedIds.length === 0) return null;

  async function submitBulk(payload: Record<string, unknown>) {
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

  // PBS 2026-07-19 · For taxonomy rows, route through the same endpoint the
  // Clarify tab uses (clarify-assign) which handles destination + regular kinds.
  // We loop per-asset (there is no bulk clarify-assign endpoint yet).
  async function submitTaxonomy(tr: AreaTaxonomyRow) {
    setBusy(true); setMsg(null);
    try {
      const results = await Promise.all(selectedIds.map(async id => {
        const isDestination = tr.kind === 'destination'
          || (tr.ref_id != null && !/^\d+$/.test(String(tr.ref_id)));
        const payload = isDestination
          ? { asset_id: id, kind: 'destination', ref_id: tr.ref_id ?? tr.area_key, area_key: tr.area_key }
          : { asset_id: id, kind: tr.kind, ref_id: tr.ref_id, area_key: tr.area_key };
        const res = await fetch('/api/marketing/media/clarify-assign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => ({}));
        return res.ok && j?.ok;
      }));
      const okN = results.filter(Boolean).length;
      const failed = results.length - okN;
      setMsg(`Assigned ${okN} → ${tr.name}${failed > 0 ? ' · ' + failed + ' failed' : ''}`);
      onClear();
      router.refresh();
      setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      setMsg('Failed: ' + (e instanceof Error ? e.message : String(e)));
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

      {taxonomyGroups.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpenMenu(openMenu === 'all' ? null : 'all')} disabled={busy} style={{ ...btn, background: FOREST, color: WHITE, borderColor: FOREST }}>
            Assign to folder ▾
          </button>
          {openMenu === 'all' && (
            <div style={{ ...menu, minWidth: 280, maxHeight: 480 }}>
              {taxonomyGroups.map(g => (
                <div key={g.kind}>
                  <div style={groupHeader}>{g.label}</div>
                  {g.rows.map(tr => (
                    <button
                      key={g.kind + '::' + tr.area_key}
                      onClick={() => submitTaxonomy(tr)}
                      style={menuItem}
                    >
                      {tr.name}{tr.photo_count != null ? ` · ${tr.photo_count}` : ''}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpenMenu(openMenu === 'tier' ? null : 'tier')} disabled={busy} style={btn}>
          Set tier ▾
        </button>
        {openMenu === 'tier' && (
          <div style={menu}>
            {TIERS.map(t => (
              <button key={'t-'+t.k} onClick={() => submitBulk({ kind: 'tier', tier: t.k })} style={menuItem}>{t.label}</button>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => submitBulk({ kind: 'clear' })} disabled={busy} style={{ ...btn, color: INK_M }}>
        Clear taxonomy
      </button>

      <button onClick={() => { if (window.confirm(`Soft-delete ${selectedIds.length} photos?`)) submitBulk({ kind: 'delete' }); }} disabled={busy} style={{ ...btn, color: RED, borderColor: RED }}>
        Delete
      </button>

      <button onClick={onClear} disabled={busy} style={{ ...btn, marginLeft: 'auto', background: 'transparent', border: 'none', color: INK_M }}>
        Clear selection ✕
      </button>

      {msg && (
        <span style={{ fontSize: 11, color: msg.startsWith('Failed') ? RED : FOREST, marginLeft: 8 }}>{msg}</span>
      )}

      {/* Keep unused props referenced to avoid TS "never read" hint on `rooms`/`facilities`/`activities`/`areaChoices` for callers that still pass them. */}
      <span style={{ display: 'none' }}>{rooms.length + facilities.length + activities.length + areaChoices.length}</span>
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
  display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
  fontSize: 11, background: 'transparent', border: 'none', color: INK,
  cursor: 'pointer', borderBottom: '1px solid ' + HAIR,
};
const groupHeader: React.CSSProperties = {
  padding: '6px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: INK_M, background: '#F5F0E1',
  borderBottom: '1px solid ' + HAIR, borderTop: '1px solid ' + HAIR,
};
