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
type PastWindow = 'any' | 'last_30' | 'last_90' | 'last_365' | 'older';
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
  const [country, setCountry]   = useState('');
  const [source, setSource]     = useState('');
  const [segment, setSegment]   = useState('');
  const [room, setRoom]         = useState('');
  const [ratePlan, setRatePlan] = useState('');
  const [party, setParty]       = useState('');
  const [language, setLanguage] = useState('');
  const [arrival, setArrival] = useState<ArrivalWindow>('any');
  const [pastStay, setPastStay] = useState<PastWindow>('any');
  const [spendFilter, setSpendFilter] = useState<'any' | 'restaurant' | 'spa' | 'activities' | 'retail'>('any');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [contactableOnly, setContactableOnly] = useState(false);
  const [selected, setSelected] = useState<DirectoryRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('upcoming_stay_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function clearAll() {
    setQ(''); setCountry(''); setSource(''); setSegment('');
    setRoom(''); setRatePlan(''); setParty(''); setLanguage('');
    setArrival('any'); setPastStay('any'); setSpendFilter('any');
    setRepeatOnly(false); setContactableOnly(false);
  }
  const activeFilterCount =
    (q.length >= 2 ? 1 : 0) + (country ? 1 : 0) + (source ? 1 : 0) + (segment ? 1 : 0) +
    (room ? 1 : 0) + (ratePlan ? 1 : 0) + (party ? 1 : 0) + (language ? 1 : 0) +
    (arrival !== 'any' ? 1 : 0) + (pastStay !== 'any' ? 1 : 0) + (spendFilter !== 'any' ? 1 : 0) +
    (repeatOnly ? 1 : 0) + (contactableOnly ? 1 : 0);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      // default direction: numerics + dates DESC, text ASC
      setSortDir(NUMERIC_SORTS.has(k) || DATE_SORTS.has(k) ? 'desc' : 'asc');
    }
  }

  // Facet options — computed once per initialRows change so dropdowns list
  // exactly what's available in the loaded set (no dead options).
  const options = useMemo(() => {
    const bump = (m: Map<string, number>, k: string | null | undefined) => {
      const key = (k ?? '').trim();
      if (!key) return;
      m.set(key, (m.get(key) ?? 0) + 1);
    };
    const oC = new Map<string, number>(), oS = new Map<string, number>();
    const oSeg = new Map<string, number>(), oRoom = new Map<string, number>();
    const oRP = new Map<string, number>(), oP = new Map<string, number>();
    const oLang = new Map<string, number>();
    for (const r of initialRows) {
      bump(oC,    r.country);
      bump(oS,    r.last_source ?? r.top_source);
      bump(oSeg,  r.last_segment ?? r.top_segment);
      bump(oRoom, r.last_room_type);
      bump(oRP,   r.last_rate_plan);
      bump(oP,    r.party_type);
      bump(oLang, r.language);
    }
    const toSorted = (m: Map<string, number>) => Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([v, n]) => ({ v, n }));
    return {
      countries: toSorted(oC),
      sources:   toSorted(oS),
      segments:  toSorted(oSeg),
      rooms:     toSorted(oRoom),
      ratePlans: toSorted(oRP),
      parties:   toSorted(oP),
      languages: toSorted(oLang),
    };
  }, [initialRows]);

  const filtered = useMemo(() => {
    const qL = q.trim().toLowerCase();
    const rows = initialRows.filter((r) => {
      if (qL.length >= 2) {
        const hay = [r.full_name, r.email, r.phone, r.country, r.top_source, r.top_segment, r.last_room_type, r.last_rate_plan, r.last_segment]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(qL)) return false;
      }
      if (country  && r.country !== country) return false;
      if (source   && (r.last_source ?? r.top_source) !== source) return false;
      if (segment  && (r.last_segment ?? r.top_segment) !== segment) return false;
      if (room     && r.last_room_type !== room) return false;
      if (ratePlan && r.last_rate_plan !== ratePlan) return false;
      if (party    && r.party_type !== party) return false;
      if (language && r.language !== language) return false;
      if (repeatOnly && !r.is_repeat) return false;
      if (contactableOnly && !r.email && !r.phone) return false;
      if (arrival !== 'any') {
        const ok = arrival === 'next_7'  ? r.arrival_bucket === 'next_7'
                 : arrival === 'next_30' ? ['next_7','next_30'].includes(r.arrival_bucket ?? '')
                 : arrival === 'next_90' ? ['next_7','next_30','next_90'].includes(r.arrival_bucket ?? '')
                 : true;
        if (!ok) return false;
      }
      if (pastStay !== 'any') {
        if (!r.last_stay_date) return false;
        const days = Math.floor((Date.now() - new Date(r.last_stay_date).getTime()) / 86_400_000);
        if (pastStay === 'last_30'  && days > 30) return false;
        if (pastStay === 'last_90'  && days > 90) return false;
        if (pastStay === 'last_365' && days > 365) return false;
        if (pastStay === 'older'    && days <= 365) return false;
      }
      if (spendFilter !== 'any') {
        if (spendFilter === 'restaurant' && !r.spent_restaurant) return false;
        if (spendFilter === 'spa'        && !r.spent_spa)        return false;
        if (spendFilter === 'activities' && !r.spent_activities) return false;
        if (spendFilter === 'retail'     && !r.spent_retail)     return false;
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
  }, [initialRows, q, country, source, segment, room, ratePlan, party, language, arrival, pastStay, spendFilter, repeatOnly, contactableOnly, sortKey, sortDir]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {/* Search + horizontal dropdown filter row */}
      <Container title={activeFilterCount > 0 ? `Filters · ${activeFilterCount} active` : 'Filters'}
        subtitle="drill down on multiple dimensions at once · dropdowns show counts per option in the loaded set"
        density="compact"
        action={activeFilterCount > 0 ? (
          <button type="button" onClick={clearAll} style={{
            padding: '5px 10px', fontSize: 11, background: '#FFFFFF', color: '#B03826',
            border: '1px solid #E8B7AB', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
          }}>Clear all</button>
        ) : undefined}>
        {/* Search — full width */}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name · email · phone · country · source · segment · room · rate plan…"
          style={{
            width: '100%',
            padding: '10px 14px',
            border: '1px solid #E6DFCC', borderRadius: 4,
            background: '#FFFFFF', color: '#1B1B1B',
            fontSize: 14, fontFamily: 'inherit',
            marginBottom: 10,
          }}
        />

        {/* Dropdown row — 8 side-by-side dimension filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
          <Dropdown label="Country"    value={country}  onChange={setCountry}  options={options.countries} />
          <Dropdown label="Source"     value={source}   onChange={setSource}   options={options.sources} />
          <Dropdown label="Segment"    value={segment}  onChange={setSegment}  options={options.segments} />
          <Dropdown label="Room type"  value={room}     onChange={setRoom}     options={options.rooms} />
          <Dropdown label="Rate plan"  value={ratePlan} onChange={setRatePlan} options={options.ratePlans} />
          <Dropdown label="Party"      value={party}    onChange={setParty}    options={options.parties} />
          <Dropdown label="Language"   value={language} onChange={setLanguage} options={options.languages} />
          <DropdownArrival             value={arrival}  onChange={setArrival} />
          <DropdownPastStay            value={pastStay} onChange={setPastStay} />
          <DropdownSpend               value={spendFilter} onChange={setSpendFilter}
            counts={{
              restaurant: initialRows.filter(r => r.spent_restaurant).length,
              spa:        initialRows.filter(r => r.spent_spa).length,
              activities: initialRows.filter(r => r.spent_activities).length,
              retail:     initialRows.filter(r => r.spent_retail).length,
            }} />
        </div>

        {/* Checkboxes */}
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={checkboxStyle}>
            <input type="checkbox" checked={repeatOnly} onChange={(e) => setRepeatOnly(e.target.checked)} />
            Repeat only
          </label>
          <label style={checkboxStyle}>
            <input type="checkbox" checked={contactableOnly} onChange={(e) => setContactableOnly(e.target.checked)} />
            Contactable only
          </label>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#5A5A5A' }}>
            {filtered.length.toLocaleString()} / {initialRows.length.toLocaleString()} guests match
          </div>
        </div>
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
                  <th style={th} title="Spend flags · R=Restaurant · S=Spa · A=Activities · T=reTail">Spend</th>
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
                    <td style={tdSpend}>
                      {r.spent_restaurant && <span title="Restaurant"    style={spendBadge('#E4F0E1','#1F5C2C')}>R</span>}
                      {r.spent_spa        && <span title="Spa"           style={spendBadge('#F5EAF7','#7A2C86')}>S</span>}
                      {r.spent_activities && <span title="Activities"    style={spendBadge('#E4EBF5','#1F3A6F')}>A</span>}
                      {r.spent_retail     && <span title="Retail"        style={spendBadge('#FBEDD8','#8B5A1C')}>T</span>}
                      {!r.spent_restaurant && !r.spent_spa && !r.spent_activities && !r.spent_retail && <span style={{ color: '#8A8A8A', fontSize: 10 }}>—</span>}
                    </td>
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

function Dropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; n: number }[];
}) {
  return (
    <div>
      <div style={dropdownLabelStyle}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...selectStyle,
          borderColor: value ? '#1F3A2E' : '#E6DFCC',
          fontWeight: value ? 600 : 400,
          color: value ? '#1F3A2E' : '#1B1B1B',
        }}
      >
        <option value="">All ({options.reduce((s, o) => s + o.n, 0)})</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.v} ({o.n})</option>
        ))}
      </select>
    </div>
  );
}

function DropdownArrival({ value, onChange }: {
  value: ArrivalWindow; onChange: (v: ArrivalWindow) => void;
}) {
  const active = value !== 'any';
  return (
    <div>
      <div style={dropdownLabelStyle}>Arrival (future)</div>
      <select value={value} onChange={(e) => onChange(e.target.value as ArrivalWindow)}
        style={{ ...selectStyle, borderColor: active ? '#1F3A2E' : '#E6DFCC', fontWeight: active ? 600 : 400, color: active ? '#1F3A2E' : '#1B1B1B' }}>
        <option value="any">Any</option>
        <option value="next_7">Next 7d</option>
        <option value="next_30">Next 30d</option>
        <option value="next_90">Next 90d</option>
      </select>
    </div>
  );
}

function DropdownPastStay({ value, onChange }: {
  value: PastWindow; onChange: (v: PastWindow) => void;
}) {
  const active = value !== 'any';
  return (
    <div>
      <div style={dropdownLabelStyle}>Last stay (past)</div>
      <select value={value} onChange={(e) => onChange(e.target.value as PastWindow)}
        style={{ ...selectStyle, borderColor: active ? '#1F3A2E' : '#E6DFCC', fontWeight: active ? 600 : 400, color: active ? '#1F3A2E' : '#1B1B1B' }}>
        <option value="any">Any</option>
        <option value="last_30">Last 30d</option>
        <option value="last_90">Last 90d</option>
        <option value="last_365">Last 12m</option>
        <option value="older">More than 12m ago</option>
      </select>
    </div>
  );
}

type SpendKey = 'any' | 'restaurant' | 'spa' | 'activities' | 'retail';
function DropdownSpend({ value, onChange, counts }: {
  value: SpendKey;
  onChange: (v: SpendKey) => void;
  counts: { restaurant: number; spa: number; activities: number; retail: number };
}) {
  const active = value !== 'any';
  return (
    <div>
      <div style={dropdownLabelStyle}>Spend on</div>
      <select value={value} onChange={(e) => onChange(e.target.value as SpendKey)}
        style={{ ...selectStyle, borderColor: active ? '#1F3A2E' : '#E6DFCC', fontWeight: active ? 600 : 400, color: active ? '#1F3A2E' : '#1B1B1B' }}>
        <option value="any">Any</option>
        <option value="restaurant">Restaurant ({counts.restaurant})</option>
        <option value="spa">Spa ({counts.spa})</option>
        <option value="activities">Activities ({counts.activities})</option>
        <option value="retail">Retail ({counts.retail})</option>
      </select>
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
const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #E6DFCC',
  borderRadius: 4,
  background: '#FFFFFF',
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const dropdownLabelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#5A5A5A', fontWeight: 600, marginBottom: 3,
};
const tdSpend: React.CSSProperties = {
  padding: '5px 8px', fontSize: 12,
  display: 'flex', flexDirection: 'row', gap: 3,
  alignItems: 'center', whiteSpace: 'nowrap',
};
function spendBadge(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 18, height: 18, borderRadius: 4,
    background: bg, color, fontSize: 10, fontWeight: 700,
  };
}
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
