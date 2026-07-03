// app/guest/directory/_components/DirectoryClient.tsx
// PBS 2026-07-03: searchable guest directory · client-side · paper-white.
// Debounced text search + country facet + repeat/contactable/arrival filters.
// Currency intentionally not shown.

'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';

interface ProfileRow {
  guest_id: string;
  full_name: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  stays_count: number;
  bookings_count: number;
  cancellations_count: number;
  last_stay_date: string | null;
  upcoming_stay_date: string | null;
  arrival_bucket: string | null;
  top_source: string | null;
  top_segment: string | null;
  is_repeat: boolean;
  marketing_readiness_score: number | null;
}

interface FacetRow {
  country: string;
  guest_count: number;
  total_stays: number;
  repeat_guests: number;
  contactable_email: number;
  contactable_phone: number;
  arriving_30d: number;
}

type ArrivalWindow = 'any' | 'next_7' | 'next_30' | 'next_90';

export default function DirectoryClient({
  initialRows, facets,
}: { initialRows: ProfileRow[]; facets: FacetRow[] }) {
  const [q, setQ] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [arrival, setArrival] = useState<ArrivalWindow>('any');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [contactableOnly, setContactableOnly] = useState(false);
  const [selected, setSelected] = useState<ProfileRow | null>(null);

  const filtered = useMemo(() => {
    const qL = q.trim().toLowerCase();
    return initialRows.filter((r) => {
      if (qL.length >= 2) {
        const hay = [r.full_name, r.email, r.country, r.top_source, r.top_segment]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(qL)) return false;
      }
      if (country && r.country !== country) return false;
      if (repeatOnly && !r.is_repeat) return false;
      if (contactableOnly && !r.email && !r.phone) return false;
      if (arrival !== 'any') {
        const ok = arrival === 'next_7'  ? r.arrival_bucket === 'next_7'
                 : arrival === 'next_30' ? ['next_7','next_30'].includes(r.arrival_bucket ?? '')
                 : arrival === 'next_90' ? ['next_7','next_30','next_90'].includes(r.arrival_bucket ?? '')
                 : true;
        if (!ok) return false;
      }
      return true;
    });
  }, [initialRows, q, country, arrival, repeatOnly, contactableOnly]);

  const topCountries = facets.slice(0, 12);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 12, alignItems: 'start' }}>
      {/* Left: country facets */}
      <Container title={`Countries · ${facets.length}`} subtitle={country ? `filtered by ${country}` : 'top 12 by guest count'} density="compact">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            type="button"
            onClick={() => setCountry(null)}
            style={facetBtnStyle(country === null)}
          >
            <span>All countries</span>
            <span style={countStyle(country === null)}>{facets.reduce((s, f) => s + f.guest_count, 0)}</span>
          </button>
          {topCountries.map((f) => (
            <button
              key={f.country}
              type="button"
              onClick={() => setCountry(country === f.country ? null : f.country)}
              style={facetBtnStyle(country === f.country)}
            >
              <span>{f.country || '—'}</span>
              <span style={countStyle(country === f.country)}>{f.guest_count}</span>
            </button>
          ))}
        </div>
      </Container>

      {/* Right: search + filters + table */}
      <Container title={`Guest profiles · ${filtered.length}`} subtitle={`of ${initialRows.length} loaded · sorted by soonest arrival`} density="compact">
        {/* Search + filter row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, country, source…"
            style={{
              flex: 1, minWidth: 220,
              padding: '8px 12px',
              border: '1px solid #E6DFCC', borderRadius: 4,
              background: '#FFFFFF', color: '#1B1B1B',
              fontSize: 13, fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {(['any','next_7','next_30','next_90'] as ArrivalWindow[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setArrival(k)}
                style={pillStyle(arrival === k)}
              >{k === 'any' ? 'Any' : k === 'next_7' ? '7d' : k === 'next_30' ? '30d' : '90d'}</button>
            ))}
          </div>
          <label style={checkboxStyle}>
            <input type="checkbox" checked={repeatOnly} onChange={(e) => setRepeatOnly(e.target.checked)} />
            Repeat only
          </label>
          <label style={checkboxStyle}>
            <input type="checkbox" checked={contactableOnly} onChange={(e) => setContactableOnly(e.target.checked)} />
            Contactable only
          </label>
        </div>

        {/* Results table */}
        {filtered.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>
            No guests match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                  <th style={th}>Name</th>
                  <th style={th}>Country</th>
                  <th style={th}>Contact</th>
                  <th style={{ ...th, textAlign: 'right' }}>Stays</th>
                  <th style={{ ...th, textAlign: 'right' }}>Bookings</th>
                  <th style={th}>Last stay</th>
                  <th style={th}>Next arrival</th>
                  <th style={th}>Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((r) => (
                  <tr
                    key={r.guest_id}
                    onClick={() => setSelected(r)}
                    style={{ borderTop: '1px solid #E6DFCC', cursor: 'pointer' }}
                  >
                    <td style={tdL}>
                      <span style={{ fontWeight: 500 }}>{r.full_name ?? 'Unknown'}</span>
                      {r.is_repeat && <span style={{ marginLeft: 6, padding: '1px 6px', fontSize: 9, background: '#E4F0E1', color: '#1F5C2C', borderRadius: 99, letterSpacing: '0.04em' }}>REPEAT</span>}
                    </td>
                    <td style={tdL}>{r.country ?? '—'}</td>
                    <td style={tdL}>
                      {r.email && <span title={r.email} style={contactDotStyle('#1F3A2E')}>✉</span>}
                      {r.phone && <span title={r.phone} style={contactDotStyle('#1F3A2E')}>☎</span>}
                      {!r.email && !r.phone && <span style={{ color: '#B03826', fontSize: 10 }}>none</span>}
                    </td>
                    <td style={tdR}>{r.stays_count}</td>
                    <td style={tdR}>{r.bookings_count}</td>
                    <td style={tdL}>{r.last_stay_date?.slice(0, 10) ?? '—'}</td>
                    <td style={tdL}>{r.upcoming_stay_date?.slice(0, 10) ?? '—'}</td>
                    <td style={tdL}>{r.top_source ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <div style={{ padding: '10px 12px', fontSize: 11, color: '#5A5A5A', fontStyle: 'italic', textAlign: 'center' }}>
                Showing 100 of {filtered.length} matches — narrow the filter to see more.
              </div>
            )}
          </div>
        )}
      </Container>

      {/* Drawer */}
      {selected && <ProfileDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ProfileDrawer({ row, onClose }: { row: ProfileRow; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)',
        display: 'flex', justifyContent: 'flex-end', zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420, maxWidth: '100vw', height: '100%',
          background: '#FFFFFF', borderLeft: '1px solid #E6DFCC',
          padding: 20, overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A' }}>Guest profile</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#1B1B1B', marginTop: 3 }}>{row.full_name ?? 'Unknown'}</div>
            <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 2 }}>
              {row.country ?? '—'} · {row.top_segment ?? 'unsegmented'} · {row.is_repeat ? 'repeat guest' : 'first-timer'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', fontSize: 20, color: '#5A5A5A', cursor: 'pointer', padding: '0 4px',
          }}>×</button>
        </div>

        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <Fact label="Stays" value={String(row.stays_count)} />
          <Fact label="Bookings" value={String(row.bookings_count)} />
          <Fact label="Cancellations" value={String(row.cancellations_count)} />
          <Fact label="Marketing-ready" value={row.marketing_readiness_score != null ? row.marketing_readiness_score.toFixed(1) : '—'} />
          <Fact label="Last stay" value={row.last_stay_date?.slice(0, 10) ?? '—'} />
          <Fact label="Next arrival" value={row.upcoming_stay_date?.slice(0, 10) ?? '—'} />
          <Fact label="Top source" value={row.top_source ?? '—'} span={2} />
          <Fact label="Email" value={row.email ?? '—'} span={2} />
          <Fact label="Phone" value={row.phone ?? '—'} span={2} />
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, span = 1 }: { label: string; value: string; span?: 1 | 2 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1B1B1B', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

// ---- styles ------------------------------------------------------------
function facetBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
    padding: '6px 10px',
    background: active ? '#1F3A2E' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#1B1B1B',
    border: `1px solid ${active ? '#1F3A2E' : '#E6DFCC'}`,
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  };
}
function countStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 10, fontVariantNumeric: 'tabular-nums',
    color: active ? 'rgba(255,255,255,0.7)' : '#5A5A5A',
  };
}
function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 99, fontSize: 11,
    background: active ? '#1F3A2E' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#1B1B1B',
    border: `1px solid ${active ? '#1F3A2E' : '#E6DFCC'}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: active ? 600 : 500,
  };
}
const checkboxStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 12, color: '#1B1B1B', cursor: 'pointer',
};
function contactDotStyle(color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 99, background: '#F5F0E1', color, fontSize: 11, marginRight: 3 };
}
const th: React.CSSProperties = {
  padding: '7px 10px', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#000', textAlign: 'left',
};
const tdL: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12, color: '#1B1B1B',
  whiteSpace: 'nowrap',
};
const tdR: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums', color: '#1B1B1B',
};
