// app/operations/attendance/_components/OnShiftAndUnmapped.tsx
// PBS 2026-05-13 — client tables: On-shift NOW, Staff scoreboard, Messy data.

'use client';

import { useState, useCallback, useEffect } from 'react';
import { StaffDrawer } from '../../staff/_components/StaffDrawer';

interface OpenRow {
  staff_id: string | null;
  external_employee_id: string;
  full_name: string | null;
  dept_name: string | null;
  clock_in_at: string;
  method: string | null;
}

interface ScoreRow {
  staff_id: string;
  full_name: string;
  events_30d: number;
  active_days_30d: number;
  hours_30d: number;
  hours_ytd: number;
  last_in: string | null;
  attendance_score: number;
}

interface UnmappedRow {
  ext_id: string;
  clock_events: number;
  first_seen: string;
  last_seen: string;
  events_7d: number;
  events_30d: number;
  days_active: number;
}

interface RecentRow {
  staff_id: string | null;
  external_employee_id: string;
  full_name: string | null;
  dept_name: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  hours: number | null;
  method: string | null;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const COMMON_TD: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13,
  borderTop: '1px solid var(--line-soft)',
};
const COMMON_TH: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px',
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em',
  textTransform: 'uppercase', color: 'var(--brass)', fontWeight: 600,
  borderBottom: '1px solid var(--kpi-frame)', whiteSpace: 'nowrap',
};

const WRAPPER: React.CSSProperties = {
  borderRadius: 4,
  border: '1px solid var(--kpi-frame)',
  background: 'var(--paper-warm)',
  overflow: 'hidden',
  marginTop: 16,
};
const HEADER_ROW: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--paper)',
  borderBottom: '1px solid var(--line-soft)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const HEADER_TITLE: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
  color: 'var(--brass)',
};

const NO_PROFILE_BADGE: React.CSSProperties = {
  background: 'var(--oxblood, #6b1f1f)',
  color: '#fff',
  padding: '2px 7px',
  borderRadius: 3,
  fontFamily: 'var(--mono)',
  fontSize: 9,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

export function OnShiftAndUnmapped({
  openShifts, unmapped, scores, recent,
}: {
  openShifts: OpenRow[];
  unmapped: UnmappedRow[];
  scores: ScoreRow[];
  recent: RecentRow[];
}) {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const handleClose = useCallback(() => setSelectedStaffId(null), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handleClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  return (
    <>
      {/* On shift now */}
      <details open style={{ marginTop: 28 }}>
        <summary style={HEADER_TITLE}>
          ▾ On shift NOW · {openShifts.length} clocked in
        </summary>
        <div style={{ ...WRAPPER, marginTop: 10 }}>
          {openShifts.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
              Nobody is currently clocked in.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={COMMON_TH}>Name</th>
                  <th style={COMMON_TH}>Department</th>
                  <th style={COMMON_TH}>Clocked in</th>
                  <th style={COMMON_TH}>Duration</th>
                  <th style={COMMON_TH}>Method</th>
                </tr>
              </thead>
              <tbody>
                {openShifts.map((r, i) => {
                  const clickable = !!r.staff_id;
                  const unmappedFlag = !r.staff_id;
                  const rowBg = unmappedFlag ? 'rgba(178,60,42,0.10)' : undefined;
                  return (
                    <tr key={i}
                        onClick={() => clickable && setSelectedStaffId(r.staff_id)}
                        style={{ cursor: clickable ? 'pointer' : 'default', background: rowBg }}>
                      <td style={{ ...COMMON_TD, fontWeight: 500 }}>
                        {r.full_name ?? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={NO_PROFILE_BADGE}>NO PROFILE</span>
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--oxblood-soft)' }}>#{r.external_employee_id}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ ...COMMON_TD, color: unmappedFlag ? 'var(--oxblood-soft)' : 'var(--ink-soft)' }}>
                        {r.dept_name ?? (unmappedFlag ? '— follow up' : '—')}
                      </td>
                      <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtClock(r.clock_in_at)}</td>
                      <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--st-good, #2c7a4b)' }}>
                        {timeAgo(r.clock_in_at)}
                      </td>
                      <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {r.method ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </details>

      {/* Employee scoreboard */}
      <details open style={{ marginTop: 16 }}>
        <summary style={HEADER_TITLE}>
          ▾ Employee attendance score · {scores.length} people · last 30 days
        </summary>
        <div style={{ ...WRAPPER, marginTop: 10 }}>
          {scores.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
              No clock activity in the last 30 days.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={COMMON_TH}>Name</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Score</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Events</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Days</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Hours · 30d</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Hours · YTD</th>
                  <th style={COMMON_TH}>Last in</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.staff_id}
                      onClick={() => setSelectedStaffId(s.staff_id)}
                      style={{ cursor: 'pointer' }}>
                    <td style={{ ...COMMON_TD, fontWeight: 500 }}>{s.full_name}</td>
                    <td style={{ ...COMMON_TD, textAlign: 'right' }}><ScoreBar score={s.attendance_score} /></td>
                    <td style={{ ...COMMON_TD, textAlign: 'right', fontFamily: 'var(--mono)' }}>{s.events_30d}</td>
                    <td style={{ ...COMMON_TD, textAlign: 'right', fontFamily: 'var(--mono)' }}>{s.active_days_30d}</td>
                    <td style={{ ...COMMON_TD, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 500 }}>{Number(s.hours_30d).toFixed(1)}h</td>
                    <td style={{ ...COMMON_TD, textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{Number(s.hours_ytd).toFixed(0)}h</td>
                    <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
                      {s.last_in ? new Date(s.last_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>

      {/* Recent activity — ALL clock events, mapped + unmapped, last 7d */}
      <details open style={{ marginTop: 16 }}>
        <summary style={HEADER_TITLE}>
          ▾ Recent clock activity · last 7 days · {recent.length} events
          {' '}
          <span style={{ textTransform: 'none', letterSpacing: 'normal', color: 'var(--oxblood-soft)' }}>
            ({recent.filter(r => !r.staff_id).length} unprofiled — red rows need follow-up)
          </span>
        </summary>
        <div style={{ ...WRAPPER, marginTop: 10, maxHeight: 480, overflowY: 'auto' }}>
          {recent.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
              No clock events in the last 7 days.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 1 }}>
                <tr>
                  <th style={COMMON_TH}>Date</th>
                  <th style={COMMON_TH}>Name</th>
                  <th style={COMMON_TH}>Department</th>
                  <th style={COMMON_TH}>Clock in</th>
                  <th style={COMMON_TH}>Clock out</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Hours</th>
                  <th style={COMMON_TH}>Method</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => {
                  const clickable = !!r.staff_id;
                  const unmappedFlag = !r.staff_id;
                  const rowBg = unmappedFlag ? 'rgba(178,60,42,0.10)' : undefined;
                  const stillOn = !r.clock_out_at;
                  return (
                    <tr key={i}
                        onClick={() => clickable && setSelectedStaffId(r.staff_id)}
                        style={{ cursor: clickable ? 'pointer' : 'default', background: rowBg }}>
                      <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
                        {new Date(r.clock_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ ...COMMON_TD, fontWeight: 500 }}>
                        {r.full_name ?? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={NO_PROFILE_BADGE}>NO PROFILE</span>
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--oxblood-soft)' }}>#{r.external_employee_id}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ ...COMMON_TD, color: unmappedFlag ? 'var(--oxblood-soft)' : 'var(--ink-soft)' }}>
                        {r.dept_name ?? (unmappedFlag ? '— follow up' : '—')}
                      </td>
                      <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtClock(r.clock_in_at)}</td>
                      <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 12, color: stillOn ? 'var(--st-good, #2c7a4b)' : 'var(--ink-soft)' }}>
                        {r.clock_out_at ? fmtClock(r.clock_out_at) : 'on shift'}
                      </td>
                      <td style={{ ...COMMON_TD, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {r.hours != null ? `${Number(r.hours).toFixed(1)}h` : '—'}
                      </td>
                      <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {r.method ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </details>

      {/* Messy data */}
      <details style={{ marginTop: 16 }}>
        <summary style={HEADER_TITLE}>
          ▾ Messy data · {unmapped.length} unmapped employees{' '}
          <span style={{ textTransform: 'none', letterSpacing: 'normal', color: 'var(--ink-mute)' }}>
            (clock in, no staff profile — likely F&B / Kitchen / contractors)
          </span>
        </summary>
        <div style={{ ...WRAPPER, marginTop: 10 }}>
          {unmapped.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
              Everyone who clocks in has a profile.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={COMMON_TH}>External ID</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Events · all</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Events · 30d</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Events · 7d</th>
                  <th style={{ ...COMMON_TH, textAlign: 'right' }}>Days active</th>
                  <th style={COMMON_TH}>First seen</th>
                  <th style={COMMON_TH}>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {unmapped.map((r) => (
                  <tr key={r.ext_id}>
                    <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontWeight: 500 }}>{r.ext_id}</td>
                    <td style={{ ...COMMON_TD, textAlign: 'right', fontFamily: 'var(--mono)' }}>{r.clock_events}</td>
                    <td style={{ ...COMMON_TD, textAlign: 'right', fontFamily: 'var(--mono)' }}>{r.events_30d}</td>
                    <td style={{ ...COMMON_TD, textAlign: 'right', fontFamily: 'var(--mono)', color: r.events_7d > 0 ? 'var(--st-good, #2c7a4b)' : 'var(--ink-mute)' }}>{r.events_7d}</td>
                    <td style={{ ...COMMON_TD, textAlign: 'right', fontFamily: 'var(--mono)' }}>{r.days_active}</td>
                    <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>{r.first_seen}</td>
                    <td style={{ ...COMMON_TD, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>{r.last_seen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>

      <StaffDrawer staffId={selectedStaffId} onClose={handleClose} />
    </>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--st-good, #2c7a4b)' : score >= 50 ? 'var(--brass)' : 'var(--oxblood-soft)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      <span style={{
        width: 48, height: 6, borderRadius: 3, background: 'var(--paper-deep)', overflow: 'hidden', display: 'inline-block', position: 'relative',
      }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${score}%`, background: color }} />
      </span>
      <span style={{ color, minWidth: 30, textAlign: 'right' }}>{score}</span>
    </span>
  );
}
