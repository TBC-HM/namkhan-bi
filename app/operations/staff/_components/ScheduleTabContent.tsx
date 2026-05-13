// app/operations/staff/_components/ScheduleTabContent.tsx
// PBS 2026-05-13 — Schedule tab inside Staff.
// Pulls ops.v_schedule_kpis, ops.v_schedule_daily_window (14d back → 30d fwd),
// and ops.v_shifts_enriched (next 14d).
//
// Layout:
//   KPI strip (7 tiles)
//   Daily heatmap (shifts + confirmed + hours) — table rows
//   Today's roster
//   Upcoming shifts table

import { supabase } from '@/lib/supabase';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import StaffTabStrip from './StaffTabStrip';

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

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return '—'; }
}
function fmtDay(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short',
    });
  } catch { return iso; }
}

export default async function ScheduleTabContent({
  propertyId,
  propertyLabel,
}: {
  propertyId: number;
  propertyLabel?: string;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const in14d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const back14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [kpiRes, daysRes, todayRes, upcomingRes] = await Promise.all([
    supabase.schema('ops').from('v_schedule_kpis')
      .select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('ops').from('v_schedule_daily_window')
      .select('*').eq('property_id', propertyId)
      .gte('shift_date', back14d).lte('shift_date', in14d)
      .order('shift_date', { ascending: true }),
    supabase.schema('ops').from('v_shifts_enriched')
      .select('shift_id, staff_id, external_employee_id, full_name, dept_code, dept_name, shift_date, start_at, end_at, status, is_overtime, hours_planned, notes')
      .eq('property_id', propertyId)
      .eq('shift_date', todayIso)
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
  const days     = (daysRes.data as ScheduleDayRow[] | null) ?? [];
  const today    = (todayRes.data as ShiftRow[] | null) ?? [];
  const upcoming = (upcomingRes.data as ShiftRow[] | null) ?? [];

  const eyebrow = propertyLabel
    ? `Operations · Staff · Schedule · ${propertyLabel}`
    : `Operations · Staff · Schedule`;

  const hasData = (kpi?.shifts_total ?? 0) > 0;

  // Pre-compute a per-day max for the bar in the day list
  const maxShifts = days.reduce((m, d) => Math.max(m, Number(d.shifts || 0)), 0) || 1;

  return (
    <Page
      eyebrow={eyebrow}
      title={<>Staff <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>schedule</em></>}
      subPages={rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      <StaffTabStrip propertyId={propertyId} />

      <KpiStrip items={[
        { label: 'Today',        value: kpi?.today ?? 0,                 kind: 'count', tone: (kpi?.today ?? 0) > 0 ? 'pos' : 'neutral', hint: 'shifts scheduled today' },
        { label: 'Next 7d',      value: kpi?.next_7d ?? 0,               kind: 'count', hint: `${kpi?.staff_next_7d ?? 0} staff` },
        { label: 'Next 30d',     value: kpi?.next_30d ?? 0,              kind: 'count', hint: 'rolling window' },
        { label: 'Upcoming',     value: kpi?.upcoming ?? 0,              kind: 'count', hint: 'all forward shifts' },
        { label: 'Confirmed',    value: kpi?.confirmed_upcoming ?? 0,    kind: 'count', tone: 'pos', hint: 'status confirmed' },
        { label: 'Unconfirmed',  value: kpi?.scheduled_unconfirmed ?? 0, kind: 'count', tone: (kpi?.scheduled_unconfirmed ?? 0) > 0 ? 'warn' : 'pos', hint: 'needs signoff' },
        { label: 'Shifts total', value: kpi?.shifts_total ?? 0,          kind: 'count', hint: 'all time on record' },
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
          {/* Daily window */}
          <section style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--brass)',
              }}>
                Daily roster · −14d → +14d
              </h2>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--ink-mute)',
              }}>
                ops.v_schedule_daily_window
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
                    <Th>Day</Th>
                    <Th right>Shifts</Th>
                    <Th right>Staff</Th>
                    <Th right>Confirmed</Th>
                    <Th right>Hours</Th>
                    <Th>Load</Th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const isToday = d.shift_date === todayIso;
                    const isPast = d.shift_date < todayIso;
                    const pct = (Number(d.shifts || 0) / maxShifts) * 100;
                    return (
                      <tr key={d.shift_date} style={{
                        background: isToday ? 'rgba(168,133,74,0.10)' : undefined,
                        opacity: isPast ? 0.55 : 1,
                      }}>
                        <Td mono strong={isToday}>{fmtDay(d.shift_date)}{isToday ? ' · today' : ''}</Td>
                        <Td right strong>{d.shifts}</Td>
                        <Td right>{d.distinct_staff}</Td>
                        <Td right>{d.confirmed}/{d.shifts}</Td>
                        <Td right mono>{Number(d.hours || 0).toFixed(0)}h</Td>
                        <Td>
                          <div style={{
                            height: 8, width: '100%', minWidth: 80, maxWidth: 240,
                            background: 'var(--paper-deep)', borderRadius: 4, overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: isPast ? 'var(--ink-faint)' : 'var(--brass)',
                            }} />
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                  {days.length === 0 && (
                    <tr><Td colSpan={6} center mute>No days in window.</Td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Today's roster */}
          <section style={{ marginTop: 28 }}>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--brass)',
              }}>
                Today’s roster · {fmtDay(todayIso)}
              </h2>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--ink-mute)',
              }}>
                {today.length} shift{today.length === 1 ? '' : 's'}
              </span>
            </div>
            <ShiftsTable rows={today} emptyHint="No shifts scheduled today." />
          </section>

          {/* Upcoming */}
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
            <ShiftsTable rows={upcoming} emptyHint="No upcoming shifts." showDate />
          </section>
        </>
      )}
    </Page>
  );
}

// --- atoms ---------------------------------------------------------------

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

function ShiftsTable({
  rows, emptyHint, showDate,
}: { rows: ShiftRow[]; emptyHint: string; showDate?: boolean }) {
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
            {showDate && <Th>Day</Th>}
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
              {showDate && <Td mono>{fmtDay(s.shift_date)}</Td>}
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
            <tr><Td colSpan={showDate ? 8 : 7} center mute>{emptyHint}</Td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
