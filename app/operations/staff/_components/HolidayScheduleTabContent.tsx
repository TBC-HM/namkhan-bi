// app/operations/staff/_components/HolidayScheduleTabContent.tsx
// PBS 2026-05-13 — Holiday calendar tab inside Staff.
//
// Donna (Calvià, Spain): national + Balearic + Calvià-local festivos.
// Namkhan (Luang Prabang, Laos): Lao national + Buddhist holidays.
//
// Layout
//   KPI strip (total, national, regional, local, upcoming, scope label)
//   Year toggle (2025 / 2026)
//   12-month grid — small calendars with holidays highlighted
//   Full list table — date · day · name · scope · notes
//
// Data lives in holidays-data.ts and is property-aware.

import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import StaffTabStrip from './StaffTabStrip';
import { holidaysForProperty, type Holiday, type HolidayScope } from './holidays-data';
import {
  SOURCE_META, buildDailyOverlap, densityColor,
  sourcePaletteForProperty,
  type SchoolSource,
} from './school-holidays-data';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface DemandEvent {
  event_id: string;
  date_start: string;
  date_end: string | null;
  display_name: string;
  demand_score_override: number | null;
  is_confirmed: boolean | null;
}

async function getDemandEventsForYear(year: number): Promise<DemandEvent[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .schema('marketing')
    .from('calendar_events')
    .select('event_id,date_start,date_end,display_name,demand_score_override,is_confirmed')
    .gte('date_start', `${year}-01-01`)
    .lte('date_start', `${year}-12-31`)
    .order('date_start', { ascending: true })
    .limit(500);
  return (data ?? []) as DemandEvent[];
}

function buildEventsByDate(events: DemandEvent[]): Map<string, DemandEvent[]> {
  const out = new Map<string, DemandEvent[]>();
  for (const e of events) {
    const start = new Date(e.date_start + 'T00:00:00Z');
    const end   = new Date((e.date_end ?? e.date_start) + 'T00:00:00Z');
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const arr = out.get(iso) ?? [];
      arr.push(e);
      out.set(iso, arr);
    }
  }
  return out;
}

function parseSchoolParam(p: string | string[] | undefined, palette: SchoolSource[]): Set<SchoolSource> | null {
  if (!p || p === 'none') return null;
  if (p === 'all') return new Set<SchoolSource>(palette);
  const v = String(p).toLowerCase();
  if ((palette as string[]).includes(v)) return new Set<SchoolSource>([v as SchoolSource]);
  return null;
}

// =============================================================================

const SCOPE_COLOR: Record<HolidayScope, string> = {
  national: 'var(--brass)',
  regional: 'var(--moss-glow, #6b9379)',
  local:    'var(--oxblood-soft, #c97b6a)',
};
const SCOPE_LABEL: Record<HolidayScope, string> = {
  national: 'National',
  regional: 'Regional',
  local:    'Local',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_LABELS  = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}
// JS getDay() returns Sun=0..Sat=6; we want Mon=0..Sun=6
function firstDowMon0(year: number, monthIndex0: number): number {
  const js = new Date(Date.UTC(year, monthIndex0, 1)).getUTCDay();
  return (js + 6) % 7;
}
function fmtLongDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

// =============================================================================

interface Props {
  propertyId: number;
  propertyLabel?: string;
  searchParams: Record<string, string | string[] | undefined>;
  /** PBS 2026-05-15: when true, skip the outer <Page> + StaffTabStrip wrappers
   *  so the caller can embed this body inside another page (e.g. Revenue
   *  Calendar · Density tab). */
  embedded?: boolean;
  subPagesOverride?: { label: string; href: string }[];
  /** When this component is embedded inside another route (e.g. /revenue/pricing?tab=holidays),
   *  the parent passes its base href so country/year/events buttons stay on the parent tab
   *  instead of stripping the parent's query string. PBS 2026-05-22. */
  basePath?: string;
}

export default async function HolidayScheduleTabContent({
  propertyId, propertyLabel, searchParams, embedded = false, subPagesOverride, basePath,
}: Props) {
  const buildHref = (params: Record<string, string>): string => {
    const qs = new URLSearchParams(params).toString();
    if (!basePath) return `?${qs}`;
    return `${basePath}${basePath.includes('?') ? '&' : '?'}${qs}`;
  };
  const { rows, countryName, regionName, flag } = holidaysForProperty(propertyId);

  // Year toggle — default to current calendar year, fall back to first available
  const yearsAvailable = [...new Set(rows.map((h) => Number(h.date.slice(0, 4))))].sort();
  const todayY = new Date().getUTCFullYear();
  const requestedY = typeof searchParams?.y === 'string' ? Number(searchParams.y) : NaN;
  const selectedYear =
    (Number.isFinite(requestedY) && yearsAvailable.includes(requestedY) && requestedY) ||
    (yearsAvailable.includes(todayY) ? todayY : yearsAvailable[yearsAvailable.length - 1] ?? todayY);

  const yearRows = rows.filter((h) => h.date.startsWith(`${selectedYear}-`));
  const byDate = new Map<string, Holiday>();
  for (const h of yearRows) byDate.set(h.date, h);

  // ── School-holiday overlay (PBS 2026-05-14, palette swap 2026-05-16) ───
  // `?school=<src>|all|none` — palette is property-aware. Namkhan gets the
  // Asian source markets (th, cn, jp, kr, vn, sg, au, int). Donna gets the
  // EU markets (de, es, se, uk, us, int).
  const palette = sourcePaletteForProperty(propertyId);
  const requestedSchool = typeof searchParams?.school === 'string' ? searchParams.school : 'all';
  const enabledSources = parseSchoolParam(requestedSchool, palette);
  const overlap = enabledSources ? buildDailyOverlap(selectedYear, enabledSources) : new Map<string, Set<SchoolSource>>();

  // ── Demand-events overlay (PBS 2026-05-16) ─────────────────────────────
  // `?events=on` pulls marketing.calendar_events for the selected year and
  // marks them on the calendar. Same source as /marketing/events.
  const eventsOn = (typeof searchParams?.events === 'string' ? searchParams.events : '') === 'on';
  const demandEvents = eventsOn ? await getDemandEventsForYear(selectedYear) : [];
  const eventsByDate = buildEventsByDate(demandEvents);
  // peak overlap day this year
  let peakDay: { iso: string; count: number } | null = null;
  for (const [iso, srcs] of overlap) {
    if (!peakDay || srcs.size > peakDay.count) peakDay = { iso, count: srcs.size };
  }
  // days with at least one source enabled
  const schoolBreakDayCount = overlap.size;

  // KPI counts
  const nNational = yearRows.filter((h) => h.scope === 'national').length;
  const nRegional = yearRows.filter((h) => h.scope === 'regional').length;
  const nLocal    = yearRows.filter((h) => h.scope === 'local').length;
  const todayIso  = new Date().toISOString().slice(0, 10);
  const upcoming  = yearRows.filter((h) => h.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  const nextOne   = upcoming[0];

  const eyebrow = propertyLabel
    ? `Operations · Staff · Holidays · ${propertyLabel}`
    : `Operations · Staff · Holidays`;

  const noData = yearRows.length === 0;

  // PBS 2026-05-15: when embedded (e.g. Revenue Calendar · Density tab) the
  // outer <Page> + StaffTabStrip are owned by the host page. Render a
  // fragment so we don't nest layouts.
  const Wrap = embedded
    ? ({ children }: { children: React.ReactNode }) => (
        // PBS 2026-05-23 #144: re-scope the dark cream/brass tokens to paper-white
        // when this component is embedded inside the new design pricing page.
        <div style={{
          ['--brass' as any]: '#7A5C2E',
          ['--ink' as any]: '#1B1B1B',
          ['--ink-mute' as any]: '#5A5A5A',
          ['--ink-faint' as any]: '#9A9A9A',
          ['--paper-warm' as any]: '#FAFAF7',
          ['--line-soft' as any]: '#E0DAC4',
          ['--mono' as any]: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: '#1B1B1B',
        }}>{children}</div>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <DashboardPage
          title="Public holidays"
          subtitle={eyebrow}
          tabs={(subPagesOverride ?? rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)).map(s => ({ key: s.href, label: s.label, href: s.href, active: s.label === 'HR' || s.href.endsWith('/finance/hr') || s.href.endsWith('/operations/staff') }))}
        >
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <StaffTabStrip propertyId={propertyId} />
            {children}
          </div>
        </DashboardPage>
      );

  return (
    <Wrap>

      <KpiStrip items={[
        { label: 'Total', value: yearRows.length, kind: 'count', hint: `${selectedYear} festivos` },
        { label: 'National', value: nNational, kind: 'count', hint: 'state-wide' },
        { label: 'Regional', value: nRegional, kind: 'count', hint: regionName ? regionName.split('·')[1]?.trim() ?? '—' : '—' },
        { label: 'Local',    value: nLocal,    kind: 'count', tone: nLocal > 0 ? 'pos' : 'neutral', hint: regionName ? regionName.split('·')[0].trim() : '—' },
        {
          label: 'Next holiday',
          value: nextOne ? new Date(nextOne.date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—',
          hint: nextOne ? nextOne.name_en : 'none upcoming',
        },
        { label: 'Country', value: `${flag || '·'} ${countryName || '—'}`, hint: regionName ?? '—' },
        { label: 'Verified', value: yearRows.filter((h) => h.verified).length, kind: 'count', tone: 'pos', hint: `of ${yearRows.length}` },
        // PBS 2026-05-14 — school-break overlay metrics
        {
          label: 'School-break days',
          value: schoolBreakDayCount,
          kind: 'count',
          tone: schoolBreakDayCount > 0 ? 'pos' : 'neutral',
          hint: enabledSources && enabledSources.size === 1
            ? `${SOURCE_META[[...enabledSources][0]].label} only`
            : enabledSources ? `${enabledSources.size} sources overlaid` : 'overlay off',
        },
        {
          label: 'Peak overlap',
          value: peakDay
            ? `${peakDay.count}× · ${new Date(peakDay.iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
            : '—',
          tone: peakDay && peakDay.count >= 3 ? 'warn' : 'neutral',
          hint: peakDay ? 'simultaneously on break' : 'no overlap',
        },
      ] satisfies KpiStripItem[]} />

      {/* PBS 2026-05-14 — School-holidays overlay dropdown.
          PBS 2026-05-16 — palette swap to Asia for Namkhan, plus Events toggle. */}
      <section style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--brass)',
        }}>School holidays</span>
        {([['all', '🌍 All (overlay)'] as [string, string]]
          .concat(palette.map((s) => [s, `${SOURCE_META[s].flag} ${SOURCE_META[s].label}`] as [string, string]))
          .concat([['none', '— off'] as [string, string]])
        ).map(([k, label]) => {
          const active = requestedSchool === k;
          return (
            <a key={k}
              href={buildHref({ y: String(selectedYear), school: k, ...(eventsOn ? { events: 'on' } : {}) })}
              style={{
                padding: '4px 10px',
                fontFamily: 'var(--mono)', fontSize: 11,
                letterSpacing: '0.10em',
                color: active ? 'var(--ink)' : 'var(--ink-mute)',
                background: active ? 'var(--paper-warm)' : 'transparent',
                border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
                borderRadius: 999, textDecoration: 'none',
                fontWeight: active ? 600 : 400,
              }}>{label}</a>
          );
        })}
        {enabledSources && enabledSources.size > 1 && (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
            {[1, 2, 3, 4].map((n) => (
              <span key={n} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: densityColor(n), border: '1px solid var(--line-soft)' }} />
                {n === 4 ? '4+' : n}
              </span>
            ))}
          </span>
        )}
      </section>

      {/* PBS 2026-05-16 — Events overlay toggle. Pulls marketing.calendar_events
          and marks each day with a small brass dot + tooltip. Same data source
          as /marketing/events. */}
      <section style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--brass)',
        }}>Events</span>
        {([
          ['on',  '✦ Show demand events'],
          ['off', '— off'],
        ] as Array<[string, string]>).map(([k, label]) => {
          const active = (k === 'on' && eventsOn) || (k === 'off' && !eventsOn);
          return (
            <a key={k}
              href={buildHref({ y: String(selectedYear), school: String(requestedSchool), ...(k === 'on' ? { events: 'on' } : {}) })}
              style={{
                padding: '4px 10px',
                fontFamily: 'var(--mono)', fontSize: 11,
                letterSpacing: '0.10em',
                color: active ? 'var(--ink)' : 'var(--ink-mute)',
                background: active ? 'var(--paper-warm)' : 'transparent',
                border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
                borderRadius: 999, textDecoration: 'none',
                fontWeight: active ? 600 : 400,
              }}>{label}</a>
          );
        })}
        {eventsOn && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase', color: 'var(--ink-mute)',
          }}>{demandEvents.length} event{demandEvents.length === 1 ? '' : 's'} · {selectedYear}</span>
        )}
      </section>

      {/* Year toggle */}
      <section style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--brass)',
        }}>Year</span>
        {yearsAvailable.map((y) => (
          <a
            key={y}
            href={buildHref({ y: String(y), school: String(requestedSchool), ...(eventsOn ? { events: 'on' } : {}) })}
            style={{
              padding: '4px 12px',
              fontFamily: 'var(--mono)', fontSize: 11,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: y === selectedYear ? 'var(--ink)' : 'var(--ink-mute)',
              background: y === selectedYear ? 'var(--paper-warm)' : 'transparent',
              border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
              borderRadius: 4, textDecoration: 'none',
              fontWeight: y === selectedYear ? 600 : 400,
            }}
          >
            {y}
          </a>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
          static · holidays-data.ts
        </span>
      </section>

      {noData && (
        <div className="panel dashed" style={{
          marginTop: 20, padding: 20, textAlign: 'center', color: 'var(--ink-mute)',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--brass)', marginBottom: 6,
          }}>
            No holidays configured for this property
          </div>
          <div style={{ fontSize: 'var(--t-sm)' }}>
            Add entries to <code>app/operations/staff/_components/holidays-data.ts</code> for property {propertyId}.
          </div>
        </div>
      )}

      {!noData && (
        <>
          {/* 12-month grid */}
          <section style={{ marginTop: 22 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}>
              {Array.from({ length: 12 }, (_, m) => (
                <MonthCard
                  key={m}
                  year={selectedYear}
                  monthIndex0={m}
                  byDate={byDate}
                  overlap={overlap}
                  eventsByDate={eventsByDate}
                />
              ))}
            </div>
          </section>

          {/* Legend */}
          <section style={{ marginTop: 22, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {(['national', 'regional', 'local'] as HolidayScope[]).map((scope) => (
              <span key={scope} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontFamily: 'var(--mono)', fontSize: 11,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--ink-mute)',
              }}>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: SCOPE_COLOR[scope],
                  display: 'inline-block',
                }} />
                {SCOPE_LABEL[scope]}
              </span>
            ))}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--mono)', fontSize: 11,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--ink-mute)',
            }}>
              <span style={{
                width: 12, height: 12, borderRadius: 3,
                background: 'transparent', border: '1px dashed var(--brass)',
                display: 'inline-block',
              }} /> Pending verification
            </span>
          </section>

          {/* List */}
          <section style={{ marginTop: 28 }}>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--brass)',
              }}>
                {selectedYear} festivo list · {countryName}
              </h2>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--ink-mute)',
              }}>
                {yearRows.length} day{yearRows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div style={{
              borderRadius: 4,
              border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
              background: 'var(--paper-warm)',
              overflowX: 'auto',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Day</Th>
                    <Th>Local name</Th>
                    <Th>English</Th>
                    <Th>Scope</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Notes</Th>
                  </tr>
                </thead>
                <tbody>
                  {yearRows
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((h) => {
                      const dow = new Date(h.date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short' });
                      const isPast = h.date < todayIso;
                      return (
                        <tr key={h.date + '-' + h.name_en} style={{ opacity: isPast ? 0.55 : 1 }}>
                          <Td mono strong>{fmtLongDate(h.date)}</Td>
                          <Td mono mute>{dow}</Td>
                          <Td strong>{h.name_local}</Td>
                          <Td>{h.name_en}</Td>
                          <Td>
                            <span style={{
                              background: 'rgba(168,133,74,0.10)',
                              color: SCOPE_COLOR[h.scope],
                              padding: '2px 8px', borderRadius: 3,
                              fontFamily: 'var(--mono)', fontSize: 10,
                              letterSpacing: '0.12em', textTransform: 'uppercase',
                              border: '1px solid var(--kpi-frame)',
                            }}>{SCOPE_LABEL[h.scope]}</span>
                          </Td>
                          <Td mono mute>{h.kind}</Td>
                          <Td>
                            {h.verified
                              ? <span style={{ color: 'var(--st-good, #82ad8c)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>verified</span>
                              : <span style={{ color: 'var(--brass)',           fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>review</span>
                            }
                          </Td>
                          <Td mute>{h.notes || ''}</Td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Note on coverage */}
          <section style={{
            marginTop: 18,
            padding: 12,
            border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
            background: 'var(--paper-warm)',
            borderRadius: 4,
            fontSize: 'var(--t-sm)',
            color: 'var(--ink-mute)',
          }}>
            <strong style={{ color: 'var(--ink)' }}>How to update</strong> — edit
            {' '}<code>app/operations/staff/_components/holidays-data.ts</code>.
            Local fiestas must be confirmed each December via BOIB (Spain) / MoLSW circular (Laos).
            Entries with status <em>review</em> are best-guess and need PBS confirmation before they trigger payroll rules.
          </section>
        </>
      )}
    </Wrap>
  );
}

// =============================================================================
// Atoms
// =============================================================================

function MonthCard({
  year, monthIndex0, byDate, overlap, eventsByDate,
}: {
  year: number;
  monthIndex0: number;
  byDate: Map<string, Holiday>;
  overlap: Map<string, Set<SchoolSource>>;
  eventsByDate: Map<string, DemandEvent[]>;
}) {
  const days = daysInMonth(year, monthIndex0);
  const startDow = firstDowMon0(year, monthIndex0);
  const todayIso = new Date().toISOString().slice(0, 10);

  // Build the 6×7 cell layout (mon-first)
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });

  const holidaysThisMonth = Array.from(byDate.values()).filter((h) =>
    h.date.startsWith(`${year}-${String(monthIndex0 + 1).padStart(2, '0')}-`)
  );

  return (
    <div style={{
      border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
      background: 'var(--paper-warm)',
      borderRadius: 6,
      padding: '10px 12px 12px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--brass)', marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <span>{MONTH_NAMES[monthIndex0]} {year}</span>
        <span style={{ color: 'var(--ink-mute)', fontSize: 9 }}>
          {holidaysThisMonth.length || '—'}
        </span>
      </div>

      {/* DOW header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 1, marginBottom: 2,
      }}>
        {DOW_LABELS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 9,
            color: 'var(--ink-faint)', padding: '2px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 1,
      }}>
        {cells.map((c, i) => {
          if (!c.day) {
            return <div key={i} style={{ height: 22 }} />;
          }
          const h = c.iso ? byDate.get(c.iso) : undefined;
          const isToday = c.iso === todayIso;
          const dow = new Date(c.iso! + 'T00:00:00Z').getUTCDay(); // 0 = Sun, 6 = Sat
          const isWeekend = dow === 0 || dow === 6;
          const schoolSet = c.iso ? overlap.get(c.iso) : undefined;
          const schoolCount = schoolSet?.size ?? 0;
          const schoolBg = schoolCount > 0 ? densityColor(schoolCount) : 'transparent';
          const dayEvents = c.iso ? eventsByDate.get(c.iso) ?? [] : [];
          const hasEvent = dayEvents.length > 0;
          const tipParts: string[] = [];
          if (h) tipParts.push(`${h.name_en}${h.notes ? ' — ' + h.notes : ''}`);
          if (schoolCount > 0 && schoolSet) {
            tipParts.push(`School: ${[...schoolSet].map((s) => SOURCE_META[s].label).join(' · ')}`);
          }
          if (hasEvent) {
            tipParts.push(`Events: ${dayEvents.map((e) => e.display_name).join(' · ')}`);
          }

          return (
            <div key={i}
              title={tipParts.length ? tipParts.join('\n') : undefined}
              style={{
                height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontSize: 11,
                color: h ? '#fff' : isWeekend ? 'var(--ink-mute)' : 'var(--ink)',
                fontWeight: (h || isToday) ? 600 : 400,
                // Public-holiday fill wins; school-overlay tint underneath via background-image.
                background: h
                  ? SCOPE_COLOR[h.scope]
                  : schoolBg,
                border: isToday ? '1px solid var(--ink)' : h && !h.verified ? `1px dashed var(--brass)` : '1px solid transparent',
                borderRadius: 3,
                position: 'relative',
              }}
            >
              {c.day}
              {hasEvent && (
                <span aria-hidden style={{
                  position: 'absolute', right: 2, top: 2,
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--brass, #a8854a)',
                  boxShadow: '0 0 3px var(--brass, #a8854a)',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Month's holiday names */}
      {holidaysThisMonth.length > 0 && (
        <ul style={{
          marginTop: 8, paddingLeft: 0, listStyle: 'none',
          borderTop: '1px solid var(--line-soft)', paddingTop: 8,
        }}>
          {holidaysThisMonth
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((h) => (
              <li key={h.date + '-' + h.name_en} style={{
                fontSize: 11, lineHeight: 1.4, marginBottom: 2,
                display: 'flex', gap: 6, alignItems: 'baseline',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: SCOPE_COLOR[h.scope],
                  display: 'inline-block', flexShrink: 0, marginTop: 3,
                }} />
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)', fontSize: 10, minWidth: 22 }}>
                  {h.date.slice(8)}
                </span>
                <span style={{ color: 'var(--ink)' }}>{h.name_en}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left',
      padding: '10px 12px',
      fontFamily: 'var(--mono)', fontSize: 10,
      letterSpacing: '0.16em', textTransform: 'uppercase',
      color: 'var(--brass)', fontWeight: 600,
      whiteSpace: 'nowrap',
      borderBottom: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
    }}>{children}</th>
  );
}
function Td({
  children, strong, mono, mute,
}: { children: React.ReactNode; strong?: boolean; mono?: boolean; mute?: boolean }) {
  return (
    <td style={{
      padding: '10px 12px',
      fontSize: mono ? 12 : 13,
      fontFamily: mono ? 'var(--mono)' : undefined,
      color: mute ? 'var(--ink-mute)' : 'var(--ink)',
      fontWeight: strong ? 600 : 400,
      borderTop: '1px solid var(--line-soft)',
      fontStyle: mute ? 'italic' : undefined,
    }}>{children}</td>
  );
}
