'use client';
// app/revenue/flights/_components/FlightsClient.tsx
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type Row = {
  id: number; search_date: string; flight_date: string; origin: string; destination: string;
  airline: string | null; flight_number: string | null; dep_time_local: string | null; arr_time_local: string | null;
  duration_min: number | null; stops: number | null; price_lowest: number | null; currency: string | null;
  booking_url: string | null;
};

const ORIGINS = [
  { code: 'BKK', label: 'Bangkok (BKK)' },
  { code: 'CNX', label: 'Chiang Mai (CNX)' },
  { code: 'HAN', label: 'Hanoi (HAN)' },
  { code: 'VTE', label: 'Vientiane (VTE)' },
  { code: 'SGN', label: 'Ho Chi Minh (SGN)' },
  { code: 'REP', label: 'Siem Reap (REP)' },
  { code: 'KMG', label: 'Kunming (KMG)' },
  { code: 'PVG', label: 'Shanghai (PVG)' },
  { code: 'ICN', label: 'Seoul (ICN)' },
  { code: 'SIN', label: 'Singapore (SIN)' },
  { code: 'KUL', label: 'Kuala Lumpur (KUL)' },
];

function today(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10);
}

export default function FlightsClient({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [origin, setOrigin]   = useState('BKK');
  const [from, setFrom]       = useState(today(1));
  const [to, setTo]           = useState(today(30));
  const [filter, setFilter]   = useState('');   // filter existing rows by origin
  const [running, setRunning] = useState(false);
  const [msg, setMsg]         = useState<{ kind:'ok'|'err'; text:string; debug?: unknown } | null>(null);

  const run = async () => {
    setRunning(true); setMsg(null);
    try {
      const res = await fetch('/api/revenue/flights/scrape', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ origin, destination: 'LPQ', date_from: from, date_to: to }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg({ kind:'ok', text: `Fetched ${j.items_returned} flights, inserted ${j.inserted} (${((j.duration_ms ?? 0)/1000).toFixed(1)}s)` });
        router.refresh();
      } else {
        setMsg({ kind:'err', text: j?.error ?? 'failed', debug: j });
      }
    } catch (e) { setMsg({ kind:'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setRunning(false); }
  };

  const filtered = useMemo(() => {
    const f = filter.trim().toUpperCase();
    return f ? initialRows.filter(r => r.origin === f) : initialRows;
  }, [initialRows, filter]);

  const perDate = useMemo(() => {
    const m = new Map<string, { count: number; sumPrice: number; countPrice: number }>();
    for (const r of filtered) {
      const k = r.flight_date;
      const cur = m.get(k) ?? { count: 0, sumPrice: 0, countPrice: 0 };
      cur.count++;
      if (r.price_lowest != null) { cur.sumPrice += r.price_lowest; cur.countPrice++; }
      m.set(k, cur);
    }
    return Array.from(m.entries()).sort((a,b) => a[0] < b[0] ? -1 : 1);
  }, [filtered]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Fetch panel */}
      <div style={{ border:'1px solid #E6DFCC', borderRadius:6, background:'#FFFFFF', padding:14 }}>
        <div style={{ fontSize:12, fontWeight:600, marginBottom:8, color:'#1B1B1B' }}>Fetch inbound flights → LPQ</div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <label style={label}>Origin</label>
          <select value={origin} onChange={e => setOrigin(e.target.value)} disabled={running} style={inp}>
            {ORIGINS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
          <label style={label}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} disabled={running} style={inp} />
          <label style={label}>To</label>
          <input type="date" value={to}   onChange={e => setTo(e.target.value)}   disabled={running} style={inp} />
          <button onClick={run} disabled={running} style={btnRun}>{running ? 'Fetching…' : 'Fetch & Import'}</button>
          <span style={{ fontSize:11, color:'#5A5A5A' }}>Google Flights via Apify · ~$0.01 / 1k results</span>
        </div>
        {msg && (
          <div style={{ marginTop:10, padding:8, background: msg.kind==='ok' ? '#F0F7F2' : '#FFF3F1', border:'1px solid ' + (msg.kind==='ok' ? '#0848380F' : '#B04A2F33'), borderRadius:4, fontSize:11 }}>
            <div style={{ color: msg.kind==='ok' ? '#084838' : '#B04A2F' }}>{msg.text}</div>
            {msg.debug && <pre style={{ fontFamily:'monospace', fontSize:10, marginTop:4, whiteSpace:'pre-wrap' }}>{JSON.stringify(msg.debug, null, 2).slice(0, 500)}</pre>}
          </div>
        )}
      </div>

      {/* Aggregation: flights per day */}
      <div style={{ border:'1px solid #E6DFCC', borderRadius:6, background:'#FFFFFF', padding:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#1B1B1B' }}>Flights per day (future)</div>
          <div>
            <label style={label}>Filter origin</label>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="e.g. BKK, HAN…" style={{ ...inp, width:120 }} />
          </div>
        </div>
        <div style={{ overflow:'auto' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={{ ...th, textAlign:'right' }}>Flights</th>
                <th style={{ ...th, textAlign:'right' }}>Avg lowest fare</th>
              </tr>
            </thead>
            <tbody>
              {perDate.map(([date, agg]) => (
                <tr key={date}>
                  <td style={td}>{date}</td>
                  <td style={{ ...td, textAlign:'right' }}>{agg.count}</td>
                  <td style={{ ...td, textAlign:'right' }}>{agg.countPrice ? `$${Math.round(agg.sumPrice / agg.countPrice)}` : '—'}</td>
                </tr>
              ))}
              {perDate.length === 0 && (
                <tr><td colSpan={3} style={{ ...td, textAlign:'center', color:'#5A5A5A' }}>No flights yet · click Fetch above</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail table */}
      <div style={{ border:'1px solid #E6DFCC', borderRadius:6, background:'#FFFFFF', padding:14 }}>
        <div style={{ fontSize:12, fontWeight:600, marginBottom:8, color:'#1B1B1B' }}>Flight schedule detail</div>
        <div style={{ overflow:'auto', maxHeight:600 }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Origin</th>
                <th style={th}>Airline · Flight #</th>
                <th style={th}>Depart</th>
                <th style={th}>Arrive</th>
                <th style={{ ...th, textAlign:'right' }}>Stops</th>
                <th style={{ ...th, textAlign:'right' }}>Duration (min)</th>
                <th style={{ ...th, textAlign:'right' }}>Lowest fare</th>
                <th style={th}>Book</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.flight_date}</td>
                  <td style={td}>{r.origin}</td>
                  <td style={td}>{[r.airline, r.flight_number].filter(Boolean).join(' · ') || '—'}</td>
                  <td style={td}>{r.dep_time_local ?? '—'}</td>
                  <td style={td}>{r.arr_time_local ?? '—'}</td>
                  <td style={{ ...td, textAlign:'right' }}>{r.stops ?? '—'}</td>
                  <td style={{ ...td, textAlign:'right' }}>{r.duration_min ?? '—'}</td>
                  <td style={{ ...td, textAlign:'right' }}>{r.price_lowest != null ? `${r.currency ?? 'USD'} ${r.price_lowest}` : '—'}</td>
                  <td style={td}>{r.booking_url ? <a href={r.booking_url} target="_blank" rel="noreferrer" style={{ color:'#084838' }}>→</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { fontSize:11, fontWeight:600, color:'#5A5A5A', marginRight:4 };
const inp: React.CSSProperties = { padding:'6px 10px', fontSize:12, border:'1px solid #E6DFCC', borderRadius:4, background:'#FFFFFF', color:'#1B1B1B' };
const btnRun: React.CSSProperties = { padding:'8px 20px', fontSize:12, fontWeight:600, background:'#084838', color:'#FFFFFF', border:'1px solid #084838', borderRadius:4, cursor:'pointer' };
const tbl: React.CSSProperties = { borderCollapse:'collapse', width:'100%' };
const th: React.CSSProperties = { textAlign:'left', padding:'6px 8px', fontSize:11, fontWeight:600, color:'#5A5A5A', borderBottom:'1px solid #E6DFCC', whiteSpace:'nowrap' };
const td: React.CSSProperties = { padding:'6px 8px', fontSize:12, color:'#1B1B1B', borderBottom:'1px solid #F0EBD9', whiteSpace:'nowrap' };