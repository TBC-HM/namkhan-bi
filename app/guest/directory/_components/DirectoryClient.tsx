// app/guest/directory/_components/DirectoryClient.tsx
// PBS 2026-07-03 v3: full guest directory client.
// - Sortable columns (Name, Country, Stays, Bookings, Last stay, Next arrival,
//   Room, Rate plan, Segment, Party, ADR, Source).
// - Email + phone as plain text at the TOP of each row's contact cell.
// - Country facets computed from loaded rows (server-side property scope).

'use client';

import { useMemo, useState, useEffect } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import type { DirectoryRow } from '../page';
import { supabase } from '@/lib/supabase';

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
  const [newsletterOpen, setNewsletterOpen] = useState(false);

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

  const filteredEmailable = filtered.filter((r) => r.email && r.email.includes('@')).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {/* Search + horizontal dropdown filter row */}
      <Container title={activeFilterCount > 0 ? `Filters · ${activeFilterCount} active` : 'Filters'}
        subtitle="drill down on multiple dimensions at once · dropdowns show counts per option in the loaded set"
        density="compact"
        action={
          <div style={{ display: 'inline-flex', gap: 6 }}>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearAll} style={{
                padding: '5px 10px', fontSize: 11, background: '#FFFFFF', color: '#B03826',
                border: '1px solid #E8B7AB', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              }}>Clear all</button>
            )}
            <button type="button" onClick={() => setNewsletterOpen(true)} style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 600, background: '#1F3A2E', color: '#FFFFFF',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
            }}>✉ Newsletter ({filteredEmailable})</button>
          </div>
        }>
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

      {/* Newsletter modal */}
      {newsletterOpen && (
        <NewsletterModal
          filtered={filtered}
          filterSummary={{
            country, source, segment, room, ratePlan, party, language,
            arrival, pastStay, spendFilter, repeatOnly, contactableOnly,
          }}
          onClose={() => setNewsletterOpen(false)}
        />
      )}
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

// ---- Newsletter modal --------------------------------------------------
interface FilterSummary {
  country: string; source: string; segment: string; room: string; ratePlan: string;
  party: string; language: string;
  arrival: ArrivalWindow; pastStay: PastWindow; spendFilter: SpendKey;
  repeatOnly: boolean; contactableOnly: boolean;
}

function NewsletterModal({ filtered, filterSummary, onClose }: {
  filtered: DirectoryRow[]; filterSummary: FilterSummary; onClose: () => void;
}) {
  const emailable = filtered.filter((r) => r.email && r.email.includes('@'));

  type TemplateRow = {
    template_key: string; label: string; description: string | null;
    subject: string; body_md: string;
    blocks_json: Array<{ type: string; text?: string; url?: string; label?: string; alt?: string }>;
    preview_image: string | null;
  };
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateKey, setTemplateKey] = useState<string>('');

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  type Block =
    | { type: 'header';    text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'image';     url: string; alt?: string }
    | { type: 'cta';       label: string; url: string }
    | { type: 'divider' };
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [fromName, setFromName]   = useState('The Namkhan');
  const [fromEmail, setFromEmail] = useState('hello@thenamkhan.com');
  const [replyTo, setReplyTo]     = useState('');
  const [bookingCode, setBookingCode] = useState('');
  const [bookingUrl, setBookingUrl]   = useState('https://thenamkhan.com/book');

  type SchedMode = 'draft' | 'fixed' | 'relative';
  const [schedMode, setSchedMode] = useState<SchedMode>('draft');
  const [fixedKind, setFixedKind] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [fixedAt, setFixedAt]     = useState<string>('');
  const [relKind, setRelKind]     = useState<'before_checkin' | 'after_checkout'>('before_checkin');
  const [relDays, setRelDays]     = useState<number>(3);
  const [relHour, setRelHour]     = useState<number>(10);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy]     = useState(false);
  const [aiError, setAiError]   = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'compose' | 'preview'>('compose');

  useEffect(() => {
    let cancel = false;
    supabase.from('v_newsletter_templates').select('*').eq('is_active', true).then(({ data }) => {
      if (cancel) return;
      setTemplates((data as TemplateRow[]) ?? []);
    });
    return () => { cancel = true; };
  }, []);

  function pickTemplate(key: string) {
    setTemplateKey(key);
    const t = templates.find((x) => x.template_key === key);
    if (!t) return;
    setSubject(t.subject);
    setBody(t.body_md);
    setBlocks((t.blocks_json ?? []) as Block[]);
  }

  function aiProposeLocal() {
    const bits: string[] = [];
    if (filterSummary.country)  bits.push(`guests from ${filterSummary.country}`);
    if (filterSummary.segment)  bits.push(`${filterSummary.segment} segment`);
    if (filterSummary.party)    bits.push(`${filterSummary.party} travellers`);
    if (filterSummary.room)     bits.push(`who stayed in ${filterSummary.room}`);
    if (filterSummary.ratePlan) bits.push(`on the ${filterSummary.ratePlan} rate`);
    if (filterSummary.source)   bits.push(`booked via ${filterSummary.source}`);
    if (filterSummary.repeatOnly) bits.push('repeat guests');
    if (filterSummary.arrival !== 'any') bits.push(`arriving in the ${filterSummary.arrival.replace('_', ' ')}`);
    if (filterSummary.pastStay !== 'any') bits.push(`with last stay in the ${filterSummary.pastStay.replace('_', ' ')}`);
    if (filterSummary.spendFilter !== 'any') bits.push(`who spent on ${filterSummary.spendFilter}`);
    const audience = bits.length > 0 ? bits.join(' · ') : `all ${emailable.length} contactable guests`;
    setName(`Newsletter · ${audience.slice(0, 60)}`);
    setSubject('A note from The Namkhan');
    const bodyText = [
      `Dear {{first_name}},`,
      ``,
      `Thank you for choosing The Namkhan.`,
      ``,
      `We are writing to ${emailable.length} guest${emailable.length === 1 ? '' : 's'} in this segment:`,
      audience + '.',
      ``,
      `[EDIT ME]`,
      ``,
      `Warm regards,`,
      `The Namkhan team`,
    ].join('\n');
    setBody(bodyText);
    setBlocks([
      { type: 'header', text: 'A note from The Namkhan' },
      { type: 'paragraph', text: 'Dear {{first_name}},' },
      { type: 'paragraph', text: 'Thank you for choosing The Namkhan.' },
      { type: 'paragraph', text: bodyText.split('\n').slice(4, 6).join(' ') },
      { type: 'cta', label: 'Plan your next stay', url: 'https://thenamkhan.com/book' },
    ]);
  }

  async function aiProposeServer() {
    if (!aiPrompt.trim()) { aiProposeLocal(); return; }
    setAiBusy(true); setAiError(null);
    try {
      const res = await fetch('/api/newsletter/ai-propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, filterSummary, recipientCount: emailable.length }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      if (j.subject) setSubject(j.subject);
      if (j.body_md) setBody(j.body_md);
      if (Array.isArray(j.blocks)) setBlocks(j.blocks);
      if (!name) setName(`AI · ${aiPrompt.slice(0, 40)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiError(`AI route not available (${msg.slice(0,60)}); used local proposal.`);
      aiProposeLocal();
    } finally { setAiBusy(false); }
  }

  function addBlock(kind: Block['type']) {
    const b: Block =
      kind === 'header'    ? { type: 'header', text: 'New heading' } :
      kind === 'paragraph' ? { type: 'paragraph', text: 'Your paragraph text.' } :
      kind === 'image'     ? { type: 'image', url: '', alt: '' } :
      kind === 'cta'       ? { type: 'cta', label: 'Book with your code', url: bookingUrl || 'https://thenamkhan.com/book' } :
      { type: 'divider' };
    setBlocks((prev) => [...prev, b]);
  }
  function updateBlock(i: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b, ix) => (ix === i ? ({ ...b, ...patch } as Block) : b)));
  }
  function removeBlock(i: number) { setBlocks((prev) => prev.filter((_, ix) => ix !== i)); }
  function moveBlock(i: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
      return next;
    });
  }

  function subst(t: string): string {
    return t
      .replaceAll('{{first_name}}', 'Sophie')
      .replaceAll('{{full_name}}', 'Sophie Traveller')
      .replaceAll('{{booking_code}}', bookingCode || 'NK-XXXXXX');
  }
  const renderedInner = blocks.length > 0
    ? blocks.map((b, i) => {
        if (b.type === 'header')    return <h2 key={i} style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1B1B1B', margin: '18px 0 8px 0' }}>{subst(b.text)}</h2>;
        if (b.type === 'paragraph') return <p key={i} style={{ fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.6, color: '#1B1B1B', margin: '8px 0' }}>{subst(b.text)}</p>;
        if (b.type === 'image')     return b.url ? <img key={i} src={b.url} alt={b.alt || ''} style={{ maxWidth: '100%', borderRadius: 4, margin: '12px 0' }} /> : null;
        if (b.type === 'cta')       return (
          <p key={i} style={{ textAlign: 'center', margin: '18px 0' }}>
            <span style={{ display: 'inline-block', padding: '10px 18px', background: '#1F3A2E', color: '#FFFFFF', borderRadius: 4, fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 600 }}>{subst(b.label)}</span>
          </p>
        );
        if (b.type === 'divider')   return <hr key={i} style={{ border: 'none', borderTop: '1px solid #E6DFCC', margin: '16px 0' }} />;
        return null;
      })
    : (body ? <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.6, color: '#1B1B1B', whiteSpace: 'pre-wrap' }}>{subst(body)}</div> : <div style={{ color: '#5A5A5A', fontSize: 12 }}>Nothing to preview yet — start with a template or the AI proposal.</div>);

  async function save() {
    setSaving(true); setSaveMsg(null);
    const guestIds = emailable.map((r) => r.guest_id);
    const scheduledAt = schedMode === 'fixed' && fixedAt ? new Date(fixedAt).toISOString() : null;
    const relParams = schedMode === 'relative'
      ? { p_relative_kind: relKind, p_relative_days: relDays, p_relative_hour: relHour }
      : { p_relative_kind: null, p_relative_days: null, p_relative_hour: 10 };

    const { data, error } = await supabase.rpc('fn_create_campaign_v2', {
      p_property_id:   260955,
      p_name:          name || subject || 'Untitled campaign',
      p_subject:       subject,
      p_body_md:       body,
      p_blocks_json:   blocks as unknown as Record<string, unknown>[],
      p_template_key:  templateKey || null,
      p_filter_json:   filterSummary as unknown as Record<string, unknown>,
      p_schedule_kind: schedMode === 'fixed' ? fixedKind : 'once',
      p_scheduled_at:  scheduledAt,
      p_guest_ids:     guestIds,
      p_from_name:     fromName,
      p_from_email:    fromEmail,
      p_reply_to:      replyTo || null,
      p_booking_code:  bookingCode || null,
      p_booking_url:   bookingUrl || null,
      p_test_recipients: [],
      p_ai_prompt:     aiPrompt || null,
      p_ai_model:      null,
      p_created_by:    'pbsbase@gmail.com',
      ...relParams,
    });
    setSaving(false);
    if (error) { setSaveMsg('Error: ' + error.message); return; }
    setSaveMsg(
      schedMode === 'draft'
        ? `Draft saved · id ${String(data).slice(0,8)}…`
        : `Campaign scheduled · id ${String(data).slice(0,8)}…`
    );
  }

  const canSave = !!subject && (!!body || blocks.length > 0) && emailable.length > 0;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      zIndex: 200, padding: 40, overflowY: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 880, maxWidth: '100%',
        background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
        padding: 22, boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A' }}>Newsletter</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#1B1B1B', marginTop: 3 }}>
              Compose to {emailable.length} guest{emailable.length === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 2 }}>
              {filtered.length - emailable.length > 0
                ? `${filtered.length - emailable.length} filtered rows have no email and are skipped`
                : 'all filtered rows have an email'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', fontSize: 22, color: '#5A5A5A', cursor: 'pointer', padding: '0 4px',
          }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 14, borderBottom: '1px solid #E6DFCC' }}>
          <button type="button" onClick={() => setTab('compose')} style={tabBtn(tab === 'compose')}>Compose</button>
          <button type="button" onClick={() => setTab('preview')} style={tabBtn(tab === 'preview')}>Preview</button>
        </div>

        {tab === 'compose' && (
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <div>
              <div style={fieldLabelStyle}>Template</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button type="button" onClick={() => { setTemplateKey(''); }} style={pillStyle(templateKey === '')}>Blank</button>
                {templates.map((t) => (
                  <button key={t.template_key} type="button" onClick={() => pickTemplate(t.template_key)} style={pillStyle(templateKey === t.template_key)} title={t.description ?? ''}>{t.label}</button>
                ))}
              </div>
            </div>

            <div style={{ border: '1px solid #E6DFCC', background: '#F5F0E1', padding: 12, borderRadius: 4 }}>
              <div style={fieldLabelStyle}>AI proposal</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. Chinese New Year offer for Singapore guests who spent on spa" style={{ ...modalInput, flex: 1 }} />
                <button type="button" onClick={aiProposeServer} disabled={aiBusy} style={{
                  padding: '9px 14px', fontSize: 12, fontWeight: 600, background: '#1B1B1B', color: '#FFFFFF',
                  border: 'none', borderRadius: 4, cursor: aiBusy ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>{aiBusy ? '…' : 'Propose'}</button>
              </div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 6 }}>
                {aiError ?? 'Uses filter + audience context. Leave blank to use a local deterministic proposal.'}
              </div>
            </div>

            <div>
              <div style={fieldLabelStyle}>Campaign name (internal)</div>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 repeat-guest re-engagement" style={modalInput} />
            </div>

            <div>
              <div style={fieldLabelStyle}>Subject</div>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="The subject line guests see in their inbox" style={modalInput} />
            </div>

            <div>
              <div style={fieldLabelStyle}>Blocks (visual editor · overrides Markdown body when non-empty)</div>
              {blocks.length === 0 && <div style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 6 }}>No blocks yet — add one below, or fill the Markdown body instead.</div>}
              {blocks.map((b, i) => (
                <div key={i} style={{ border: '1px solid #E6DFCC', borderRadius: 4, padding: 8, marginBottom: 6, background: '#FFFFFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A' }}>{b.type}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => moveBlock(i, -1)} style={smallBtn}>↑</button>
                      <button type="button" onClick={() => moveBlock(i,  1)} style={smallBtn}>↓</button>
                      <button type="button" onClick={() => removeBlock(i)}   style={smallBtn}>✕</button>
                    </div>
                  </div>
                  {b.type === 'header' && (
                    <input type="text" value={b.text} onChange={(e) => updateBlock(i, { text: e.target.value } as Partial<Block>)} style={modalInput} placeholder="Heading text" />
                  )}
                  {b.type === 'paragraph' && (
                    <textarea value={b.text} onChange={(e) => updateBlock(i, { text: e.target.value } as Partial<Block>)} rows={3} style={{ ...modalInput, fontFamily: 'inherit' }} placeholder="Paragraph text" />
                  )}
                  {b.type === 'image' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                      <input type="text" value={b.url} onChange={(e) => updateBlock(i, { url: e.target.value } as Partial<Block>)} style={modalInput} placeholder="Image URL (paste asset URL)" />
                      <input type="text" value={b.alt || ''} onChange={(e) => updateBlock(i, { alt: e.target.value } as Partial<Block>)} style={modalInput} placeholder="Alt text" />
                    </div>
                  )}
                  {b.type === 'cta' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <input type="text" value={b.label} onChange={(e) => updateBlock(i, { label: e.target.value } as Partial<Block>)} style={modalInput} placeholder="Button label" />
                      <input type="text" value={b.url} onChange={(e) => updateBlock(i, { url: e.target.value } as Partial<Block>)} style={modalInput} placeholder="Destination URL" />
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => addBlock('header')}    style={smallBtn}>+ Header</button>
                <button type="button" onClick={() => addBlock('paragraph')} style={smallBtn}>+ Paragraph</button>
                <button type="button" onClick={() => addBlock('image')}     style={smallBtn}>+ Image</button>
                <button type="button" onClick={() => addBlock('cta')}       style={smallBtn}>+ CTA</button>
                <button type="button" onClick={() => addBlock('divider')}   style={smallBtn}>+ Divider</button>
              </div>
            </div>

            <div>
              <div style={fieldLabelStyle}>Body (Markdown fallback · used when Blocks is empty)</div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} style={{ ...modalInput, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={fieldLabelStyle}>From name</div>
                <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} style={modalInput} />
              </div>
              <div>
                <div style={fieldLabelStyle}>From email</div>
                <input type="text" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} style={modalInput} />
              </div>
              <div>
                <div style={fieldLabelStyle}>Reply-to (optional)</div>
                <input type="text" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} style={modalInput} placeholder="hello@thenamkhan.com" />
              </div>
              <div>
                <div style={fieldLabelStyle}>Booking code (auto if blank)</div>
                <input type="text" value={bookingCode} onChange={(e) => setBookingCode(e.target.value)} style={modalInput} placeholder="e.g. NK-SPRING24" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={fieldLabelStyle}>Booking CTA destination URL</div>
                <input type="text" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} style={modalInput} placeholder="https://thenamkhan.com/book" />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #E6DFCC', paddingTop: 12 }}>
              <div style={fieldLabelStyle}>Schedule</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button type="button" onClick={() => setSchedMode('draft')}    style={pillStyle(schedMode === 'draft')}>Save as draft</button>
                <button type="button" onClick={() => setSchedMode('fixed')}    style={pillStyle(schedMode === 'fixed')}>Send at fixed time</button>
                <button type="button" onClick={() => setSchedMode('relative')} style={pillStyle(schedMode === 'relative')}>Relative to stay</button>
              </div>

              {schedMode === 'fixed' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={fieldLabelStyle}>Repeat</div>
                    <select value={fixedKind} onChange={(e) => setFixedKind(e.target.value as 'once'|'daily'|'weekly'|'monthly')} style={modalInput}>
                      <option value="once">Once</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>{fixedKind === 'once' ? 'Send at' : 'First run at'}</div>
                    <input type="datetime-local" value={fixedAt} onChange={(e) => setFixedAt(e.target.value)} style={modalInput} />
                  </div>
                </div>
              )}

              {schedMode === 'relative' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={fieldLabelStyle}>Trigger</div>
                    <select value={relKind} onChange={(e) => setRelKind(e.target.value as 'before_checkin' | 'after_checkout')} style={modalInput}>
                      <option value="before_checkin">Before check-in</option>
                      <option value="after_checkout">After check-out</option>
                    </select>
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Days</div>
                    <input type="number" min={0} max={365} value={relDays} onChange={(e) => setRelDays(Math.max(0, Number(e.target.value) || 0))} style={modalInput} />
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Hour (0-23)</div>
                    <input type="number" min={0} max={23} value={relHour} onChange={(e) => setRelHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))} style={modalInput} />
                  </div>
                  <div style={{ gridColumn: '1 / -1', fontSize: 11, color: '#5A5A5A' }}>
                    Send anchor is computed per-recipient from the guest&apos;s next arrival (before) or last departure (after). Recipients with no matching stay are silently skipped.
                  </div>
                </div>
              )}
            </div>

            {saveMsg && (
              <div style={{
                padding: 10, fontSize: 12,
                background: saveMsg.startsWith('Error') ? '#FBE8E4' : '#E4F0E1',
                color: saveMsg.startsWith('Error') ? '#8A2419' : '#1F5C2C',
                border: `1px solid ${saveMsg.startsWith('Error') ? '#E8B7AB' : '#C8DFC8'}`,
                borderRadius: 4,
              }}>{saveMsg}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <div style={{ fontSize: 11, color: '#5A5A5A' }}>
                {schedMode === 'draft' && 'Saves without sending — appears in Newsletter overview.'}
                {schedMode === 'fixed' && (fixedAt ? `Will queue at ${new Date(fixedAt).toLocaleString()}` : 'Pick a date/time to schedule.')}
                {schedMode === 'relative' && `Each recipient sends ${relDays}d ${relKind === 'before_checkin' ? 'before their check-in' : 'after their check-out'} at ${String(relHour).padStart(2, '0')}:00.`}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={onClose} style={{
                  padding: '8px 14px', fontSize: 12, background: '#FFFFFF', color: '#1B1B1B',
                  border: '1px solid #E6DFCC', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
                <button type="button" onClick={aiProposeLocal} style={{
                  padding: '8px 14px', fontSize: 12, background: '#F5F0E1', color: '#1B1B1B',
                  border: '1px solid #E6DFCC', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                }}>Local AI proposal</button>
                <button type="button" onClick={save} disabled={saving || !canSave} style={{
                  padding: '8px 18px', fontSize: 12, fontWeight: 600, background: '#1F3A2E', color: '#FFFFFF',
                  border: 'none', borderRadius: 4, cursor: saving ? 'wait' : 'pointer',
                  opacity: (saving || !canSave) ? 0.5 : 1, fontFamily: 'inherit',
                }}>{saving ? 'Saving…' : (schedMode === 'draft' ? 'Save draft' : 'Save & schedule')}</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'preview' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 6 }}>Preview substitutes {`{{first_name}}`} with a sample name.</div>
            <div style={{ background: '#FAF7EE', border: '1px solid #E6DFCC', borderRadius: 6, padding: 24 }}>
              <div style={{ maxWidth: 560, margin: '0 auto', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, padding: 28 }}>
                {renderedInner}
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 10, color: '#5A5A5A', marginTop: 24, textAlign: 'center' }}>
                  You are receiving this because you stayed with The Namkhan. <span style={{ textDecoration: 'underline' }}>Unsubscribe</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -- newsletter modal helper styles (kept close to the modal) --
const smallBtn: React.CSSProperties = {
  padding: '4px 8px', fontSize: 11, background: '#FFFFFF', color: '#1B1B1B',
  border: '1px solid #E6DFCC', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
};
function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', fontSize: 12, fontWeight: 600,
    background: 'transparent',
    color: active ? '#1B1B1B' : '#5A5A5A',
    border: 'none',
    borderBottom: active ? '2px solid #1F3A2E' : '2px solid transparent',
    cursor: 'pointer', fontFamily: 'inherit',
    marginBottom: -1,
  };
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#5A5A5A', fontWeight: 600, marginBottom: 4,
};
const modalInput: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #E6DFCC', borderRadius: 4,
  background: '#FFFFFF', color: '#1B1B1B',
  fontSize: 13, fontFamily: 'inherit',
};

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
