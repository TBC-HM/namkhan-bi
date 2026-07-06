'use client';
// app/operations/_components/OpsFlightsContainer.tsx
// PBS 2026-07-06: Gold-tier container for Operations HoD — flights arriving/departing LPQ
// today + tomorrow. On-demand fetch only (no auto-scrape → no wasted Apify spend).
// Renders inside DashboardPage grid, respects design_system container primitive.
import { useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';

type Flight = {
  flight_date: string;
  origin: string;
  destination: string;
  airline: string | null;
  flight_number: string | null;
  dep_time_local: string | null;
  arr_time_local: string | null;
  price_lowest: number | null;
  currency: string | null;
};

export default function OpsFlightsContainer({ initial }: { initial: Flight[] }) {
  const [rows, setRows] = useState<Flight[]>(initial);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind:'ok'|'err'; text:string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

  const fetchNow = async () => {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch('/api/operations/flights-today', { method: 'POST' });
      const j = await res.json();
      if (j?.ok) {
        setRows((j.rows as Flight[]) ?? []);
        setMsg({ kind: 'ok', text: `Fetched ${j.items_returned ?? 0} flights across ${j.origins_fetched ?? 0} markets · saved ${j.inserted ?? 0}` });
      } else {
        setMsg({ kind: 'err', text: j?.error ?? 'failed' });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  const arrivalsToday = rows.filter(r => r.flight_date === today && r.destination === 'LPQ').slice(0, 7);
  const arrivalsTomorrow = rows.filter(r => r.flight_date === tomorrow && r.destination === 'LPQ').slice(0, 7);
  const departuresToday = rows.filter(r => r.flight_date === today && r.origin === 'LPQ').slice(0, 7);
  const departuresTomorrow = rows.filter(r => r.flight_date === tomorrow && r.origin === 'LPQ').slice(0, 7);

  const gridStyle: React.CSSProperties = { gridColumn: '1 / -1' };

  return (
    <div style={gridStyle}>
      <Container
        title="Flights to/from LPQ · today + tomorrow"
        subtitle={rows.length === 0 ? 'No flights loaded — click Fetch to load (Google Flights via Apify · ~$0.01)' : `${rows.length} flights loaded`}
        density="compact"
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <button onClick={fetchNow} disabled={loading} style={btn}>
            {loading ? 'Fetching…' : '⟳ Fetch now (BKK · CNX · HAN · VTE)'}
          </button>
          {msg && (
            <span style={{ fontSize: 11, color: msg.kind === 'ok' ? '#084838' : '#B04A2F' }}>
              {msg.text}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <MiniList label="Arrivals · today" date={today} rows={arrivalsToday} kind="arr" />
          <MiniList label="Arrivals · tomorrow" date={tomorrow} rows={arrivalsTomorrow} kind="arr" />
          <MiniList label="Departures · today" date={today} rows={departuresToday} kind="dep" />
          <MiniList label="Departures · tomorrow" date={tomorrow} rows={departuresTomorrow} kind="dep" />
        </div>
      </Container>
    </div>
  );
}

function MiniList({ label, date, rows, kind }: { label: string; date: string; rows: Flight[]; kind: 'arr' | 'dep' }) {
  return (
    <div style={{ background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4, padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#5A5A5A', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label} · {date} · showing {rows.length}
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 11, color: '#5A5A5A', padding: '10px 0', textAlign: 'center' }}>—</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={th}>{kind === 'arr' ? 'From' : 'To'}</th>
              <th style={th}>Airline · Flt#</th>
              <th style={{ ...th, textAlign: 'right' }}>{kind === 'arr' ? 'Arrives' : 'Departs'}</th>
              <th style={{ ...th, textAlign: 'right' }}>Fare</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={td}>{kind === 'arr' ? r.origin : r.destination}</td>
                <td style={td}>{[r.airline, r.flight_number].filter(Boolean).join(' ') || '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{(kind === 'arr' ? r.arr_time_local : r.dep_time_local) ?? '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.price_lowest != null ? `${r.currency ?? 'USD'} ${r.price_lowest}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const btn: React.CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 600, background: '#084838', color: '#FFFFFF', border: '1px solid #084838', borderRadius: 4, cursor: 'pointer' };
const th: React.CSSProperties = { textAlign: 'left', padding: '4px 6px', fontSize: 10, fontWeight: 600, color: '#5A5A5A', borderBottom: '1px solid #E6DFCC', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '4px 6px', fontSize: 11, color: '#1B1B1B', borderBottom: '1px solid #F0EBD9', whiteSpace: 'nowrap' };