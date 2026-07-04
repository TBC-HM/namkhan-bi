// app/guest/newsletters/_components/ScheduleDrawer.tsx
// PBS 2026-07-04 v2: schedule a draft — pick recipients (multi-dropdown filters) + send date.
'use client';

import { useEffect, useMemo, useState } from 'react';

interface Props {
  campaign_id: string;
  campaign_name: string;
  planned_date: string | null;
  onDone?: () => void;
}
interface Guest {
  guest_id: string; full_name: string | null; email: string | null;
  country: string | null; language: string | null; gender: string | null;
  total_stays: number | null; is_repeat: boolean | null; last_stay_date: string | null;
  top_source: string | null; top_segment: string | null; arrival_bucket: string | null;
  party_type: string | null;
  spent_restaurant: boolean | null; spent_spa: boolean | null;
  spent_activities: boolean | null; spent_retail: boolean | null;
}

export default function ScheduleDrawer({ campaign_id, campaign_name, planned_date, onDone }: Props) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [guests, setGuests]     = useState<Guest[]>([]);
  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending]   = useState(false);
  const [msg, setMsg]           = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sendDate, setSendDate] = useState<string>(planned_date || '');

  // filter state
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [gender, setGender] = useState('');
  const [source, setSource] = useState('');
  const [segment, setSegment] = useState('');
  const [arrivalBucket, setArrivalBucket] = useState('');
  const [partyType, setPartyType] = useState('');
  const [spent, setSpent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || guests.length > 0) return;
    setLoading(true);
    fetch('/api/newsletter/pickable-guests')
      .then((r) => r.json())
      .then((j) => {
        setLoading(false);
        if (!j?.ok) { setMsg({ kind: 'err', text: j?.error || 'Load failed' }); return; }
        setGuests((j.guests as Guest[]) || []);
      })
      .catch((e) => { setLoading(false); setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Network error' }); });
  }, [open, guests.length]);

  const unique = <K extends keyof Guest>(k: K): string[] => {
    const s = new Set<string>();
    for (const g of guests) { const v = g[k]; if (v && typeof v === 'string') s.add(v); }
    return Array.from(s).sort();
  };

  const countries = useMemo(() => unique('country'), [guests]);
  const languages = useMemo(() => unique('language'), [guests]);
  const genders = useMemo(() => unique('gender'), [guests]);
  const sources = useMemo(() => unique('top_source'), [guests]);
  const segments = useMemo(() => unique('top_segment'), [guests]);
  const arrivalBuckets = useMemo(() => unique('arrival_bucket'), [guests]);
  const partyTypes = useMemo(() => unique('party_type'), [guests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      if (repeatOnly && !g.is_repeat) return false;
      if (country && g.country !== country) return false;
      if (language && g.language !== language) return false;
      if (gender && g.gender !== gender) return false;
      if (source && g.top_source !== source) return false;
      if (segment && g.top_segment !== segment) return false;
      if (arrivalBucket && g.arrival_bucket !== arrivalBucket) return false;
      if (partyType && g.party_type !== partyType) return false;
      if (spent.restaurant && !g.spent_restaurant) return false;
      if (spent.spa && !g.spent_spa) return false;
      if (spent.activities && !g.spent_activities) return false;
      if (spent.retail && !g.spent_retail) return false;
      if (!q) return true;
      return ((g.full_name || '').toLowerCase().includes(q) ||
              (g.email || '').toLowerCase().includes(q) ||
              (g.country || '').toLowerCase().includes(q));
    });
  }, [guests, query, repeatOnly, country, language, gender, source, segment, arrivalBucket, partyType, spent]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const selectAllFiltered = () => setSelected((s) => { const n = new Set(s); for (const g of filtered) n.add(g.guest_id); return n; });
  const clearSelection = () => setSelected(new Set());
  const clearAllFilters = () => {
    setQuery(''); setRepeatOnly(false); setCountry(''); setLanguage(''); setGender('');
    setSource(''); setSegment(''); setArrivalBucket(''); setPartyType(''); setSpent({});
  };

  const doSchedule = async () => {
    if (selected.size === 0) return;
    const sendAtIso = sendDate ? new Date(sendDate + 'T10:00:00+07:00').toISOString() : null;
    const dateLabel = sendDate || 'immediately';
    if (!confirm(`Schedule "${campaign_name}" to ${selected.size} guest${selected.size===1?'':'s'} · send ${dateLabel}?`)) return;
    setSending(true); setMsg(null);
    try {
      const res = await fetch('/api/newsletter/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id, guest_ids: Array.from(selected), send_at: sendAtIso }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg({ kind: 'ok', text: `Scheduled ${j.enqueued} · already queued ${j.already_in_queue} · skipped ${j.skipped_no_email}. Reload to see status.` });
        setSelected(new Set());
        if (onDone) setTimeout(onDone, 1500);
      } else {
        setMsg({ kind: 'err', text: j?.error || 'Schedule failed' });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Network error' });
    } finally { setSending(false); }
  };

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A';
  const NK_GREEN='#084838'; const CREAM='#F7F0E1';
  const selectStyle = { padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF' };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600,
        background: NK_GREEN, color:'#FFFFFF', border:'none', borderRadius:4, cursor:'pointer',
      }}>Schedule →</button>
    );
  }

  return (
    <>
      <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:99 }} />
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:760, maxWidth:'96vw',
        background:'#FFFFFF', borderLeft:'1px solid '+HAIR, boxShadow:'-4px 0 24px rgba(0,0,0,0.15)',
        zIndex:100, display:'flex', flexDirection:'column',
      }}>
        <div style={{ padding:'18px 20px', borderBottom:'1px solid '+HAIR, background:CREAM, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:INK, letterSpacing:'0.04em' }}>Schedule campaign</div>
            <div style={{ fontSize:11, color:INK_M, marginTop:3 }}>{campaign_name}</div>
          </div>
          <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:INK_M, cursor:'pointer', fontSize:20 }}>×</button>
        </div>

        <div style={{ padding:'12px 20px', borderBottom:'1px solid '+HAIR, background:'#FFFFFF' }}>
          <label style={{ fontSize:11, color:INK_M, letterSpacing:'0.04em', textTransform:'uppercase' }}>Send date</label>
          <input type="date" value={sendDate} onChange={(e) => setSendDate(e.target.value)}
            style={{ display:'block', marginTop:6, padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF' }} />
          <div style={{ fontSize:10, color:INK_M, marginTop:4 }}>Sends at 10:00 Vientiane time. Blank = send immediately after enqueue.</div>
        </div>

        {/* FILTERS — all dropdowns in one wrapping row */}
        <div style={{ padding:'12px 20px', borderBottom:'1px solid '+HAIR, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name / email" style={{
            flex:'1 1 240px', minWidth:200, padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, background:'#FFFFFF', color:INK }} />
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={selectStyle}>
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={selectStyle}>
            <option value="">All languages</option>
            {languages.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={gender} onChange={(e) => setGender(e.target.value)} style={selectStyle}>
            <option value="">Any gender</option>
            {genders.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} style={selectStyle}>
            <option value="">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={segment} onChange={(e) => setSegment(e.target.value)} style={selectStyle}>
            <option value="">All segments</option>
            {segments.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={arrivalBucket} onChange={(e) => setArrivalBucket(e.target.value)} style={selectStyle}>
            <option value="">Any arrival</option>
            {arrivalBuckets.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={partyType} onChange={(e) => setPartyType(e.target.value)} style={selectStyle}>
            <option value="">Any party</option>
            {partyTypes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label style={{ fontSize:11, color:INK_M, display:'flex', alignItems:'center', gap:4 }}>
            <input type="checkbox" checked={repeatOnly} onChange={(e) => setRepeatOnly(e.target.checked)} /> Repeat only
          </label>
        </div>

        <div style={{ padding:'6px 20px', borderBottom:'1px solid '+HAIR, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', fontSize:11, color:INK_M }}>
          <span style={{ fontWeight:600, color:INK }}>Spent on:</span>
          {(['restaurant','spa','activities','retail'] as const).map((k) => (
            <label key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <input type="checkbox" checked={!!spent[k]}
                onChange={(e) => setSpent((s) => ({ ...s, [k]: e.target.checked }))} /> {k}
            </label>
          ))}
          <button onClick={clearAllFilters} style={{ marginLeft:'auto', background:'none', border:'1px solid '+HAIR, borderRadius:3, padding:'3px 8px', fontSize:10, color:INK, cursor:'pointer' }}>Clear filters</button>
        </div>

        <div style={{ padding:'8px 20px', borderBottom:'1px solid '+HAIR, background:CREAM, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, color:INK_M }}>
          <div>{filtered.length.toLocaleString()} match{filtered.length===1?'':'es'} · <strong style={{color:NK_GREEN}}>{selected.size.toLocaleString()} selected</strong></div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={selectAllFiltered} style={{ background:'none', border:'1px solid '+HAIR, borderRadius:3, padding:'3px 8px', fontSize:10, color:INK, cursor:'pointer' }}>Select all matches</button>
            <button onClick={clearSelection} disabled={selected.size===0} style={{ background:'none', border:'1px solid '+HAIR, borderRadius:3, padding:'3px 8px', fontSize:10, color:INK, cursor:selected.size===0?'default':'pointer', opacity:selected.size===0?0.5:1 }}>Clear</button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', fontSize:12 }}>
          {loading ? <div style={{ padding:24, color:INK_M, textAlign:'center' }}>Loading guests…</div>
          : filtered.length===0 ? <div style={{ padding:24, color:INK_M, textAlign:'center' }}>No guests match.</div>
          : filtered.slice(0, 500).map((g) => {
            const on = selected.has(g.guest_id);
            return (
              <label key={g.guest_id} style={{
                display:'flex', alignItems:'center', gap:10, padding:'8px 20px',
                borderBottom:'1px solid '+HAIR, cursor:'pointer', background: on ? '#F0F4EE' : '#FFFFFF' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(g.guest_id)} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:INK, fontWeight:600 }}>{g.full_name || '—'}</div>
                  <div style={{ color:INK_M, fontSize:11 }}>
                    {g.email} · {g.country || '—'}
                    {g.top_source ? ` · ${g.top_source}` : ''}
                    {g.is_repeat ? ' · repeat' : ''}
                  </div>
                </div>
              </label>
            );
          })}
          {filtered.length > 500 && (
            <div style={{ padding:'10px 20px', fontSize:10, color:INK_M, textAlign:'center' }}>
              {filtered.length - 500} more matches — refine your search or "Select all matches".
            </div>
          )}
        </div>

        <div style={{ padding:'14px 20px', borderTop:'1px solid '+HAIR, background:CREAM, display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={doSchedule} disabled={sending || selected.size===0} style={{
            padding:'8px 18px', background:(sending||selected.size===0)?'#8AA095':NK_GREEN,
            color:'#FFFFFF', border:'none', borderRadius:3, fontSize:12, fontWeight:600,
            cursor:(sending||selected.size===0)?'default':'pointer' }}>
            {sending ? 'Scheduling…' : `Schedule to ${selected.size} guest${selected.size===1?'':'s'} →`}
          </button>
          {msg && <div style={{ fontSize:11, color: msg.kind==='ok'?'#1F5C2C':'#B03826', flex:1 }}>{msg.text}</div>}
        </div>
      </div>
    </>
  );
}
