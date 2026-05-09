'use client';

// app/operations/events/_components/EventsCalendar.tsx
// Client-side month-view calendar with event chips + filter bar.
//
// Layout: standard 7-column grid, Mon-first, 6 rows. Today highlighted with a
// brass-tinted background. Empty cells show an em-dash. Each chip is colored
// per event category from the brand palette (brass · moss · copper-rust ·
// paper-deep tints) — never orange (that's reserved for OTA tone).
//
// Filters:
//   • Event types (multi-select)
//   • Categories  (multi-select)
//   • Countries   (multi-select; pulled from source_markets ISO-2 codes)
//
// "+ Add event" CTA is rendered but disabled (title="awaiting backend") until
// the insert API is wired.

import { useMemo, useState } from 'react';
import type { CalendarEvent, EventTypeOption } from '../_data';

interface Props {
  initialEvents: CalendarEvent[];
  eventTypes: EventTypeOption[];
  countries: string[];
  initialMonth: string; // 'YYYY-MM'
}

// ─── category palette (locked: brand tints only, no orange) ───────────────
const CATEGORY_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
  lunar:     { bg: 'rgba(168, 133,  74, 0.18)', fg: '#d9bf8e', border: 'rgba(168, 133, 74, 0.55)' },  // brass
  national:  { bg: 'rgba(107, 147, 121, 0.16)', fg: '#a4c5b1', border: 'rgba(107, 147, 121, 0.50)' },  // moss-glow
  property:  { bg: 'rgba(196, 160, 107, 0.18)', fg: '#e6d3a8', border: 'rgba(196, 160, 107, 0.55)' },  // brass-soft
  religious: { bg: 'rgba(166,  88,  62, 0.18)', fg: '#d9a48a', border: 'rgba(166,  88, 62, 0.50)' },   // copper-rust
  seasonal:  { bg: 'rgba(230, 218, 192, 0.14)', fg: '#d8cca8', border: 'rgba(230, 218, 192, 0.45)' },  // paper-deep
};
const FALLBACK_STYLE = { bg: 'rgba(168, 133, 74, 0.14)', fg: '#c4a06b', border: 'rgba(168, 133, 74, 0.45)' };

const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;

// ─── helpers ──────────────────────────────────────────────────────────────
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseYm(s: string): { y: number; m: number } {
  const [y, m] = s.split('-').map(Number);
  return { y, m };
}
function shiftMonth(s: string, delta: number): string {
  const { y, m } = parseYm(s);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(s: string): string {
  const { y, m } = parseYm(s);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// Build a 6-row × 7-col grid of dates spanning the visible month, Mon-first.
function buildGrid(ym: string): Date[] {
  const { y, m } = parseYm(ym);
  const first = new Date(y, m - 1, 1);
  // JS getDay(): Sunday=0..Saturday=6. We want Mon=0..Sun=6.
  const offset = (first.getDay() + 6) % 7;
  const start  = new Date(y, m - 1, 1 - offset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  return cells;
}

// ─── multi-select dropdown (compact) ──────────────────────────────────────
function MultiSelect({
  label, options, selected, onChange,
}: {
  label: string;
  options: Array<{ value: string; display: string }>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = selected.size;
  const display = count === 0 ? `All ${label.toLowerCase()}` : `${count} ${label.toLowerCase()}`;
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={S.filterBtn}
        title={`Filter by ${label.toLowerCase()}`}
      >
        <span>{display}</span>
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={S.dropdown}>
          <div style={S.dropdownHead}>
            <span>{label}</span>
            <button type="button" style={S.linkBtn} onClick={() => onChange(new Set())}>Clear</button>
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {options.map(o => {
              const on = selected.has(o.value);
              return (
                <label key={o.value} style={S.dropdownRow}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = new Set(selected);
                      if (on) next.delete(o.value); else next.add(o.value);
                      onChange(next);
                    }}
                  />
                  <span style={{ flex: 1 }}>{o.display}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────
export default function EventsCalendar({ initialEvents, eventTypes, countries, initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [typeSel,    setTypeSel]    = useState<Set<string>>(new Set());
  const [catSel,     setCatSel]     = useState<Set<string>>(new Set());
  const [countrySel, setCountrySel] = useState<Set<string>>(new Set());

  const todayIso = ymd(new Date());

  const filteredEvents = useMemo(() => {
    return initialEvents.filter(e => {
      if (typeSel.size    > 0 && !typeSel.has(e.type_code))   return false;
      if (catSel.size     > 0 && !catSel.has(e.category))     return false;
      if (countrySel.size > 0 && !e.source_markets.some(m => countrySel.has(m))) return false;
      return true;
    });
  }, [initialEvents, typeSel, catSel, countrySel]);

  const grid = useMemo(() => buildGrid(month), [month]);
  const { m: visibleMonth } = parseYm(month);

  // Map iso date → events spanning that day.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filteredEvents) {
      // Iterate every day from date_start to date_end inclusive.
      const start = new Date(`${e.date_start}T00:00:00Z`);
      const end   = new Date(`${e.date_end}T00:00:00Z`);
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        const arr = map.get(iso) ?? [];
        arr.push(e);
        map.set(iso, arr);
      }
    }
    return map;
  }, [filteredEvents]);

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const e of initialEvents) seen.add(e.category);
    return Array.from(seen).sort().map(c => ({ value: c, display: c[0].toUpperCase() + c.slice(1) }));
  }, [initialEvents]);

  return (
    <div>
      {/* ─── filter bar ─── */}
      <div style={S.filterBar}>
        <MultiSelect
          label="Event types"
          options={eventTypes.map(t => ({ value: t.type_code, display: t.display_name }))}
          selected={typeSel}
          onChange={setTypeSel}
        />
        <MultiSelect
          label="Categories"
          options={categoryOptions}
          selected={catSel}
          onChange={setCatSel}
        />
        <MultiSelect
          label="Holiday countries"
          options={countries.map(c => ({ value: c, display: c }))}
          selected={countrySel}
          onChange={setCountrySel}
        />

        <div style={{ flex: 1 }} />

        <button type="button" style={S.monthNav} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
        <div style={S.monthLabel}>{monthLabel(month)}</div>
        <button type="button" style={S.monthNav} onClick={() => setMonth(shiftMonth(month, +1))} aria-label="Next month">›</button>

        <button
          type="button"
          style={{ ...S.addBtn, opacity: 0.55, cursor: 'not-allowed' }}
          disabled
          title="awaiting backend"
        >
          + Add event
        </button>
      </div>

      {/* ─── weekday header ─── */}
      <div style={S.weekHeader}>
        {WEEKDAYS.map(d => (
          <div key={d} style={S.weekHeaderCell}>{d}</div>
        ))}
      </div>

      {/* ─── month grid ─── */}
      <div style={S.grid}>
        {grid.map((d, i) => {
          const iso     = ymd(d);
          const inMonth = (d.getMonth() + 1) === visibleMonth;
          const isToday = iso === todayIso;
          const cellEvents = eventsByDay.get(iso) ?? [];
          // dedupe chips per cell (multi-day events repeat per day; cap at 4 visible)
          return (
            <div
              key={i}
              style={{
                ...S.cell,
                background: isToday ? 'rgba(168, 133, 74, 0.16)' : 'transparent',
                opacity:    inMonth ? 1 : 0.32,
                borderColor: isToday ? 'rgba(168, 133, 74, 0.55)' : '#1f1c15',
              }}
            >
              <div style={S.cellDate}>
                <span style={isToday ? S.cellDateToday : undefined}>{d.getDate()}</span>
              </div>

              <div style={S.cellChips}>
                {cellEvents.length === 0 && inMonth && (
                  <span style={S.cellEmpty}>—</span>
                )}
                {cellEvents.slice(0, 4).map(e => {
                  const sty = CATEGORY_STYLE[e.category] ?? FALLBACK_STYLE;
                  return (
                    <div
                      key={e.id}
                      style={{
                        ...S.chip,
                        background: sty.bg,
                        color:      sty.fg,
                        borderColor: sty.border,
                      }}
                      title={`${e.display_name} · ${e.category_display}${e.source_markets.length ? ' · ' + e.source_markets.join(', ') : ''}`}
                    >
                      {e.display_name}
                    </div>
                  );
                })}
                {cellEvents.length > 4 && (
                  <div style={S.chipOverflow}>+{cellEvents.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── legend ─── */}
      <div style={S.legend}>
        {Object.entries(CATEGORY_STYLE).map(([cat, sty]) => (
          <div key={cat} style={S.legendItem}>
            <span style={{ ...S.legendSwatch, background: sty.bg, borderColor: sty.border }} />
            <span>{cat[0].toUpperCase() + cat.slice(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── styles (CSS-vars only; zero hardcoded fontSize numbers) ──────────────
const S: Record<string, React.CSSProperties> = {
  filterBar: {
    display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
    marginBottom: 14,
  },
  filterBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#0f0d0a', color: '#e9e1ce',
    border: '1px solid #1f1c15', borderRadius: 6,
    padding: '6px 10px',
    fontFamily: "'Inter Tight', system-ui, sans-serif",
    fontSize: 'var(--t-sm)',
    cursor: 'pointer',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, marginTop: 4,
    minWidth: 220, zIndex: 60,
    background: '#0a0a0a', border: '1px solid #1f1c15', borderRadius: 8,
    padding: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
    fontFamily: "'Inter Tight', system-ui, sans-serif",
    fontSize: 'var(--t-sm)',
  },
  dropdownHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '4px 8px 6px',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)', letterSpacing: '0.18em',
    textTransform: 'uppercase', color: '#a8854a',
    borderBottom: '1px solid #1f1c15', marginBottom: 4,
  },
  dropdownRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
    color: '#e9e1ce',
  },
  linkBtn: {
    background: 'transparent', border: 'none',
    color: '#c4a06b', cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase',
  },
  monthNav: {
    background: '#0f0d0a', color: '#e9e1ce',
    border: '1px solid #1f1c15', borderRadius: 6,
    width: 28, height: 28, lineHeight: 1, cursor: 'pointer',
    fontFamily: "'Inter Tight', system-ui, sans-serif",
    fontSize: 'var(--t-md)',
  },
  monthLabel: {
    minWidth: 150, textAlign: 'center',
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: 'italic',
    fontSize: 'var(--t-xl)',
    color: '#e9e1ce',
  },
  addBtn: {
    background: 'rgba(168, 133, 74, 0.18)',
    color: '#d9bf8e',
    border: '1px solid rgba(168, 133, 74, 0.55)',
    borderRadius: 6,
    padding: '6px 12px',
    fontFamily: "'Inter Tight', system-ui, sans-serif",
    fontSize: 'var(--t-sm)',
    fontWeight: 600,
  },
  weekHeader: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    borderTop: '1px solid #1f1c15', borderLeft: '1px solid #1f1c15',
  },
  weekHeaderCell: {
    padding: '8px 10px',
    borderRight: '1px solid #1f1c15', borderBottom: '1px solid #1f1c15',
    background: '#0c0a08',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)', letterSpacing: '0.18em',
    textTransform: 'uppercase', color: '#a8854a',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    borderLeft: '1px solid #1f1c15',
  },
  cell: {
    minHeight: 110,
    borderRight: '1px solid #1f1c15', borderBottom: '1px solid #1f1c15',
    padding: 6,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  cellDate: {
    display: 'flex', justifyContent: 'flex-end',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)', color: '#7d7565',
  },
  cellDateToday: {
    background: '#a8854a', color: '#0a0a0a',
    padding: '1px 6px', borderRadius: 10,
    fontWeight: 700,
  },
  cellChips: {
    display: 'flex', flexDirection: 'column', gap: 3,
    flex: 1,
  },
  cellEmpty: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)', color: '#3a342a',
    alignSelf: 'flex-start',
  },
  chip: {
    border: '1px solid',
    borderRadius: 4,
    padding: '2px 6px',
    fontFamily: "'Inter Tight', system-ui, sans-serif",
    fontSize: 'var(--t-xs)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'default',
  },
  chipOverflow: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)', color: '#a8854a',
    padding: '1px 6px',
  },
  legend: {
    display: 'flex', gap: 16, flexWrap: 'wrap',
    marginTop: 12, paddingTop: 12,
    borderTop: '1px solid #1f1c15',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)', letterSpacing: '0.16em',
    textTransform: 'uppercase', color: '#7d7565',
  },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  legendSwatch: {
    display: 'inline-block', width: 12, height: 12, borderRadius: 3,
    border: '1px solid',
  },
};
