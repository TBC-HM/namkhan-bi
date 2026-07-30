'use client';

// components/dataroom/DataroomCockpit.tsx — data-room cockpit list (internal).
// Brief dataroom-module-v1 §5a: rooms as cards — template badge, completeness %,
// guest count, expiry warnings. Shared by /holding/ceo/dataroom and
// /h/[property_id]/dataroom. Tokens only (design_system) — no hex literals.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export interface RoomCard {
  id: string;
  slug: string;
  name: string;
  template: string;
  status: string;
  owner_level: string;
  property_id: number | null;
  sections_total: number;
  sections_satisfied: number;
  completeness_pct: string | number | null;
  items_count: number;
  guests_active: number;
  grants_expiring_7d: number;
  last_external_access: string | null;
}

const TEMPLATES = [
  { value: 'dd_full', label: 'Due diligence (full checklist)' },
  { value: 'legal_case', label: 'Legal case' },
  { value: 'partner_share', label: 'Partner share' },
  { value: 'media_share', label: 'Media share' },
  { value: 'custom', label: 'Custom (empty)' },
];

export default function DataroomCockpit({ level, propertyId, basePath }: {
  level: 'holding' | 'property';
  propertyId: number | null;
  basePath: string; // e.g. /holding/ceo/dataroom or /h/260955/dataroom
}) {
  const [rooms, setRooms] = useState<RoomCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('dd_full');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = level === 'holding' ? 'level=holding' : `level=property&property_id=${propertyId}`;
      const res = await fetch(`/api/dataroom/rooms?${qs}`, { cache: 'no-store' });
      const j = await res.json();
      if (res.ok) setRooms(j.rooms ?? []);
      else setErr(j.error ?? 'load failed');
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }, [level, propertyId]);

  useEffect(() => { void load(); }, [load]);

  async function createRoom() {
    if (!name.trim() || creating) return;
    setCreating(true); setErr(null);
    try {
      const res = await fetch('/api/dataroom/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_level: level,
          property_id: level === 'property' ? propertyId : null,
          name: name.trim(),
          template,
        }),
      });
      const j = await res.json();
      if (!res.ok) setErr(j.error ?? 'create failed');
      else { setName(''); await load(); }
    } catch (e) { setErr(String(e)); }
    setCreating(false);
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px 64px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Data Rooms</h1>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 4 }}>
            {level === 'holding' ? 'Holding · The Beyond Circle' : `Property ${propertyId}`} —
            isolated rooms for external sharing; every view is logged.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New room name…"
            style={{ border: '1px solid var(--hairline)', borderRadius: 6, padding: '7px 10px', fontSize: 13, minWidth: 180 }} />
          <select value={template} onChange={(e) => setTemplate(e.target.value)}
            style={{ border: '1px solid var(--hairline)', borderRadius: 6, padding: '7px 8px', fontSize: 13 }}>
            {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={() => void createRoom()} disabled={creating || !name.trim()}
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer', opacity: creating || !name.trim() ? 0.5 : 1 }}>
            {creating ? 'Creating…' : '+ Create room'}
          </button>
        </div>
      </div>

      {err && <div style={{ color: 'var(--terracotta, #B8542A)', fontSize: 13, marginTop: 12 }}>{err}</div>}
      {loading && <div style={{ color: 'var(--ink-mute)', fontSize: 13, marginTop: 20 }}>Loading rooms…</div>}
      {!loading && rooms.length === 0 && (
        <div style={{ color: 'var(--ink-mute)', fontSize: 14, marginTop: 24 }}>
          No rooms yet at this level. Create the first one above.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginTop: 20 }}>
        {rooms.map((r) => {
          const pct = r.completeness_pct === null ? null : Number(r.completeness_pct);
          return (
            <Link key={r.id} href={`${basePath}/${r.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ border: '1px solid var(--hairline)', borderRadius: 10, padding: 16, background: 'var(--card, #fff)', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{r.name}</div>
                  <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid var(--hairline)', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                    {r.template.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-mute)' }}>
                    <span>Completeness</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                      {pct === null ? '—' : `${pct.toFixed(0)}%`}
                      <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}> · {r.sections_satisfied}/{r.sections_total}</span>
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'var(--paper-deep, #F5F0E1)', borderRadius: 3, marginTop: 5 }}>
                    <div style={{ height: 5, width: `${pct ?? 0}%`, background: 'var(--primary)', borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12, color: 'var(--ink-mute)', flexWrap: 'wrap' }}>
                  <span>{r.items_count} items</span>
                  <span>{r.guests_active} active guest{r.guests_active === 1 ? '' : 's'}</span>
                  {r.grants_expiring_7d > 0 && (
                    <span style={{ color: 'var(--terracotta, #B8542A)', fontWeight: 600 }}>
                      {r.grants_expiring_7d} expiring ≤7d
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-faint, #8A8A8A)' }}>
                  {r.last_external_access
                    ? `Last external access ${new Date(r.last_external_access).toISOString().slice(0, 16).replace('T', ' ')} UTC`
                    : 'No external access yet'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
