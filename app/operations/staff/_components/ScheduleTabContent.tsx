// app/operations/staff/_components/ScheduleTabContent.tsx
// PBS 2026-05-13 — Schedule tab inside Staff.
//
// CHANGES (rev 2)
//   1. Timezone-aware: format times in property-local TZ
//      (Europe/Madrid for Donna, Asia/Vientiane for Namkhan).
//      Underlying data is `timestamptz` in UTC — UI must convert.
//   2. Department-grouped: each dept is a collapsible <details> block.
//   3. Overlay actual clock-in/out from ops.v_shifts_with_actuals on top
//      of scheduled bars + a per-shift punctuality badge (Δ minutes).
//   4. Hour scale auto-fits to local-time min/max for the selected day.

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
interface ShiftWithActual {
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
  // Overlay
  actual_clock_in: string | null;
  actual_clock_out: string | null;
  start_delta_minutes: number | null;
  end_delta_minutes: number | null;
  actual_hours: number | null;
  punctuality_score: number | null;
}
interface PunctualityRow {
  property_id: number;
  staff_id: string | null;
  full_name: string;
  avg_score: number | null;
  shifts_90d: number;
  no_show_90d: number;
  late_15_90d: number;
}

// =============================================================================
// TZ helpers — all rendering must go through these for Donna to read correctly.

const TZ_BY_PROPERTY: Record<number, string> = {
  260955:  'Asia/Vientiane',   // Namkhan
  1000001: 'Europe/Madrid',    // Donna
};

function fmtTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso));
  } catch { return '—'; }
}
function hoursInTz(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hh + mm / 60;
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

// =============================================================================
// Dept palette (brand-aligned, stable per dept_code)

const DEPT_COLORS = [
  '#a8854a', '#6b9379', '#c97b6a', '#7a98b8', '#8b7eb5',
  '#d2a857', '#5f9ea0', '#b8857a', '#7a8c5a', '#a47ec9',
] as const;
function colorForDept(deptCode: string | null): string {
  if (!deptCode) return 'var(--ink-mute)';
  let h = 0;
  for (let i = 0; i < deptCode.length; i++) h = (h * 31 + deptCode.charCodeAt(i)) >>> 0;
  return DEPT_COLORS[h % DEPT_COLORS.length];
}

// =============================================================================
// Punctuality presentation helpers

function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'var(--ink-mute)';
  if (score >= 80) return 'var(--st-good, #2c7a4b)';
  if (score >= 50) return 'var(--brass)';
  return 'var(--oxblood-soft, #c97b6a)';
}
function deltaLabel(delta: number | null | undefined): string {
  if (delta == null) return '—';
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${Math.abs(Math.round(delta))}m`;
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
  const tz = TZ_BY_PROPERTY[propertyId] ?? 'UTC';

  const todayIso = new Date().toISOString().slice(0, 10);
  const requestedDay = typeof searchParams?.d === 'string' ? searchParams.d : null;
  const selectedDay = (requestedDay && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay))
    ? requestedDay : todayIso;

  const stripStart = shiftDate(selectedDay, -3);
  const stripEnd   = shiftDate(selectedDay, +10);
  const in14d  = shiftDate(todayIso, 14);
  const back7d = shiftDate(todayIso, -7);

  const [kpiRes, daysRes, dayShiftsRes, upcomingRes, punctualityRes] = await Promise.all([
    supabase.schema('ops').from('v_schedule_kpis')
      .select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('ops').from('v_schedule_daily_window')
      .select('*').eq('property_id', propertyId)
      .gte('shift_date', back7d).lte('shift_date', in14d)
      .order('shift_date', { ascending: true }),
    supabase.schema('ops').from('v_shifts_with_actuals')
      .select('shift_id, staff_id, external_employee_id, full_name, dept_code, dept_name, shift_date, start_at, end_at, status, is_overtime, hours_planned, notes, actual_clock_in, actual_clock_out, start_delta_minutes, end_delta_minutes, actual_hours, punctuality_score')
      .eq('property_id', propertyId)
      .eq('shift_date', selectedDay)
      .order('start_at', { ascending: true }),
    supabase.schema('ops').from('v_shifts_with_actuals')
      .select('shift_id, staff_id, external_employee_id, full_name, dept_code, dept_name, shift_date, start_at, end_at, status, hours_planned, notes')
      .eq('property_id', propertyId)
      .gt('shift_date', todayIso)
      .lte('shift_date', in14d)
      .order('start_at', { ascending: true })
      .limit(300),
    supabase.schema('ops').from('v_staff_punctuality')
      .select('*').eq('property_id', propertyId),
  ]);

  const kpi       = (kpiRes.data as ScheduleKpiRow | null) ?? null;
  const days      = ((daysRes.data as ScheduleDayRow[] | null) ?? [])
    .filter((d) => d.shift_date >= stripStart && d.shift_date <= stripEnd);
  const dayShifts = (dayShiftsRes.data as ShiftWithActual[] | null) ?? [];
  const upcoming  = (upcomingRes.data as ShiftWithActual[] | null) ?? [];
  const punct     = (punctualityRes.data as PunctualityRow[] | null) ?? [];

  const punctByStaff = new Map<string, PunctualityRow>();
  for (const p of punct) if (p.staff_id) punctByStaff.set(p.staff_id, p);

  const eyebrow = propertyLabel
    ? `Operations · Staff · Schedule · ${propertyLabel}`
    : `Operations · Staff · Schedule`;
  const hasData = (kpi?.shifts_total ?? 0) > 0;

  // ── Date strip ─────────────────────────────────────────────────────────
  const stripDays: ScheduleDayRow[] = [];
  for (let i = -3; i <= 10; i++) {
    const iso = shiftDate(selectedDay, i);
    const row = days.find((d) => d.shift_date === iso);
    stripDays.push(row ?? {
      property_id: propertyId, shift_date: iso,
      shifts: 0, distinct_staff: 0, confirmed: 0, hours: 0,
    });
  }
  const maxShiftsInStrip = stripDays.reduce((m, d) => Math.max(m, d.shifts), 0) || 1;

  // ── Hour bounds (LOCAL TZ) ─────────────────────────────────────────────
  let minH = 5, maxH = 23;
  if (dayShifts.length > 0) {
    const starts = dayShifts.map((s) => hoursInTz(s.start_at, tz));
    const ends   = dayShifts.map((s) => hoursInTz(s.end_at, tz));
    minH = Math.max(0, Math.floor(Math.min(...starts)));
    maxH = Math.min(24, Math.ceil(Math.max(...ends)));
    if (maxH - minH < 6) {
      const slack = 6 - (maxH - minH);
      minH = Math.max(0, minH - Math.floor(slack / 2));
      maxH = Math.min(24, maxH + Math.ceil(slack / 2));
    }
  }
  const totalSpan = Math.max(1, maxH - minH);
  const hourTicks: number[] = [];
  for (let h = minH; h <= maxH; h++) hourTicks.push(h);

  // ── Build per-employee rows, then group by dept ────────────────────────
  type EmpRow = {
    key: string;
    name: string;
    deptName: string;
    deptCode: string | null;
    shifts: ShiftWithActual[];
    unmapped: boolean;
    avgPunctuality90d: number | null;
  };
  const empMap = new Map<string, EmpRow>();
  for (const s of dayShifts) {
    const key = s.staff_id ?? `ext:${s.external_employee_id}`;
    const punct = s.staff_id ? punctByStaff.get(s.staff_id)?.avg_score ?? null : null;
    const cur = empMap.get(key) ?? {
      key,
      name: s.full_name ?? `UNMAPPED · ${s.external_employee_id}`,
      deptName: s.dept_name ?? '—',
      deptCode: s.dept_code ?? null,
      shifts: [], unmapped: !s.staff_id,
      avgPunctuality90d: punct,
    };
    cur.shifts.push(s);
    empMap.set(key, cur);
  }
  const allEmps = [...empMap.values()].sort((a, b) => {
    const aStart = Math.min(...a.shifts.map((s) => hoursInTz(s.start_at, tz)));
    const bStart = Math.min(...b.shifts.map((s) => hoursInTz(s.start_at, tz)));
    if (aStart !== bStart) return aStart - bStart;
    return a.name.localeCompare(b.name);
  });

  // Group by dept (preserve order, biggest first)
  type DeptGroup = {
    code: string | null;
    name: string;
    emps: EmpRow[];
    shiftCount: number;
    hours: number;
    deptPunctuality: number | null;
  };
  const deptMap = new Map<string, DeptGroup>();
  for (const e of allEmps) {
    const k = e.deptCode ?? e.deptName;
    const cur = deptMap.get(k) ?? {
      code: e.deptCode, name: e.deptName,
      emps: [], shiftCount: 0, hours: 0,
      deptPunctuality: null,
    };
    cur.emps.push(e);
    cur.shiftCount += e.shifts.length;
    cur.hours += e.shifts.reduce((s, sh) => s + Number(sh.hours_planned || 0), 0);
    deptMap.set(k, cur);
  }
  const deptGroups = [...deptMap.values()].sort((a, b) => b.emps.length - a.emps.length || a.name.localeCompare(b.name));
  // Per-dept avg punctuality (today's matched shifts)
  for (const g of deptGroups) {
    const scored = g.emps.flatMap((e) => e.shifts)
      .map((s) => s.punctuality_score)
      .filter((x): x is number => x != null);
    g.deptPunctuality = scored.length > 0
      ? Math.round(scored.reduce((s, x) => s + x, 0) / scored.length)
      : null;
  }

  // Day-level totals
  const dayHours = allEmps.reduce((s, r) => s + r.shifts.reduce((ss, sh) => ss + Number(sh.hours_planned || 0), 0), 0);
  const dayScored = dayShifts.map((s) => s.punctuality_score).filter((x): x is number => x != null);
  const dayAvgScore = dayScored.length > 0 ? Math.round(dayScored.reduce((s, x) => s + x, 0) / dayScored.length) : null;
  // Global Donna 90d avg
  const donna90dScored = punct.filter((p) => p.avg_score != null && p.shifts_90d > 0);
  const global90d = donna90dScored.length > 0
    ? Math.round(donna90dScored.reduce((s, p) => s + (Number(p.avg_score) || 0), 0) / donna90dScored.length)
    : null;

  return (
    <Page
      eyebrow={eyebrow}
      title={<>Staff <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>schedule</em></>}
      subPages={rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      <StaffTabStrip propertyId={propertyId} />

      <KpiStrip items={[
        { label: 'Today',         value: kpi?.today ?? 0,                 kind: 'count', tone: (kpi?.today ?? 0) > 0 ? 'pos' : 'neutral', hint: `${tz}` },
        { label: 'Selected day',  value: dayShifts.length,                kind: 'count', hint: fmtDayShort(selectedDay) },
        { label: 'Staff on day',  value: allEmps.length,                  kind: 'count', hint: `${dayHours.toFixed(0)}h planned` },
        { label: 'Punctuality · day', value: dayAvgScore != null ? `${dayAvgScore}/100` : '—', tone: dayAvgScore != null && dayAvgScore >= 80 ? 'pos' : dayAvgScore != null && dayAvgScore < 50 ? 'warn' : 'neutral', hint: `${dayScored.length} matched` },
        { label: 'Punctuality · 90d', value: global90d != null ? `${global90d}/100` : '—', tone: global90d != null && global90d >= 80 ? 'pos' : global90d != null && global90d < 50 ? 'warn' : 'neutral', hint: 'avg · all staff' },
        { label: 'Confirmed',     value: kpi?.confirmed_upcoming ?? 0,    kind: 'count', tone: 'pos', hint: 'forward · confirmed' },
        { label: 'Unconfirmed',   value: kpi?.scheduled_unconfirmed ?? 0, kind: 'count', tone: (kpi?.scheduled_unconfirmed ?? 0) > 0 ? 'warn' : 'pos', hint: 'needs signoff' },
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
            Donna uses Factorial shifts. Namkhan has no shift-planning system wired today.
          </div>
        </div>
      )}

      {hasData && (
        <>
          {/* ── DATE STRIP ─────────────────────────────────────────────── */}
          <section style={{ marginTop: 22 }}>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--brass)',
              }}>
                Pick a day · −3 → +10 · times shown in {tz}
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
                const isSel   = d.shift_date === selectedDay;
                const isToday = d.shift_date === todayIso;
                const pct     = (d.shifts / maxShiftsInStrip) * 100;
                return (
                  <a key={d.shift_date} href={`?d=${d.shift_date}`} style={{
                    padding: '8px 6px', borderRadius: 4,
                    background: isSel ? 'var(--paper-warm)' : 'transparent',
                    border: isSel
                      ? '1px solid var(--brass)'
                      : isToday
                        ? '1px dashed var(--ink)'
                        : '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
                    color: 'var(--ink)', textDecoration: 'none', textAlign: 'center',
                  }}>
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 9,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: isSel ? 'var(--brass)' : 'var(--ink-mute)',
                    }}>
                      {new Date(d.shift_date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short' })}
                    </div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: isSel ? 600 : 400, marginTop: 2 }}>
                      {d.shift_date.slice(8)}
                    </div>
                    <div style={{ height: 4, marginTop: 6, background: 'var(--paper-deep)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: isSel ? 'var(--brass)' : 'var(--ink-faint)' }} />
                    </div>
                    <div style={{ marginTop: 4, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-mute)' }}>
                      {d.shifts || '—'}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* ── DAY GANTT — DEPT-GROUPED ───────────────────────────────── */}
          <section style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--brass)',
              }}>
                {fmtDayLong(selectedDay)} · {allEmps.length} on duty
              </h2>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--ink-mute)',
              }}>
                {dayShifts.length} shift{dayShifts.length === 1 ? '' : 's'} · {dayHours.toFixed(0)}h
              </span>
            </div>

            {/* Hour scale (shared across all depts) */}
            {allEmps.length > 0 && (
              <div style={{
                border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
                background: 'var(--paper-warm)',
                borderRadius: 4, padding: '8px 12px',
                marginBottom: 6, overflowX: 'auto',
              }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'end',
                }}>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 10,
                    letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'var(--brass)', fontWeight: 600,
                  }}>
                    Employee · Dept · 90d punctuality
                  </div>
                  <div style={{ position: 'relative', height: 16 }}>
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
              </div>
            )}

            {/* Dept groups — each collapsible */}
            {allEmps.length === 0 ? (
              <div className="panel dashed" style={{
                padding: 24, textAlign: 'center', color: 'var(--ink-mute)',
                background: 'var(--paper-warm)',
                border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
                borderRadius: 4, fontStyle: 'italic',
              }}>
                No staff scheduled on {fmtDayShort(selectedDay)}.
              </div>
            ) : deptGroups.map((g, idx) => (
              <details key={g.code ?? g.name} open={idx < 3} style={{
                border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
                background: 'var(--paper-warm)',
                borderRadius: 4, marginBottom: 6,
                overflow: 'hidden',
              }}>
                <summary style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', cursor: 'pointer',
                  background: 'var(--paper)',
                  borderBottom: '1px solid var(--line-soft)',
                }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: colorForDept(g.code), display: 'inline-block',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 11,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'var(--ink)', fontWeight: 600,
                  }}>
                    {g.name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 10,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'var(--ink-mute)',
                  }}>
                    {g.emps.length} on duty · {g.shiftCount} shift{g.shiftCount === 1 ? '' : 's'} · {g.hours.toFixed(0)}h
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {g.deptPunctuality != null && (
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 10,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        color: scoreColor(g.deptPunctuality),
                        fontWeight: 600,
                      }}>
                        {g.deptPunctuality}/100 today
                      </span>
                    )}
                  </span>
                </summary>

                <div style={{ padding: 8 }}>
                  {g.emps.map((emp) => (
                    <EmpRow
                      key={emp.key}
                      emp={emp}
                      tz={tz}
                      minH={minH}
                      totalSpan={totalSpan}
                    />
                  ))}
                </div>
              </details>
            ))}

            {/* Legend */}
            {deptGroups.length > 0 && (
              <div style={{
                marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap',
                alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: '0.10em', textTransform: 'uppercase',
                color: 'var(--ink-mute)',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 22, height: 6, borderRadius: 2,
                    background: 'var(--brass)', display: 'inline-block', opacity: 0.7,
                  }} /> Scheduled
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 22, height: 6, borderRadius: 2,
                    background: 'transparent', border: '1px solid var(--ink)',
                    display: 'inline-block',
                  }} /> Actual clock-in / out
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 22, height: 6, borderRadius: 2,
                    background: 'repeating-linear-gradient(45deg, var(--brass) 0 4px, rgba(0,0,0,0.2) 4px 6px)',
                    display: 'inline-block',
                  }} /> Unconfirmed shift
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--st-good, #2c7a4b)' }}>●</span> ≥80 on time
                  <span style={{ color: 'var(--brass)' }}>●</span> 50–79
                  <span style={{ color: 'var(--oxblood-soft, #c97b6a)' }}>●</span> &lt;50 late/early
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
            <UpcomingTable rows={upcoming} tz={tz} />
          </section>
        </>
      )}
    </Page>
  );
}

// =============================================================================
// EmpRow — scheduled bar with actual overlay + punctuality badge

function EmpRow({
  emp, tz, minH, totalSpan,
}: {
  emp: {
    key: string;
    name: string;
    deptName: string;
    deptCode: string | null;
    shifts: ShiftWithActual[];
    unmapped: boolean;
    avgPunctuality90d: number | null;
  };
  tz: string;
  minH: number;
  totalSpan: number;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '220px 1fr',
      alignItems: 'center', minHeight: 28, marginBottom: 2,
    }}>
      <div style={{ paddingRight: 10, overflow: 'hidden' }}>
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: emp.unmapped ? 'var(--st-bad, #c97b6a)' : 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {emp.name}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--mono)', fontSize: 9,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--ink-mute)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <span>{emp.deptName}</span>
          {emp.avgPunctuality90d != null && (
            <span style={{ color: scoreColor(emp.avgPunctuality90d), fontWeight: 600 }}>
              · {Math.round(emp.avgPunctuality90d)}/100
            </span>
          )}
        </div>
      </div>
      <div style={{
        position: 'relative', height: 26,
        background: 'repeating-linear-gradient(to right, transparent, transparent calc(100%/' + totalSpan + ' - 1px), var(--line-soft) calc(100%/' + totalSpan + ' - 1px), var(--line-soft) calc(100%/' + totalSpan + '))',
        borderRadius: 3,
      }}>
        {emp.shifts.map((sh) => {
          const sH = hoursInTz(sh.start_at, tz);
          const eH = hoursInTz(sh.end_at, tz);
          // clip to visible window
          const clipL = Math.max(minH, sH);
          const clipR = Math.min(minH + totalSpan, eH);
          const left  = ((clipL - minH) / totalSpan) * 100;
          const width = Math.max(2, ((clipR - clipL) / totalSpan) * 100);
          const c = colorForDept(emp.deptCode);
          const isUnconfirmed = (sh.status ?? '').toLowerCase() !== 'confirmed';

          // Actual overlay
          let actualLeft: number | null = null;
          let actualWidth: number | null = null;
          if (sh.actual_clock_in) {
            const aS = hoursInTz(sh.actual_clock_in, tz);
            const aE = sh.actual_clock_out ? hoursInTz(sh.actual_clock_out, tz) : aS + 0.05;
            const aL = Math.max(minH, aS);
            const aR = Math.min(minH + totalSpan, aE);
            actualLeft  = ((aL - minH) / totalSpan) * 100;
            actualWidth = Math.max(1, ((aR - aL) / totalSpan) * 100);
          }

          return (
            <div key={sh.shift_id} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
              {/* Scheduled bar */}
              <div
                title={`Scheduled ${fmtTime(sh.start_at, tz)}–${fmtTime(sh.end_at, tz)} · ${emp.deptName}${sh.status ? ' · ' + sh.status : ''}${sh.notes ? ' · ' + sh.notes : ''}`}
                style={{
                  position: 'absolute', left: `${left}%`, width: `${width}%`,
                  top: 2, height: 11,
                  background: isUnconfirmed
                    ? `repeating-linear-gradient(45deg, ${c} 0 6px, rgba(0,0,0,0.10) 6px 8px)`
                    : c,
                  opacity: 0.55,
                  borderRadius: 3,
                  display: 'flex', alignItems: 'center',
                  paddingLeft: 6, paddingRight: 6,
                  color: '#fff', fontFamily: 'var(--mono)', fontSize: 9,
                  fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {fmtTime(sh.start_at, tz)}–{fmtTime(sh.end_at, tz)}
              </div>
              {/* Actual overlay */}
              {actualLeft != null && actualWidth != null && (
                <div
                  title={`Actual ${fmtTime(sh.actual_clock_in, tz)}${sh.actual_clock_out ? '–' + fmtTime(sh.actual_clock_out, tz) : ' (still in)'} · Δ ${deltaLabel(sh.start_delta_minutes)} · score ${sh.punctuality_score ?? '—'}`}
                  style={{
                    position: 'absolute', left: `${actualLeft}%`, width: `${actualWidth}%`,
                    top: 14, height: 9,
                    background: 'transparent',
                    border: `1.5px solid ${scoreColor(sh.punctuality_score)}`,
                    borderRadius: 3,
                  }}
                />
              )}
              {/* Punctuality badge (right of scheduled bar) */}
              {sh.punctuality_score != null && (
                <div style={{
                  position: 'absolute',
                  left: `${Math.min(95, left + width + 0.5)}%`,
                  top: 2, height: 11,
                  display: 'flex', alignItems: 'center',
                  fontFamily: 'var(--mono)', fontSize: 9,
                  fontWeight: 600,
                  color: scoreColor(sh.punctuality_score),
                  whiteSpace: 'nowrap',
                  paddingLeft: 4,
                }}>
                  {deltaLabel(sh.start_delta_minutes)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
      color: 'var(--brass)', fontWeight: 600, whiteSpace: 'nowrap',
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
function UpcomingTable({ rows, tz }: { rows: ShiftWithActual[]; tz: string }) {
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
              <Td mono strong>{fmtTime(s.start_at, tz)}</Td>
              <Td mono>{fmtTime(s.end_at, tz)}</Td>
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
