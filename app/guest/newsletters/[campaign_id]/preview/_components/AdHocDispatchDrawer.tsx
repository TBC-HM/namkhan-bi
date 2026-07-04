// app/guest/newsletters/[campaign_id]/preview/_components/AdHocDispatchDrawer.tsx
// PBS 2026-07-04: hand-pick a list of guests and dispatch a draft to them.
// Loads pickable guests once on open, client-side filter for speed.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

interface Props {
  campaign_id: string;
  campaign_name: string;
  property_id: number;
}

interface Guest {
  guest_id: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  gender: string | null;
  total_stays: number | null;
  is_repeat: boolean | null;
  last_stay_date: string | null;
}

export default function AdHocDispatchDrawer({ campaign_id, campaign_name, property_id }: Props) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [guests, setGuests]     = useState<Guest[]>([]);
  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending]   = useState(false);
  const [msg, setMsg]           = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [repeatOnly, setRepeatOnly]   = useState(false);
  const [countryFilter, setCountryFilter] = useState<string>('');

  useEffect(() => {
    if (!open || guests.length > 0) return;
    setLoading(true);
    const sb = getSupabaseBrowser();
    sb.from('v_newsletter_pickable_guests')
      .select('guest_id, full_name, email, country, gender, total_stays, is_repeat, last_stay_date')
      .eq('property_id', property_id)
      .order('last_stay_date', { ascending: false, nullsFirst: false })
      .limit(5000)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) { setMsg({ kind: 'err', text: error.message }); return; }
        setGuests((data as Guest[]) || []);
      });
  }, [open, guests.length, property_id]);

  const countries = useMemo(() => {
    const s = new Set<string>();
    for (const g of guests) if (g.country) s.add(g.country);
    return Array.from(s).sort();
  }, [guests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      if (repeatOnly && !g.is_repeat) return false;
      if (countryFilter && g.country !== countryFilter) return false;
      if (!q) return true;
      return (
        (g.full_name || '').toLowerCase().includes(q) ||
        (g.email     || '').toLowerCase().includes(q) ||
        (g.country   || '').toLowerCase().includes(q)
      );
    });
  }, [guests, query, repeatOnly, countryFilter]);

  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const selectAllFiltered = () => setSelected((s) => {
    const next = new Set(s); for (const g of filtered) next.add(g.guest_id); return next;
  });
  const clearSelection = () => setSelected(new Set());

  const dispatch = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Dispatch "${campaign_name}" to ${selected.size} guest${selected.size === 1 ? '' : 's'}? The batch sender will send within a minute.`)) return;
    setSending(true); setMsg(null);
    try {
      const res = await fetch('/api/newsletter/enqueue-ad-hoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id, guest_ids: Array.from(selected) }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg({ kind: 'ok', text: `Enqueued ${j.enqueued} · already in queue ${j.already_in_queue} · skipped (no email) ${j.skipped_no_email}. Batch sender will pick up within 60s.` });
        setSelected(new Set());
      } else {
        setMsg({ kind: 'err', text: j?.error || 'Dispatch failed' });
      }
    } catch (e) {
      const em = e instanceof Error ? e.message : 'Network error';
      setMsg({ kind: 'err', text: em });
    } finally { setSending(false); }
  };

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; 
  const NK_GREEN='#084838'; const CREAM='#F7F0E1';

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        padding: '6px 14px', background: NK_GREEN, color: '#FFFFFF',
        border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', letterSpacing: '0.04em', marginLeft: 'auto',
      }}>Send to selected guests →</button>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 640, maxWidth: '96vw',
      background: '#FFFFFF', borderLeft: '1px solid ' + HAIR,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 100,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid ' + HAIR, background: CREAM,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, letterSpacing: '0.04em' }}>Send to selected guests</div>
          <div style={{ fontSize: 11, color: INK_M, marginTop: 3 }}>{campaign_name}</div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: INK_M, cursor: 'pointer', fontSize: 20 }}>×</button>
      </div>

      <div style={{ padding: '12px 20px', borderBottom: '1px solid ' + HAIR, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name / email / country" style={{
          flex: '1 1 200px', minWidth: 180, padding: '6px 10px',
          border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 12,
          background: '#FFFFFF', color: INK,
        }} />
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} style={{
          padding: '6px 10px', border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 12,
          background: '#FFFFFF', color: INK,
        }}>
          <option value="">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ fontSize: 11, color: INK_M, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={repeatOnly} onChange={(e) => setRepeatOnly(e.target.checked)} /> Repeat only
        </label>
      </div>

      <div style={{ padding: '8px 20px', borderBottom: '1px solid ' + HAIR, background: CREAM,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: INK_M }}>
        <div>
          {filtered.length.toLocaleString()} match{filtered.length === 1 ? '' : 'es'} · <strong style={{ color: NK_GREEN }}>{selected.size.toLocaleString()} selected</strong>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={selectAllFiltered} style={{ background: 'none', border: '1px solid ' + HAIR, borderRadius: 3, padding: '3px 8px', fontSize: 10, color: INK, cursor: 'pointer' }}>Select all matches</button>
          <button onClick={clearSelection} disabled={selected.size === 0} style={{ background: 'none', border: '1px solid ' + HAIR, borderRadius: 3, padding: '3px 8px', fontSize: 10, color: INK, cursor: selected.size === 0 ? 'default' : 'pointer', opacity: selected.size === 0 ? 0.5 : 1 }}>Clear</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', fontSize: 12 }}>
        {loading ? (
          <div style={{ padding: 24, color: INK_M, textAlign: 'center' }}>Loading guests…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, color: INK_M, textAlign: 'center' }}>No guests match.</div>
        ) : (
          filtered.slice(0, 500).map((g) => {
            const on = selected.has(g.guest_id);
            return (
              <label key={g.guest_id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px',
                borderBottom: '1px solid ' + HAIR, cursor: 'pointer',
                background: on ? '#F0F4EE' : '#FFFFFF',
              }}>
                <input type="checkbox" checked={on} onChange={() => toggle(g.guest_id)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: INK, fontWeight: 600 }}>{g.full_name || '—'}</div>
                  <div style={{ color: INK_M, fontSize: 11 }}>{g.email} · {g.country || '—'}{g.is_repeat ? ' · repeat' : ''}</div>
                </div>
              </label>
            );
          })
        )}
        {filtered.length > 500 && (
          <div style={{ padding: '10px 20px', fontSize: 10, color: INK_M, textAlign: 'center' }}>
            {filtered.length - 500} more matches — refine your search or "Select all matches" to include them.
          </div>
        )}
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid ' + HAIR, background: CREAM,
        display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={dispatch} disabled={sending || selected.size === 0} style={{
          padding: '8px 18px', background: (sending || selected.size === 0) ? '#8AA095' : NK_GREEN,
          color: '#FFFFFF', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600,
          cursor: (sending || selected.size === 0) ? 'default' : 'pointer',
        }}>
          {sending ? 'Dispatching…' : `Dispatch to ${selected.size} guest${selected.size === 1 ? '' : 's'} →`}
        </button>
        {msg && (
          <div style={{ fontSize: 11, color: msg.kind === 'ok' ? '#1F5C2C' : '#B03826', flex: 1 }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
