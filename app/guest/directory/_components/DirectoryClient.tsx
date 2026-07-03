// app/guest/directory/_components/DirectoryClient.tsx
// PBS 2026-07-03 v3: full guest directory client.
// - Sortable columns (Name, Country, Stays, Bookings, Last stay, Next arrival,
//   Room, Rate plan, Segment, Party, ADR, Source).
// - Email + phone as plain text at the TOP of each row's contact cell.
// - Country facets computed from loaded rows (server-side property scope).

'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import type { DirectoryRow } from '../page';

interface FacetRow { country: string; guest_count: number }
type ArrivalWindow = 'any' | 'next_7' | 'next_30' | 'next_90';
type SortKey =
  | 'full_name' | 'country' | 'stays_count' | 'bookings_count'
  | 'last_stay_date' | 'upcoming_stay_date' | 'top_source'
  | 'last_room_type' | 'last_rate_plan' | 'last_segment' | 'party_type' | 'last_adr';
type SortDir = 'asc' | 'desc';

const NUMERIC_SORTS: Set<SortKey> = new Set(['stays_count','bookings_count','last_adr']);
const DATE_SORTS:    Set<SortKey> = new Set(['last_stay_date','upcoming_stay_date']);

export default function DirectoryClient({
  initialRows, facets,
}: { initialRows: DirectoryRow[]; facets: FacetRow[] }) {
  const [q, setQ] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [arrival, setArrival] = useState<ArrivalWindow>('any');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [contactableOnly, setContactableOnly] = useState(false);
  const [selected, setSelected] = useState<DirectoryRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('upcoming_stay_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      // default direction: numerics + dates DESC, text ASC
      setSortDir(NUMERIC_SORTS.has(k) || DATE_SORTS.has(k) ? 'desc' : 'asc');
    }
  }

  const filtered = useMemo(() => {
    const qL = q.trim().toLowerCase();
    const rows = initialRows.filter((r) => {
      if (qL.length >= 2) {
        const hay = [r.full_name, r.email, r.phone, r.country, r.top_source, r.top_segment, r.last_room_type, r.last_rate_plan, r.last_segment]
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

    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sortKey] as unknown;
      const bv = b[sortKey] as unknown;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // nulls last
      if (bv == null) return -1;
      if (NUMERIC_SORTS.has(sortKey)) return ((av as number) - (bv as number)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }, [initialRows, q, country, arrival, repeatOnly, contactableOnly, sortKey, sortDir]);

  const topCountries = facets.slice(0, 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {/* Search + filter */}
      <Container title="Search" subtitle="name · email · phone · country · source · segment · room · rate plan" density="compact">
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
                key={k} type="button"
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
            >All <span style={{ opacity: 0.6, marginLeft: 3 }}>{initialRows.length}</span></button>
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

      {/* Results table */}
      <Container title={`Guest profiles · ${filtered.length}`} subtitle={`of ${initialRows.length} loaded · click a row for the full profile`} density="compact">
        {filtered.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>
            No guests match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                  <SortableTh label="Name"        k="full_name"          currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Country"     k="country"            currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <th style={th}>Contact</th>
                  <SortableTh label="Stays"       k="stays_count"        currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} align="right" />
                  <SortableTh label="Bookings"    k="bookings_count"     currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} align="right" />
                  <SortableTh label="Last stay"   k="last_stay_date"     currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Next"        k="upcoming_stay_date" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Room"        k="last_room_type"     currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Rate plan"   k="last_rate_plan"     currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Segment"     k="last_segment"       currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Party"       k="party_type"         currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="ADR"         k="last_adr"           currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} align="right" />
                  <SortableTh label="Source"      k="top_source"         currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
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
                      {r.is_repeat && <span style={badgeStyle('#E4F0E1','#1F5C2C')}>REPEAT</span>}
                    </td>
                    <td style={tdL}>{r.country ?? '—'}</td>
                    <td style={tdContact}>
                      {r.email  && <div style={contactLineEmail}>{r.email}</div>}
                      {r.phone  && <div style={contactLinePhone}>{r.phone}</div>}
                      {!r.email && !r.phone && <span style={{ color: '#B03826', fontSize: 10, fontStyle: 'italic' }}>no contact</span>}
                    </td>
                    <td style={tdR}>{r.stays_count}</td>
                    <td style={tdR}>{r.bookings_count}</td>
                    <td style={tdL}>{r.last_stay_date?.slice(0, 10) ?? '—'}</td>
                    <td style={tdL}>{r.upcoming_stay_date?.slice(0, 10) ?? '—'}</td>
                    <td style={tdL}>{r.last_room_type ?? '—'}</td>
                    <td style={tdL}>{r.last_rate_plan ?? '—'}</td>
                    <td style={tdL}>{r.last_segment ?? r.top_segment ?? '—'}</td>
                    <td style={tdL}>{r.party_type ?? '—'}</td>
                    <td style={tdR}>{r.last_adr != null ? Math.round(r.last_adr).toLocaleString('en-US') : '—'}</td>
                    <td style={tdL}>{r.last_source ?? r.top_source ?? '—'}</td>
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

function SortableTh({ label, k, currentKey, currentDir, onClick, align }: {
  label: string; k: SortKey; currentKey: SortKey; currentDir: SortDir;
  onClick: (k: SortKey) => void; align?: 'left' | 'right';
}) {
  const active = currentKey === k;
  return (
    <th
      onClick={() => onClick(k)}
      style={{
        ...th,
        textAlign: align === 'right' ? 'right' : 'left',
        cursor: 'pointer',
        userSelect: 'none',
        color: active ? '#1F3A2E' : '#1B1B1B',
        whiteSpace: 'nowrap',
      }}
      title={`Sort by ${label}`}
    >
      {label}
      <span style={{ opacity: active ? 0.9 : 0.25, fontSize: 10, marginLeft: 3 }}>
        {active ? (currentDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  );
}

function ProfileDrawer({ row, onClose }: { row: DirectoryRow; onClose: () => void }) {
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
          width: 460, maxWidth: '100vw', height: '100%',
          background: '#FFFFFF', borderLeft: '1px solid #E6DFCC',
          padding: 20, overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A' }}>Guest profile</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#1B1B1B', marginTop: 3 }}>{row.full_name ?? 'Unknown'}</div>
            <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 2 }}>
              {row.country ?? '—'} · {row.last_segment ?? row.top_segment ?? 'unsegmented'} · {row.is_repeat ? 'repeat guest' : 'first-timer'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', fontSize: 22, color: '#5A5A5A', cursor: 'pointer', padding: '0 4px',
          }}>×</button>
        </div>

        <div style={{ marginTop: 16, padding: '10px 12px', background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600, marginBottom: 4 }}>Contact</div>
          <div style={{ fontSize: 13, color: '#1B1B1B' }}>{row.email ?? <span style={{ color: '#8A8A8A' }}>no email</span>}</div>
          <div style={{ fontSize: 13, color: '#1B1B1B', marginTop: 2 }}>{row.phone ?? <span style={{ color: '#8A8A8A' }}>no phone</span>}</div>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <Fact label="Stays" value={String(row.stays_count)} />
          <Fact label="Bookings" value={String(row.bookings_count)} />
          <Fact label="Cancellations" value={String(row.cancellations_count)} />
          <Fact label="Marketing-ready" value={row.marketing_readiness_score != null ? row.marketing_readiness_score.toFixed(1) : '—'} />
          <Fact label="Last stay" value={row.last_stay_date?.slice(0, 10) ?? '—'} />
          <Fact label="Next arrival" value={row.upcoming_stay_date?.slice(0, 10) ?? '—'} />
          <Fact label="Last room" value={row.last_room_type ?? '—'} span={2} />
          <Fact label="Last rate plan" value={row.last_rate_plan ?? '—'} span={2} />
          <Fact label="Party" value={row.party_type ? `${row.party_type} (${row.last_adults ?? '?'}A${row.last_children ? ' + ' + row.last_children + 'C' : ''})` : '—'} />
          <Fact label="Last ADR" value={row.last_adr != null ? Math.round(row.last_adr).toLocaleString('en-US') : '—'} />
          <Fact label="Top source" value={row.last_source ?? row.top_source ?? '—'} span={2} />
          {row.city && <Fact label="City" value={row.city} span={2} />}
          {row.language && <Fact label="Language" value={row.language} span={2} />}
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
function badgeStyle(bg: string, color: string): React.CSSProperties {
  return {
    marginLeft: 6, padding: '1px 6px', fontSize: 9,
    background: bg, color, borderRadius: 99, letterSpacing: '0.04em',
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
const tdContact: React.CSSProperties = {
  padding: '4px 10px', fontSize: 11, color: '#1B1B1B',
  maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
};
const contactLineEmail: React.CSSProperties = {
  color: '#1F3A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const contactLinePhone: React.CSSProperties = {
  color: '#1B1B1B', fontVariantNumeric: 'tabular-nums',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2,
};
