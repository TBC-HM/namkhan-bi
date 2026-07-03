// app/guest/directory/_components/DirectoryClient.tsx
// PBS 2026-07-03 v2: single-column layout · country chip row · full-width table.
// No sidebar (that pushed content into a narrow right column inside the
// DashboardPage `auto-fit minmax(360px)` grid).

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
type SortKey = 'full_name' | 'country' | 'stays_count' | 'bookings_count' | 'last_stay_date' | 'upcoming_stay_date' | 'top_source';
type SortDir = 'asc' | 'desc';

export default function DirectoryClient({
  initialRows, facets,
}: { initialRows: ProfileRow[]; facets: FacetRow[] }) {
  const [q, setQ] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [arrival, setArrival] = useState<ArrivalWindow>('any');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [contactableOnly, setContactableOnly] = useState(false);
  const [selected, setSelected] = useState<ProfileRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('last_stay_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir(k === 'stays_count' || k === 'bookings_count' || k === 'last_stay_date' || k === 'upcoming_stay_date' ? 'desc' : 'asc');
    }
  }

  const filtered = useMemo(() => {
    const qL = q.trim().toLowerCase();
    const rows = initialRows.filter((r) => {
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
    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sortKey] as unknown;
      const bv = b[sortKey] as unknown;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // nulls always last
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }, [initialRows, q, country, arrival, repeatOnly, contactableOnly, sortKey, sortDir]);

  const topCountries = facets.slice(0, 15);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {/* Search + filter row (full width) */}
      <Container title="Search" subtitle="name · email · country · source · segment" density="compact">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type to search…"
            style={{
              flex: '1 1 260px',
              padding: '9px 14px',
              border: '1px solid #E6DFCC', borderRadius: 4,
              background: '#FFFFFF', color: '#1B1B1B',
              fontSize: 14, fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'inline-flex', gap: 4 }}>
            <span style={filterLabelStyle}>Arrival</span>
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

        {/* Country chip row */}
        {topCountries.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10, alignItems: 'center' }}>
            <span style={filterLabelStyle}>Country</span>
            <button
              type="button"
              onClick={() => setCountry(null)}
              style={pillStyle(country === null)}
            >All</button>
            {topCountries.map((f) => (
              <button
                key={f.country}
                type="button"
                onClick={() => setCountry(country === f.country ? null : f.country)}
                style={pillStyle(country === f.country)}
              >
                {f.country || '—'} <span style={{ opacity: 0.6, marginLeft: 3 }}>{f.guest_count}</span>
              </button>
            ))}
          </div>
        )}
      </Container>

      {/* Results table (full width) */}
      <Container title={`Guest profiles · ${filtered.length}`} subtitle={`of ${initialRows.length} loaded · click a row for the profile drawer`} density="compact">
        {filtered.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>
            No guests match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                  <SortableTh label="Name"         k="full_name"          currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Country"      k="country"            currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <th style={th}>Contact</th>
                  <SortableTh label="Stays"        k="stays_count"        currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} align="right" />
                  <SortableTh label="Bookings"     k="bookings_count"     currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} align="right" />
                  <SortableTh label="Last stay"    k="last_stay_date"     currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Next arrival" k="upcoming_stay_date" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Source"       k="top_source"         currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r) => (
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
            {filtered.length > 500 && (
              <div style={{ padding: '10px 12px', fontSize: 11, color: '#5A5A5A', fontStyle: 'italic', textAlign: 'center' }}>
                Showing 500 of {filtered.length} matches — search or filter to narrow.
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
          width: 440, maxWidth: '100vw', height: '100%',
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
            background: 'transparent', border: 'none', fontSize: 22, color: '#5A5A5A', cursor: 'pointer', padding: '0 4px',
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

function SortableTh({ label, k, currentKey, currentDir, onClick, align }: {
  label: string; k: SortKey; currentKey: SortKey; currentDir: SortDir;
  onClick: (k: SortKey) => void; align?: 'left' | 'right';
}) {
  const active = currentKey === k;
  const arrow = !active ? '' : currentDir === 'asc' ? ' ↑' : ' ↓';
  return (
    <th
      onClick={() => onClick(k)}
      style={{
        ...th,
        textAlign: align === 'right' ? 'right' : 'left',
        cursor: 'pointer',
        userSelect: 'none',
        color: active ? '#1F3A2E' : '#1B1B1B',
      }}
      title={`Sort by ${label}`}
    >
      {label}<span style={{ opacity: active ? 0.85 : 0.25, fontSize: 10, marginLeft: 3 }}>{active ? arrow : ' ↕'}</span>
    </th>
  );
}

// ---- styles ------------------------------------------------------------
function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 99, fontSize: 11,
    background: active ? '#1F3A2E' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#1B1B1B',
    border: `1px solid ${active ? '#1F3A2E' : '#E6DFCC'}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: active ? 600 : 500,
    whiteSpace: 'nowrap',
  };
}
const filterLabelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#5A5A5A', fontWeight: 600, marginRight: 4,
};
const checkboxStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 12, color: '#1B1B1B', cursor: 'pointer',
  whiteSpace: 'nowrap',
};
function contactDotStyle(color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 99, background: '#F5F0E1', color, fontSize: 12, marginRight: 3 };
}
const th: React.CSSProperties = {
  padding: '8px 10px', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#1B1B1B', textAlign: 'left',
};
const tdL: React.CSSProperties = {
  padding: '7px 10px', fontSize: 12, color: '#1B1B1B',
  whiteSpace: 'nowrap',
};
const tdR: React.CSSProperties = {
  padding: '7px 10px', fontSize: 12, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums', color: '#1B1B1B',
};
