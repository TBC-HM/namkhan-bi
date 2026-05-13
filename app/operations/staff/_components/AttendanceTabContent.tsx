// app/operations/staff/_components/AttendanceTabContent.tsx
// PBS 2026-05-13 — Attendance rendered as a TAB inside Staff.
// Re-uses the existing Attendance body (charts + on-shift + messy data)
// but wraps it with Staff's eyebrow + sub-strip + StaffTabStrip so the
// dept-strip still says "Operations" and the inner tabs are
// Register / Attendance / Schedule.

import { supabase } from '@/lib/supabase';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import StaffTabStrip from './StaffTabStrip';
import { AttendanceCharts, type DailyPoint, type TopEmployee } from '../../attendance/_components/AttendanceCharts';
import { OnShiftAndUnmapped } from '../../attendance/_components/OnShiftAndUnmapped';

interface KpiRow {
  property_id: number;
  clocked_in_now: number;
  events_7d: number;
  events_30d: number;
  active_employees_7d: number;
  active_employees_30d: number;
  hours_7d: number;
  hours_30d: number;
  avg_shift_h_30d: number | null;
}
interface ScoreRow {
  staff_id: string; full_name: string; events_30d: number;
  active_days_30d: number; hours_30d: number; hours_ytd: number;
  last_in: string | null; attendance_score: number;
}
interface OpenRow {
  staff_id: string | null; external_employee_id: string;
  full_name: string | null; dept_name: string | null;
  clock_in_at: string; method: string | null;
}
interface RecentRow {
  staff_id: string | null; external_employee_id: string;
  full_name: string | null; dept_name: string | null;
  clock_in_at: string; clock_out_at: string | null;
  hours: number | null; method: string | null;
}
interface UnmappedRow {
  ext_id: string; clock_events: number; first_seen: string; last_seen: string;
  events_7d: number; events_30d: number; days_active: number;
}

export default async function AttendanceTabContent({
  propertyId,
  propertyLabel,
}: {
  propertyId: number;
  propertyLabel?: string;
}) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [kpiRes, dailyRes, scoresRes, openRes, unmappedRes, recentRes, registerRes] = await Promise.all([
    supabase.schema('ops').from('v_attendance_kpis').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('ops').from('v_attendance_daily_trend').select('*').eq('property_id', propertyId).order('work_date'),
    supabase.schema('ops').from('v_staff_attendance_score').select('*').eq('property_id', propertyId).order('hours_30d', { ascending: false }),
    supabase.schema('ops').from('v_timeclock_enriched')
      .select('staff_id, external_employee_id, full_name, dept_name, clock_in_at, method')
      .eq('property_id', propertyId)
      .is('clock_out_at', null)
      .gte('clock_in_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('clock_in_at', { ascending: false }),
    supabase.schema('ops').from('v_staff_unmapped').select('*').eq('property_id', propertyId).order('events_30d', { ascending: false }),
    supabase.schema('ops').from('v_timeclock_enriched')
      .select('staff_id, external_employee_id, full_name, dept_name, clock_in_at, clock_out_at, hours, method')
      .eq('property_id', propertyId)
      .gte('clock_in_at', sevenDaysAgo)
      .order('clock_in_at', { ascending: false })
      .limit(300),
    // PBS 2026-05-13: pull contract_hours_pw per staff so we can render
    // utilization bars (actual hours vs contracted 30d expected hours).
    // Pin schema('public') — same duplicate-view caveat as v_staff_detail.
    supabase
      .schema('public')
      .from('v_staff_register_extended')
      .select('staff_id, contract_hours_pw, dept_name')
      .eq('property_id', propertyId)
      .eq('is_active', true),
  ]);

  const kpi    = (kpiRes.data as KpiRow | null) ?? null;
  const daily  = (dailyRes.data as DailyPoint[] | null) ?? [];
  // PBS 2026-05-13: filter out ghost rows from the LEFT JOIN rebuild —
  // active staff with zero clock-in events in last 30d. Otherwise the
  // scoreboard count disagrees with the "Active · 30d" KPI tile.
  // Ghost rows are surfaced separately via the Unmapped/No-clock signals.
  const allScores  = (scoresRes.data as ScoreRow[] | null) ?? [];
  const scores     = allScores.filter((s) => Number(s.events_30d || 0) > 0);
  const ghostCount = allScores.length - scores.length;
  const openShifts = (openRes.data as OpenRow[] | null) ?? [];
  const unmapped = (unmappedRes.data as UnmappedRow[] | null) ?? [];
  const recent   = (recentRes.data as RecentRow[] | null) ?? [];

  const top10: TopEmployee[] = scores.slice(0, 10).map(s => ({ full_name: s.full_name, hours: Number(s.hours_30d) }));

  // PBS 2026-05-13: build utilization rows for the expandable view.
  // expected_30d_hours = contract_hours_pw × 30/7.
  // Default full-time fallback (40h/wk) when contract is NULL — typical
  // for Donna; ~33 of 82 active staff have NULL contract.
  type RegisterRow = { staff_id: string; contract_hours_pw: number | null; dept_name: string | null };
  const registerRows = (registerRes.data as RegisterRow[] | null) ?? [];
  const contractByStaff = new Map<string, { hours_pw: number; dept_name: string }>();
  for (const r of registerRows) {
    contractByStaff.set(r.staff_id, {
      hours_pw: Number(r.contract_hours_pw ?? 40),
      dept_name: r.dept_name ?? '—',
    });
  }
  const utilization = scores.map((s) => {
    const reg = contractByStaff.get(s.staff_id);
    const hoursPw = reg?.hours_pw ?? 40;
    const expected30d = hoursPw * 30 / 7;
    const actual30d = Number(s.hours_30d || 0);
    const pct = expected30d > 0 ? (actual30d / expected30d) * 100 : 0;
    return {
      staff_id: s.staff_id,
      full_name: s.full_name,
      dept_name: reg?.dept_name ?? '—',
      hours_30d: actual30d,
      expected_30d: expected30d,
      pct,
      contract_known: contractByStaff.has(s.staff_id) && (registerRows.find(r => r.staff_id === s.staff_id)?.contract_hours_pw ?? null) != null,
    };
  }).sort((a, b) => b.pct - a.pct);

  const eyebrow = propertyLabel
    ? `Operations · Staff · Attendance · ${propertyLabel}`
    : `Operations · Staff · Attendance`;

  const hasData = (kpi?.events_30d ?? 0) > 0;

  return (
    <Page
      eyebrow={eyebrow}
      title={<>Clock-in / <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>out</em></>}
      subPages={rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      <StaffTabStrip propertyId={propertyId} />

      <KpiStrip items={[
        { label: 'Clocked in NOW', value: kpi?.clocked_in_now ?? 0, kind: 'count', tone: (kpi?.clocked_in_now ?? 0) > 0 ? 'pos' : 'neutral', hint: 'last 24h, no clock-out' },
        { label: 'Active · 7d',    value: kpi?.active_employees_7d ?? 0, kind: 'count', hint: `${kpi?.events_7d ?? 0} events` },
        { label: 'Active · 30d',   value: kpi?.active_employees_30d ?? 0, kind: 'count', hint: `${kpi?.events_30d ?? 0} events` },
        { label: 'Hours · 7d',     value: `${kpi?.hours_7d ?? 0}h` },
        { label: 'Hours · 30d',    value: `${kpi?.hours_30d ?? 0}h` },
        { label: 'Avg shift',      value: kpi?.avg_shift_h_30d != null ? `${kpi.avg_shift_h_30d}h` : '—', hint: '30d avg duration' },
        { label: 'No-clock active', value: ghostCount, kind: 'count', tone: ghostCount > 0 ? 'warn' : 'pos', hint: 'active staff · 0 events 30d' },
        { label: 'Unmapped',       value: unmapped.length, kind: 'count', tone: unmapped.length > 0 ? 'warn' : 'pos', hint: 'clock-in / no profile' },
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
            No clock-in / out data yet for this property
          </div>
          <div style={{ fontSize: 'var(--t-sm)' }}>
            Donna uses Factorial timeclock. Namkhan attendance lives in <code>ops.staff_attendance</code> (manual codes). Sync to populate.
          </div>
        </div>
      )}

      {hasData && (
        <>
          <div style={{ marginTop: 20 }}>
            <AttendanceCharts daily={daily} topEmployees={top10} utilization={utilization} />
          </div>
          <OnShiftAndUnmapped openShifts={openShifts} unmapped={unmapped} scores={scores} recent={recent} />
        </>
      )}
    </Page>
  );
}
