// app/marketing/media/_client/LinkPhotosPanel.tsx
// PBS 2026-07-12 pm — link reference photos to rooms/facilities/activities/certifications.
// Two lanes per entity: AI reference (visual anchor for generator) + Human reference (staff browse).
// v2: multi-select checkboxes + bulk Execute + hides photos already linked to this entity (any lane).
'use client';

import { useEffect, useMemo, useState } from 'react';

type Kind = 'room' | 'facility' | 'activity' | 'certification';
type Lane = 'ai' | 'human';

interface RoomOpt { room_type_id: number; room_type_name: string; }
interface FacilityOpt { facility_id: number; facility_name: string; category?: string | null; }
interface MediaRow {
  asset_id: string; original_filename?: string | null; public_url?: string | null;
  primary_tier?: string | null; property_area?: string | null; is_ai_generated?: boolean | null;
}
interface RefRow {
  id: number; entity_kind: string; entity_ref: string; asset_id: string;
  reference_lane: string; original_filename?: string | null; public_url?: string | null;
}

interface Props {
  propertyId: number;
  rooms: RoomOpt[];
  facilities: FacilityOpt[];
  mediaPage: MediaRow[];
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST= '#084838';
const RED   = '#B23A2E';

export default function LinkPhotosPanel({ propertyId, rooms, facilities, mediaPage }: Props) {
  const [refs, setRefs] = useState<RefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerFor, setPickerFor] = useState<{ kind: Kind; ref: string; label: string } | null>(null);
  const [pickerLane, setPickerLane] = useState<Lane>('ai');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activityInput, setActivityInput] = useState('');
  const [certInput, setCertInput] = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [certs, setCerts] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  async function loadRefs() {
    setLoading(true);
    try {
      const r = await fetch(`/api/marketing/media/entity-ref/list?property_id=${propertyId}`);
      if (r.ok) {
        const j = await r.json();
        setRefs(Array.isArray(j.rows) ? j.rows : []);
      }
    } catch { /* keep prior state */ }
    setLoading(false);
  }

  useEffect(() => { loadRefs(); }, [propertyId]);

  useEffect(() => {
    const actSet = new Set<string>(); const certSet = new Set<string>();
    for (const r of refs) {
      if (r.entity_kind === 'activity')      actSet.add(r.entity_ref);
      if (r.entity_kind === 'certification') certSet.add(r.entity_ref);
    }
    setActivities(prev => Array.from(new Set([...prev, ...actSet])));
    setCerts(prev => Array.from(new Set([...prev, ...certSet])));
  }, [refs]);

  function countRefs(kind: Kind, ref: string, lane: Lane): number {
    return refs.filter(r => r.entity_kind === kind && r.entity_ref === ref && r.reference_lane === lane).length;
  }

  // Reset selection when picker changes entity/lane
  useEffect(() => { setSelected(new Set()); setSearch(''); }, [pickerFor?.kind, pickerFor?.ref, pickerLane]);

  async function executeSelected() {
    if (!pickerFor || selected.size === 0) return;
    setBusy(true); setMsg(`Linking ${selected.size} photo${selected.size === 1 ? '' : 's'}…`);
    let ok = 0; let fail = 0;
    for (const assetId of selected) {
      try {
        const r = await fetch('/api/marketing/media/entity-ref/add', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId, entity_kind: pickerFor.kind, entity_ref: pickerFor.ref,
            asset_id: assetId, reference_lane: pickerLane,
          }),
        });
        if (r.ok) ok++; else fail++;
      } catch { fail++; }
    }
    setMsg(`Linked ${ok}${fail > 0 ? ` · ${fail} failed` : ''}`);
    setSelected(new Set());
    await loadRefs();
    setBusy(false);
  }

  async function unlink(refId: number) {
    setBusy(true); setMsg('Unlinking…');
    try {
      const r = await fetch('/api/marketing/media/entity-ref/remove', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: refId }),
      });
      const j = await r.json();
      if (!r.ok) { setMsg(`Unlink failed: ${j.error ?? r.statusText}`); }
      else { setMsg('Unlinked ✓'); await loadRefs(); }
    } finally { setBusy(false); }
  }

  function toggleSel(assetId: string) {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(assetId)) next.delete(assetId); else next.add(assetId);
      return next;
    });
  }

  function renderEntityRow(kind: Kind, ref: string, label: string, sub?: string) {
    const aiCt    = countRefs(kind, ref, 'ai');
    const humanCt = countRefs(kind, ref, 'human');
    return (
      <tr key={kind + ':' + ref} style={{ borderTop: '1px solid ' + HAIR }}>
        <td style={{ padding: '8px 6px', fontSize: 12, color: INK, fontWeight: 600 }}>{label}</td>
        <td style={{ padding: '8px 6px', fontSize: 11, color: INK_M }}>{sub ?? ''}</td>
        <td style={{ padding: '8px 6px', fontSize: 11, color: aiCt > 0 ? FOREST : INK_M, fontWeight: 600 }}>{aiCt} AI</td>
        <td style={{ padding: '8px 6px', fontSize: 11, color: humanCt > 0 ? FOREST : INK_M, fontWeight: 600 }}>{humanCt} human</td>
        <td style={{ padding: '8px 6px' }}>
          <button onClick={() => { setPickerFor({ kind, ref, label }); setPickerLane('ai'); }} style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 600, background: FOREST, color: WHITE,
            border: 'none', borderRadius: 3, cursor: 'pointer',
          }}>Manage photos</button>
        </td>
      </tr>
    );
  }

  // Any-lane already-linked-to-this-entity set (hides from gallery entirely)
  const alreadyLinkedAnyLane = useMemo(() => {
    if (!pickerFor) return new Set<string>();
    const s = new Set<string>();
    for (const r of refs) {
      if (r.entity_kind === pickerFor.kind && r.entity_ref === pickerFor.ref) s.add(r.asset_id);
    }
    return s;
  }, [refs, pickerFor]);

  const linkedForCurrent = useMemo(() => {
    if (!pickerFor) return [] as RefRow[];
    return refs.filter(r =>
      r.entity_kind === pickerFor.kind &&
      r.entity_ref === pickerFor.ref &&
      r.reference_lane === pickerLane
    );
  }, [refs, pickerFor, pickerLane]);

  const gallery = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mediaPage.filter(m => {
      if (alreadyLinkedAnyLane.has(m.asset_id)) return false;
      if (!q) return true;
      return (m.original_filename ?? '').toLowerCase().includes(q) ||
             (m.property_area     ?? '').toLowerCase().includes(q);
    }).slice(0, 500);
  }, [mediaPage, alreadyLinkedAnyLane, search]);

  return (
    <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>📎 Link Photos</h3>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: INK_M }}>
            Attach reference photos to rooms · facilities · activities · certifications. AI lane feeds the generator; Human lane is staff browse. Linking also stamps room_type_id / property_area on the asset so Library filters see it.
          </p>
        </div>
        {msg && <span style={{ fontSize: 11, color: msg.includes('failed') ? RED : FOREST }}>{msg}</span>}
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: INK_M, fontSize: 11 }}>Loading…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: INK_M, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <th style={{ padding: '6px' }}>Entity</th>
              <th style={{ padding: '6px' }}>Type / info</th>
              <th style={{ padding: '6px' }}>AI refs</th>
              <th style={{ padding: '6px' }}>Human refs</th>
              <th style={{ padding: '6px' }}></th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={5} style={{ padding: '6px', background: '#FAF6EC', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: INK_M }}>Rooms · {rooms.length}</td></tr>
            {rooms.map(r => renderEntityRow('room', String(r.room_type_id), r.room_type_name, 'room'))}
            <tr><td colSpan={5} style={{ padding: '6px', background: '#FAF6EC', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: INK_M }}>Facilities · {facilities.length}</td></tr>
            {facilities.map(f => renderEntityRow('facility', String(f.facility_id), f.facility_name, f.category ?? ''))}
            <tr><td colSpan={5} style={{ padding: '6px', background: '#FAF6EC', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: INK_M }}>Activities · {activities.length} (free-text slugs)</td></tr>
            {activities.map(a => renderEntityRow('activity', a, a))}
            <tr>
              <td colSpan={5} style={{ padding: '6px' }}>
                <input value={activityInput} onChange={e => setActivityInput(e.target.value)} placeholder="e.g. boat_ride, cycling_tour, cooking_class" style={{ padding: '4px 8px', fontSize: 11, border: '1px solid ' + HAIR, borderRadius: 3, marginRight: 6 }} />
                <button onClick={() => { const s = activityInput.trim().toLowerCase().replace(/\s+/g, '_'); if (s && !activities.includes(s)) setActivities([...activities, s]); setActivityInput(''); }} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer' }}>+ Activity</button>
              </td>
            </tr>
            <tr><td colSpan={5} style={{ padding: '6px', background: '#FAF6EC', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: INK_M }}>Certifications · {certs.length}</td></tr>
            {certs.map(c => renderEntityRow('certification', c, c))}
            <tr>
              <td colSpan={5} style={{ padding: '6px' }}>
                <input value={certInput} onChange={e => setCertInput(e.target.value)} placeholder="e.g. slh_membership, sustainable_tourism" style={{ padding: '4px 8px', fontSize: 11, border: '1px solid ' + HAIR, borderRadius: 3, marginRight: 6 }} />
                <button onClick={() => { const s = certInput.trim().toLowerCase().replace(/\s+/g, '_'); if (s && !certs.includes(s)) setCerts([...certs, s]); setCertInput(''); }} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer' }}>+ Certification</button>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {pickerFor && (
        <div onClick={() => setPickerFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: WHITE, borderRadius: 4, width: 'min(1100px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 14, borderBottom: '1px solid ' + HAIR, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Link photos → {pickerFor.kind}: {pickerFor.label}</div>
                <div style={{ fontSize: 11, color: INK_M, marginTop: 3 }}>
                  <button onClick={() => setPickerLane('ai')} style={{ marginRight: 6, padding: '3px 10px', fontSize: 11, borderRadius: 12, cursor: 'pointer', border: '1px solid ' + (pickerLane === 'ai' ? FOREST : HAIR), background: pickerLane === 'ai' ? FOREST : WHITE, color: pickerLane === 'ai' ? WHITE : INK, fontWeight: 600 }}>✨ AI reference</button>
                  <button onClick={() => setPickerLane('human')} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 12, cursor: 'pointer', border: '1px solid ' + (pickerLane === 'human' ? FOREST : HAIR), background: pickerLane === 'human' ? FOREST : WHITE, color: pickerLane === 'human' ? WHITE : INK, fontWeight: 600 }}>👤 Human reference</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search filename / area…" style={{ padding: '5px 10px', fontSize: 11, border: '1px solid ' + HAIR, borderRadius: 3, width: 180 }} />
                <button
                  onClick={executeSelected}
                  disabled={selected.size === 0 || busy}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 700,
                    background: selected.size === 0 ? '#F5F1E6' : FOREST,
                    color: selected.size === 0 ? INK_M : WHITE,
                    border: 'none', borderRadius: 3,
                    cursor: selected.size === 0 || busy ? 'not-allowed' : 'pointer',
                  }}
                >→ Link {selected.size > 0 ? selected.size : ''} selected</button>
                <button onClick={() => setPickerFor(null)} style={{ padding: '4px 10px', fontSize: 12, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer' }}>Close ×</button>
              </div>
            </div>
            <div style={{ padding: 12, overflowY: 'auto' }}>
              {linkedForCurrent.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: INK_M, marginBottom: 6, fontWeight: 600 }}>Linked in this lane ({linkedForCurrent.length}) — click × to unlink</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 5, marginBottom: 16 }}>
                    {linkedForCurrent.map(r => (
                      <div key={r.id} style={{ border: '2px solid ' + FOREST, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                        {r.public_url && <img src={r.public_url} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />}
                        <button onClick={() => unlink(r.id)} title="Unlink" style={{ position: 'absolute', top: 2, right: 2, background: RED, color: WHITE, border: 'none', borderRadius: 10, width: 18, height: 18, fontSize: 9, cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{ fontSize: 11, color: INK_M, marginBottom: 6, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                <span>Library — {gallery.length} available (already-linked hidden){search ? ` · filtered by "${search}"` : ''}</span>
                {selected.size > 0 && <button onClick={() => setSelected(new Set())} style={{ fontSize: 10, background: 'transparent', border: 'none', color: INK_M, cursor: 'pointer', textDecoration: 'underline' }}>Clear selection</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 5 }}>
                {gallery.map(m => {
                  const isSel = selected.has(m.asset_id);
                  return (
                    <button key={m.asset_id} onClick={() => toggleSel(m.asset_id)} title={m.original_filename ?? m.asset_id.slice(0, 8)} style={{
                      padding: 0, border: '2px solid ' + (isSel ? FOREST : HAIR), borderRadius: 3, overflow: 'hidden',
                      cursor: 'pointer', background: '#F5F0E1', aspectRatio: '1 / 1', position: 'relative',
                    }}>
                      {m.public_url ? <img src={m.public_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: isSel ? 0.7 : 1 }} /> : <span style={{ fontSize: 9, color: INK_M }}>no preview</span>}
                      {isSel && <div style={{ position: 'absolute', top: 3, left: 3, background: FOREST, color: WHITE, borderRadius: 10, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>✓</div>}
                    </button>
                  );
                })}
              </div>
              {gallery.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: INK_M, fontSize: 11 }}>No photos available — every photo in the library is already linked to this entity (or your search matched nothing).</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
