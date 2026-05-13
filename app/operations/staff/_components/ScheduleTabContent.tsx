// app/operations/staff/_components/ScheduleTabContent.tsx
// PBS 2026-05-13 — Schedule tab inside Staff.
//
// PRIMARY VIEW: Day Gantt
//   - One row per employee scheduled that day
//   - Coloured bar per shift, position = start_at / end_at, colour = dept
//   - 14-day strip above for quick date navigation (?d=YYYY-MM-DD)
//   - Department legend below the gantt
//
// Also keeps:
//   - KPI strip (7 tiles)
//   - Upcoming list (next 14 days table)

import { supabase } from '@/lib/supabase';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import StaffTabStrip from './StaffTabStrip';

// =============================================================================
// Types

interface ScheduleKpiRow {
  property_id: number;
  shifts_total: number;
  upcoming: number;
  next_7d: number;
  next_30d: number;
  today: number;
  staff_next_7d: number;
  confirmed_upcoming: number;
  scheduled_unconfirmed: number;
}
interface ScheduleDayRow {
  property_id: number;
  shift_date: string;
  shifts: number;
  distinct_staff: number;
  confirmed: number;
  hours: number;
}
interface ShiftRow {
  shift_id: string;
  property_id: number;
  staff_id: string | null;
  external_employee_id: string;
  full_name: string | null;
  dept_code: string | null;
  dept_name: string | null;
  shift_date: string;
  start_at: string;
  end_at: string;
  status: string | null;
  is_overtime: boolean | null;
  hours_planned: number | null;
  notes: string | null;
}

// =============================================================================
// Helpers

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return '—'; }
}
function fmtDayShort(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short',
    });
  } catch { return iso; }
}
function fmtDayLong(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}
function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
/** Local-time hours-from-midnight for an ISO timestamp. */
function hoursFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

// Brand-aligned department palette — stable, repeatable, picked by dept_code hash
const DEPT_COLORS = [
  '#a8854a', // brass
  '#6b9379', // moss
  '#c97b6a', // oxblood-soft
  '#7a98b8', // dust blue
  '#8b7eb5', // soft violet
  '#d2a857', // gold
  '#5f9ea0', // teal
  '#b8857a', // terracotta
  '#7a8c5a', // olive
  '#a47ec9', // lilac
] as const;

function colorForDept(deptCode: string | null): string {
  if (!deptCode) return 'var(--ink-mute)';
  let h = 0;
  for (let i = 0; i < deptCode.length; i++) h = (h * 31 + deptCode.charCodeAt(i)) >>> 0;
  return DEPT_COLORS[h % DEPT_COLORS.length];
}

// =============================================================================

interface Props {
  propertyId: number;
  propertyLabel?: string;
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function ScheduleTabContent({
  propertyId, propertyLabel, searchParams,
}: Props) {
  // ── DATE SELECTION ──────────────────────────────────────────────────────
  const todayIso = new Date().toISOString().slice(0, 10);
  const requestedDay = typeof searchParams?.d === 'string' ? searchParams.d : null;
  const selectedDay = (requestedDay && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay))
    ? requestedDay
    : todayIso;

  // Window for the daily strip (date navigator)
  const stripStart = shiftDate(selectedDay, -3);
  const stripEnd   = shiftDate(selectedDay,  +10);

  // Forward window for upcoming list
  const in14d = shiftDate(todayIso, 14);
  const back7d = shiftDate(todayIso, -7);

  const [kpiRes, daysRes, dayShiftsRes, upcomingRes] = await Promise.all([
    supabase.schema('ops').from('v_schedule_kpis')
      .select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('ops').from('v_schedule_daily_window')
      .select('*').eq('property_id', propertyId)
      .gte('shift_date', back7d).lte('shift_date', in14d)
      .order('shift_date', { ascending: true }),
    supabase.schema('ops').from('v_shifts_enriched')
      .select('shift_id, staff_id, external_employee_id, full_name, dept_code, dept_name, shift_date, start_at, end_at, status, is_overtime, hours_planned, notes')
      .eq('property_id', propertyId)
      .eq('shift_date', selectedDay)
      .order('start_at', { ascending: true }),
    supabase.schema('ops').from('v_shifts_enriched')
      .select('shift_id, staff_id, external_employee_id, full_name, dept_code, dept_name, shift_date, start_at, end_at, status, is_overtime, hours_planned, notes')
      .eq('property_id', propertyId)
      .gt('shift_date', todayIso)
      .lte('shift_date', in14d)
      .order('start_at', { ascending: true })
      .limit(300),
  ]);

  const kpi      = (kpiRes.data as ScheduleKpiRow | null) ?? null;
  const days     = ((daysRes.data as ScheduleDayRow[] | null) ?? [])
    .filter((d) => d.shift_date >= stripStart && d.shift_date <= stripEnd);
  const dayShifts = (dayShiftsRes.data as ShiftRow[] | null) ?? [];
  const upcoming  = (upcomingRes.data as ShiftRow[] | null) ?? [];

  const eyebrow = propertyLabel
    ? `Operations · Staff · Schedule · ${propertyLabel}`
    : `Operations · Staff · Schedule`;

  const hasData = (kpi?.shifts_total ?? 0) > 0;

  // ── BUILD STRIP DATA (14-day nav: -3 → +10) ─────────────────────────────
  // Pad the strip with empty days when daily_window has no row.
  const stripDays: ScheduleDayRow[] = [];
  for (let i = -3; i <= 10; i++) {
    const iso = shiftDate(selectedDay, i);
    const row = days.find((d) => d.shift_date === iso);
    stripDays.push(row ?? {
      property_id: propertyId,
      shift_date: iso,
      shifts: 0,
      distinct_staff: 0,
      confirmed: 0,
      hours: 0,
    });
  }
  const maxShiftsInStrip = stripDays.reduce((m, d) => Math.max(m, d.shifts), 0) || 1;

  // ── BUILD GANTT DATA ─────────────────────────────────────────────────────
  // Auto-fit hour window to the day's data; default 5–23.
  let minH = 5, maxH = 23;
  if (dayShifts.length > 0) {
    const starts = dayShifts.map((s) => hoursFromMidnight(s.start_at));
    const ends   = dayShifts.map((s) => hoursFromMidnight(s.end_at));
    minH = Math.max(0, Math.floor(Math.min(...starts)));
    maxH = Math.min(24, Math.ceil(Math.max(...ends)));
    if (maxH - minH < 6) { // expand to at least a 6h window for legibility
      const slack = 6 - (maxH - minH);
      minH = Math.max(0, minH - Math.floor(slack / 2));
      maxH = Math.min(24, maxH + Math.ceil(slack / 2));
    }
  }
  const totalSpan = Math.max(1, maxH - minH);
  const hourTicks: number[] = [];
  for (let h = minH; h <= maxH; h++) hourTicks.push(h);

  // Group shifts by employee (ext_id when no staff_id), then by dept
  type EmpKey = string;
  const empMap = new Map<EmpKey, {
    key: EmpKey;
    name: string;
    deptName: string;
    deptCode: string | null;
    shifts: ShiftRow[];
    unmapped: boolean;
  }>();
  for (const s of dayShifts) {
    const key = s.staff_id ?? `ext:${s.external_employee_id}`;
    const cur = empMap.get(key) ?? {
      key,
      name: s.full_name ?? `UNMAPPED · ${s.external_employee_id}`,
      deptName: s.dept_name ?? '—',
      deptCode: s.dept_code ?? null,
      shifts: [],
      unmapped: !s.staff_id,
    };
    cur.shifts.push(s);
    empMap.set(key, cur);
  }
  // Sort: by dept_name, then earliest start, then name
  const empRows = [...empMap.values()].sort((a, b) => {
    if (a.deptName !== b.deptName) return a.deptName.localeCompare(b.deptName);
    const aStart = Math.min(...a.shifts.map((s) => hoursFromMidnight(s.start_at)));
    const bStart = Math.min(...b.shifts.map((s) => hoursFromMidnight(s.start_at)));
    if (aStart !== bStart) return aStart - bStart;
    return a.name.localeCompare(b.name);
  });

  // Dept legend (unique depts for the day, sorted by headcount desc)
  const deptCounts = new Map<string, { code: string | null; name: string; n: number }>();
  for (const r of empRows) {
    const k = r.deptCode ?? r.deptName;
    const cur = deptCounts.get(k) ?? { code: r.deptCode, name: r.deptName, n: 0 };
    cur.n += 1;
    deptCounts.set(k, cur);
  }
  const legend = [...deptCounts.values()].sort((a, b) => b.n - a.n);

  // Day-level totals for the selected day
  const dayHours = empRows.reduce(
    (s, r) => s + r.shifts.reduce((ss, sh) => ss + Number(sh.hours_planned || 0), 0),
    0,
  );

  return (
    <Page
      eyebrow={eyebrow}
      title={<>Staff <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>schedule</em></>}
      subPages={rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      <StaffTabStrip propertyId={propertyId} />

      <KpiStrip items={[
        { label: 'Today',        value: kpi?.today ?? 0,                 kind: 'count', tone: (kpi?.today ?? 0) > 0 ? 'pos' : 'neutral', hint: 'shifts today' },
        { label: 'Selected day', value: dayShifts.length,                kind: 'count', hint: fmtDayShort(selectedDay) },
        { label: 'Staff on day', value: empRows.length,                  kind: 'count', hint: `${dayHours.toFixed(0)}h planned` },
        { label: 'Next 7d',      value: kpi?.next_7d ?? 0,               kind: 'count', hint: `${kpi?.staff_next_7d ?? 0} staff` },
        { label: 'Next 30d',     value: kpi?.next_30d ?? 0,              kind: 'count', hint: 'rolling window' },
        { label: 'Confirmed',    value: kpi?.confirmed_upcoming ?? 0,    kind: 'count', tone: 'pos', hint: 'forward · confirmed' },
        { label: 'Unconfirmed',  value: kpi?.scheduled_unconfirmed ?? 0, kind: 'count', tone: (kpi?.scheduled_unconfirmed ?? 0) > 0 ? 'warn' : 'pos', hint: 'needs signoff' },
      ] satisfies KpiStripItem[]} />

      {!hasData && (
        <div className="panel dashed" style={{
          marginTop: 20, padding: 20, textAlign: 'center', color: 'var(--ink-mute)',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--brass)', marginBottom: 6,
          }}>
            No scheduled shifts for this property
          </div>
          <div style={{ fontSize: 'var(--t-sm)' }}>
            Donna uses Factorial shifts (live sync). Namkhan has no shift-planning system wired today.
          </div>
        </div>
      )}

      {hasData && (
        <>
          {/* ── DATE STRIP NAVIGATOR ────────────────────────────────────── */}
          <section style={{ marginTop: 22 }}>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--brass)',
              }}>
                Pick a day · −3 → +10
              </h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <DayNavBtn href={`?d=${shiftDate(selectedDay, -1)}`} label="← Prev" />
                <DayNavBtn href={`?d=${todayIso}`}                   label="Today"  highlight={selectedDay === todayIso} />
                <DayNavBtn href={`?d=${shiftDate(selectedDay, +1)}`} label="Next →" />
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${stripDays.length}, 1fr)`,
              gap: 4,
            }}>
              {stripDays.map((d) => {
                const isSel  = d.shift_date === selectedDay;
                const isToday = d.shift_date === todayIso;
                const pct    = (d.shifts / maxShiftsInStrip) * 100;
                return (
                  <a
                    key={d.shift_date}
                    href={`?d=${d.shift_date}`}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 4,
                      background: isSel ? 'var(--paper-warm)' : 'transparent',
                      border: isSel
                        ? '1px solid var(--brass)'
                        : isToday
                          ? '1px dashed var(--ink)'
                          : '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
                      color: 'var(--ink)',
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 9,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: isSel ? 'var(--brass)' : 'var(--ink-mute)',
                    }}>
                      {new Date(d.shift_date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short' })}
                    </div>
                    <div style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 18,
                      fontWeight: isSel ? 600 : 400,
                      marginTop: 2,
                    }}>
                      {d.shift_date.slice(8)}
                    </div>
                    <div style={{
                      height: 4, marginTop: 6,
                      background: 'var(--paper-deep)', borderRadius: 2, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: isSel ? 'var(--brass)' : 'var(--ink-faint)',
                      }} />
                    </div>
                    <div style={{
                      marginTop: 4,
                      fontFamily: 'var(--mono)', fontSize: 9,
                      color: 'var(--ink-mute)',
                    }}>
                      {d.shifts || '—'}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* ── DAY GANTT ──────────────────────────────────────────────── */}
          <section style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--brass)',
              }}>
                {fmtDayLong(selectedDay)} · {empRows.length} on duty
              </h2>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--ink-mute)',
              }}>
                {dayShifts.length} shift{dayShifts.length === 1 ? '' : 's'} · {dayHours.toFixed(0)}h
              </span>
            </div>

            {empRows.length === 0 ? (
              <div className="panel dashed" style={{
                padding: 24, textAlign: 'center', color: 'var(--ink-mute)',
                background: 'var(--paper-warm)',
                border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
                borderRadius: 4, fontStyle: 'italic',
              }}>
                No staff scheduled on {fmtDayShort(selectedDay)}.
              </div>
            ) : (
              <div style={{
                border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
                background: 'var(--paper-warm)',
                borderRadius: 4, padding: 12,
                overflowX: 'auto',
              }}>
                {/* Hour scale header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 1fr',
                  alignItems: 'end',
                  paddingBottom: 6,
                  borderBottom: '1px solid var(--line-soft)',
                  marginBottom: 6,
                }}>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 10,
                    letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'var(--brass)', fontWeight: 600,
                  }}>
                    Employee · Department
                  </div>
                  <div style={{ position: 'relative', height: 22 }}>
                    {hourTicks.map((h) => {
                      const left = ((h - minH) / totalSpan) * 100;
                      return (
                        <div key={h} style={{
                          position: 'absolute', left: `${left}%`, top: 0,
                          transform: 'translateX(-50%)',
                          fontFamily: 'var(--mono)', fontSize: 10,
                          color: 'var(--ink-mute)',
                        }}>
                          {String(h).padStart(2, '0')}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {empRows.map((emp) => (
                    <div key={emp.key} style={{
                      display: 'grid',
                      gridTemplateColumns: '220px 1fr',
                      alignItems: 'center',
                      minHeight: 28,
                    }}>
                      <div style={{
                        paddingRight: 10, display: 'flex',
                        flexDirection: 'column', justifyContent: 'center',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          fontSize: 12, fontWeight: 500,
                          color: emp.unmapped ? 'var(--st-bad, #c97b6a)' : 'var(--ink)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {emp.name}
                        </div>
                        <div style={{
                          fontFamily: 'var(--mono)', fontSize: 9,
                          letterSpacing: '0.12em', textTransform: 'uppercase',
                          color: 'var(--ink-mute)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {emp.deptName}
                        </div>
                      </div>
                      <div style={{
                        position: 'relative', height: 22,
                        background: 'repeating-linear-gradient(to right, transparent, transparent calc(100%/' + totalSpan + ' - 1px), var(--line-soft) calc(100%/' + totalSpan + ' - 1px), var(--line-soft) calc(100%/' + totalSpan + '))',
                        borderRadius: 3,
                      }}>
                        {emp.shifts.map((sh) => {
                          const sH = hoursFromMidnight(sh.start_at);
                          const eH = hoursFromMidnight(sh.end_at);
                          const clipL = Math.max(minH, sH);
                          const clipR = Math.min(maxH, eH);
                          const left  = ((clipL - minH) / totalSpan) * 100;
                          const width = Math.max(2, ((clipR - clipL) / totalSpan) * 100);
                          const c = colorForDept(emp.deptCode);
                          const isUnconfirmed = (sh.status ?? '').toLowerCase() !== 'confirmed';
                          return (
                            <div
                              key={sh.shift_id}
                              title={`${fmtTime(sh.start_at)}–${fmtTime(sh.end_at)} · ${emp.deptName}${sh.status ? ' · ' + sh.status : ''}${sh.notes ? ' · ' + sh.notes : ''}`}
                              style={{
                                position: 'absolute',
                                left: `${left}%`,
                                width: `${width}%`,
                                top: 1, bottom: 1,
                                background: isUnconfirmed
                                  ? `repeating-linear-gradient(45deg, ${c} 0 6px, rgba(0,0,0,0.10) 6px 8px)`
                                  : c,
                                borderRadius: 3,
                                display: 'flex', alignItems: 'center',
                                paddingLeft: 6, paddingRight: 6,
                                color: '#fff',
                                fontFamily: 'var(--mono)', fontSize: 10,
                                fontWeight: 600,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                border: emp.unmapped ? '1px solid var(--st-bad, #c97b6a)' : 'none',
                              }}
                            >
                              {fmtTime(sh.start_at)}–{fmtTime(sh.end_at)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Department legend */}
            {legend.length > 0 && (
              <div style={{
                marginTop: 12, display: 'flex', gap: 14, flexWrap: 'wrap',
                alignItems: 'center',
              }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10,
                  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                  color: 'var(--ink-mute)',
                }}>
                  Legend
                </span>
                {legend.map((d) => (
                  <span key={d.code ?? d.name} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontFamily: 'var(--mono)', fontSize: 11,
                    letterSpacing: '0.10em', textTransform: 'uppercase',
                    color: 'var(--ink-mute)',
                  }}>
                    <span style={{
                      width: 12, height: 12, borderRadius: 3,
                      background: colorForDept(d.code),
                      display: 'inline-block',
                    }} />
                    {d.name} · {d.n}
                  </span>
                ))}
                <span style={{
                  marginLeft: 'auto',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--mono)', fontSize: 10,
                  letterSpacing: '0.10em', textTransform: 'uppercase',
                  color: 'var(--ink-mute)',
                }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: 'repeating-linear-gradient(45deg, var(--brass) 0 4px, rgba(0,0,0,0.2) 4px 6px)',
                    display: 'inline-block',
                  }} />
                  hatched = unconfirmed
                </span>
              </div>
            )}
          </section>

          {/* ── UPCOMING LIST ───────────────────────────────────────────── */}
          <section style={{ marginTop: 28 }}>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--brass)',
              }}>
                Upcoming · next 14 days
              </h2>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--ink-mute)',
              }}>
                {upcoming.length} shift{upcoming.length === 1 ? '' : 's'}
              </span>
            </div>
            <UpcomingTable rows={upcoming} />
          </section>
        </>
      )}
    </Page>
  );
}

// =============================================================================
// Atoms

function DayNavBtn({ href, label, highlight }: { href: string; label: string; highlight?: boolean }) {
  return (
    <a href={href} style={{
      padding: '4px 10px',
      fontFamily: 'var(--mono)', fontSize: 10,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: highlight ? 'var(--brass)' : 'var(--ink-mute)',
      background: highlight ? 'var(--paper-warm)' : 'transparent',
      border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
      borderRadius: 4, textDecoration: 'none',
      fontWeight: highlight ? 600 : 400,
    }}>{label}</a>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{
      textAlign: right ? 'right' : 'left',
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
  children, right, strong, mono, mute, center, colSpan,
}: {
  children: React.ReactNode;
  right?: boolean; strong?: boolean; mono?: boolean; mute?: boolean; center?: boolean;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} style={{
      textAlign: center ? 'center' : right ? 'right' : 'left',
      padding: '10px 12px',
      fontSize: mono ? 12 : 13,
      fontFamily: mono ? 'var(--mono)' : undefined,
      color: mute ? 'var(--ink-mute)' : 'var(--ink)',
      fontWeight: strong ? 600 : 400,
      borderTop: '1px solid var(--line-soft)',
      fontVariantNumeric: right ? 'tabular-nums' : undefined,
      fontStyle: mute ? 'italic' : undefined,
    }}>{children}</td>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? 'scheduled').toLowerCase();
  const map: Record<string, { bg: string; fg: string }> = {
    confirmed: { bg: 'rgba(107,147,121,0.18)', fg: 'var(--st-good, #82ad8c)' },
    scheduled: { bg: 'rgba(168,133,74,0.18)',  fg: 'var(--brass)' },
    pending:   { bg: 'rgba(168,133,74,0.18)',  fg: 'var(--brass)' },
    canceled:  { bg: 'var(--paper-deep)',      fg: 'var(--ink-mute)' },
    cancelled: { bg: 'var(--paper-deep)',      fg: 'var(--ink-mute)' },
  };
  const v = map[s] ?? map.scheduled;
  return (
    <span style={{
      background: v.bg, color: v.fg,
      padding: '2px 8px', borderRadius: 3,
      fontFamily: 'var(--mono)', fontSize: 10,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      border: '1px solid var(--kpi-frame)',
    }}>{s}</span>
  );
}

function UpcomingTable({ rows }: { rows: ShiftRow[] }) {
  return (
    <div style={{
      borderRadius: 4,
      border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
      background: 'var(--paper-warm)',
      overflowX: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Th>Day</Th>
            <Th>Start</Th>
            <Th>End</Th>
            <Th right>Hours</Th>
            <Th>Name</Th>
            <Th>Department</Th>
            <Th>Status</Th>
            <Th>Notes</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.shift_id}>
              <Td mono>
                <a href={`?d=${s.shift_date}`} style={{ color: 'var(--ink)', textDecoration: 'underline dotted' }}>
                  {fmtDayShort(s.shift_date)}
                </a>
              </Td>
              <Td mono strong>{fmtTime(s.start_at)}</Td>
              <Td mono>{fmtTime(s.end_at)}</Td>
              <Td right mono>{Number(s.hours_planned || 0).toFixed(1)}h</Td>
              <Td strong>
                {s.full_name || <span style={{ color: 'var(--st-bad, #c97b6a)' }}>UNMAPPED · {s.external_employee_id}</span>}
              </Td>
              <Td>{s.dept_name || <span style={{ color: 'var(--ink-faint)' }}>—</span>}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td mute>{s.notes || ''}</Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><Td colSpan={8} center mute>No upcoming shifts.</Td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
