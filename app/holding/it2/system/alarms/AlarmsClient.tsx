'use client';
// app/holding/it2/system/alarms/AlarmsClient.tsx
// alarm-system-v1 slice 2 — Watchdog Cockpit. Four brief containers:
//   1. NOW STRIP        — open red alarms · ack CTA (mandatory note) · deep links
//                         empty state = positive green "all systems reporting"
//   2. WATCHDOG HEALTH  — v_alarms_watchdog_health · silent/never_reported = RED
//   3. 7-DAY LOG        — v_alarms_events_7d · source/severity filters ·
//                         unacknowledged >24h highlighted
//   4. NOISE CONTROL    — fires per definition · PBS tunes active/cadence
// + Findings button (law 729 — standard owner channel, module alarm_system).
// + action-light-surface-v1: ActionLight component at top of page.

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { TOKENS, SERIF, MONO } from '@/components/cockpit/tokens';
import { ActionLight } from '@/components/system/ActionLight';
import { ackAlarm, resolveAlarm, setAlarmDef } from './actions';

// ── row types (mirror public.v_alarms_* bridges) ───────────────────────────
export interface OpenAlarmRow {
  id: number; alarm_code: string; title: string; source: string;
  severity: string; status: string; item_key: string | null; detail: string | null;
  fired_at: string; last_seen_at: string | null;
  ack_by: string | null; ack_note: string | null; ack_at: string | null;
  deep_link: string | null;
}
export interface WatchdogRow {
  alarm_code: string; title: string; severity: string; source: string;
  cadence_minutes: number; active: boolean; deep_link: string | null;
  last_run_at: string | null; last_ok_at: string | null; last_error: string | null;
  watchdog_status: string; // ok | silent | never_reported | disabled
}
export interface Event7dRow {
  id: number; alarm_code: string; title: string; source: string;
  severity: string; status: string; item_key: string | null; detail: string | null;
  fired_at: string; last_seen_at: string | null;
  ack_by: string | null; ack_note: string | null; ack_at: string | null;
  resolved_at: string | null; unack_over_24h: boolean;
}
export interface NoiseRow {
  alarm_code: string; title: string; severity: string; source: string;
  cadence_minutes: number; active: boolean;
  fires_7d: number; fires_24h: number; last_fired_at: string | null;
}

// ── shared styles ──────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`,
  borderRadius: 2, padding: '14px 16px',
};
const cell: React.CSSProperties = {
  padding: '6px 10px', borderBottom: `1px solid ${TOKENS.border}`, fontSize: 12.5,
};
const hdr: React.CSSProperties = {
  ...cell, textAlign: 'left', fontWeight: 600, fontSize: 11, color: TOKENS.inkSoft,
  background: '#FAFAF7', whiteSpace: 'nowrap',
};
const btn: React.CSSProperties = {
  fontSize: 11.5, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
  border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, color: TOKENS.ink,
};
const RED = '#C62828';
const AMBER = '#B8542A';
const GREEN = '#2E7D32';
const sevColor = (s: string): string => (s === 'red' ? RED : s === 'amber' ? AMBER : TOKENS.inkSoft);
const fmtTs = (t: string | null): string => (t ? t.replace('T', ' ').slice(0, 16) + 'Z' : '—');

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
      <h2 style={{ fontFamily: SERIF, fontSize: 17, margin: 0, color: TOKENS.ink, fontWeight: 500 }}>
        {children}
      </h2>
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </header>
  );
}

// ── findings button (law 729 — standard owner channel) ─────────────────────
function FindingButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    if (text.trim().length < 5 || busy) return;
    setBusy(true); setDone(null);
    try {
      const fd = new FormData();
      fd.set('module', 'alarm_system');
      fd.set('finding', text.trim());
      fd.set('severity', severity);
      const res = await fetch('/api/holding/module-findings', { method: 'POST', body: fd });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDone('Filed. It blocks module completion until resolved.');
      setText(''); setOpen(false);
    } catch (e) {
      setDone(e instanceof Error ? e.message : 'Failed to file finding');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      {done && <span style={{ fontSize: 11, color: TOKENS.inkSoft }}>{done}</span>}
      <button type="button" style={btn} onClick={() => setOpen((v) => !v)}>
        {open ? 'Cancel' : 'Report finding'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 32, right: 0, zIndex: 30, width: 320, padding: 12,
          background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} rows={4}
            placeholder="What is wrong on this page?"
            style={{ fontSize: 12.5, padding: 8, border: `1px solid ${TOKENS.border}`, borderRadius: 6, resize: 'vertical' }}
          />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}
            style={{ fontSize: 12, padding: 6, border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
            <option value="low">Low (cosmetic)</option>
            <option value="medium">Medium (wrong data/link)</option>
            <option value="high">High (broken/misleading)</option>
          </select>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setOpen(false)} style={btn}>Cancel</button>
            <button
              type="button" onClick={submit} disabled={busy || text.trim().length < 5}
              style={{ ...btn, background: TOKENS.forest, color: '#fff', opacity: (busy || text.trim().length < 5) ? 0.5 : 1 }}
            >
              {busy ? 'Filing…' : 'File finding'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ack modal ──────────────────────────────────────────────────────────────
function AckModal({
  alarm, onClose, onConfirm,
}: {
  alarm: OpenAlarmRow; onClose: () => void; onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!note.trim() || busy) return;
    setBusy(true);
    try { await onConfirm(note.trim()); onClose(); } catch { /* handled in parent */ } finally { setBusy(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 999,
    }}>
      <div style={{
        background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
        padding: 20, maxWidth: 560, width: '100%', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}>
        <h3 style={{ fontFamily: SERIF, fontSize: 15, margin: '0 0 10px', fontWeight: 500 }}>
          Acknowledge alarm
        </h3>
        <p style={{ fontSize: 12.5, color: TOKENS.inkSoft, margin: '0 0 12px' }}>
          {alarm.title}
        </p>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Why acknowledging (mandatory)?"
          style={{
            width: '100%', fontSize: 12.5, padding: 8, marginBottom: 12, resize: 'vertical',
            border: `1px solid ${TOKENS.border}`, borderRadius: 6, fontFamily: 'system-ui, sans-serif',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btn}>Cancel</button>
          <button
            type="button" onClick={go} disabled={!note.trim() || busy}
            style={{ ...btn, background: TOKENS.forest, color: '#fff', opacity: (!note.trim() || busy) ? 0.5 : 1 }}
          >
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export function AlarmsClient({
  open, watchdogs, events, noise, loadError,
}: {
  open: OpenAlarmRow[];
  watchdogs: WatchdogRow[];
  events: Event7dRow[];
  noise: NoiseRow[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ackTarget, setAckTarget] = useState<OpenAlarmRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // ── partitions ─────────────────────────────────────────────────────────
  const reds = open.filter((a) => a.severity === 'red');
  const ambers = open.filter((a) => a.severity === 'amber');
  const silentWds = watchdogs.filter((w) => w.watchdog_status === 'silent' || w.watchdog_status === 'never_reported');

  // ── 7-day event filters ────────────────────────────────────────────────
  const [srcFilter, setSrcFilter] = useState('all');
  const [sevFilter, setSevFilter] = useState('all');
  const filteredEvents = useMemo(() => {
    let arr = events;
    if (srcFilter !== 'all') arr = arr.filter((e) => e.source === srcFilter);
    if (sevFilter !== 'all') arr = arr.filter((e) => e.severity === sevFilter);
    return arr;
  }, [events, srcFilter, sevFilter]);
  const sources = useMemo(() => Array.from(new Set(events.map((e) => e.source))).sort(), [events]);

  // ── actions ────────────────────────────────────────────────────────────
  async function doAck(alarm: OpenAlarmRow, note: string) {
    startTransition(async () => {
      try {
        await ackAlarm(alarm.id, note);
        setMsg(`Acknowledged #${alarm.id}`);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Ack failed');
      }
    });
  }
  async function doResolve(id: number) {
    const note = prompt('Resolution note (required · min 5 chars):');
    if (!note || note.trim().length < 5) return;
    if (!confirm('Mark resolved? (Soft-delete; 7d log retains it)')) return;
    startTransition(async () => {
      try {
        await resolveAlarm(id, note.trim());
        setMsg(`Resolved #${id}`);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Resolve failed');
      }
    });
  }
  async function doToggleActive(code: string, active: boolean) {
    if (!confirm(active ? `Disable watchdog ${code}?` : `Enable watchdog ${code}?`)) return;
    startTransition(async () => {
      try {
        await setAlarmDef(code, !active, null);
        setMsg(`Toggled ${code}`);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Toggle failed');
      }
    });
  }

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 16px', background: TOKENS.bg }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 14 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, margin: 0, fontWeight: 500, color: TOKENS.ink }}>
          Alarms · IT
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, margin: 0 }}>
          watchdog cockpit · sweep every 15min · silence itself is an alert
        </p>
        <div style={{ marginLeft: 'auto' }}><FindingButton /></div>
      </header>
      <ActionLight />


      {loadError && (
        <div style={{ ...card, borderLeft: `3px solid ${RED}`, marginBottom: 14, color: RED, fontSize: 12.5 }}>
          Load error: {loadError}
        </div>
      )}

      {/* 1 ── NOW STRIP */}
      <section style={{
        ...card, marginBottom: 14,
        borderLeft: `4px solid ${reds.length > 0 ? RED : GREEN}`,
        background: reds.length > 0 ? '#FFF8F8' : '#F4FAF4',
      }}>
        {reds.length === 0 ? (
          <div>
            <SectionTitle>All systems reporting</SectionTitle>
            <p style={{ fontSize: 13, color: GREEN, margin: 0 }}>
              No red alarms open. {ambers.length > 0 ? `${ambers.length} amber(s) are fine.` : 'Zero amber too.'}
            </p>
          </div>
        ) : (
          <div>
            <SectionTitle>{reds.length} RED alarm{reds.length === 1 ? '' : 's'} open</SectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={hdr}>Alarm</th>
                  <th style={hdr}>Status</th>
                  <th style={hdr}>Fired</th>
                  <th style={hdr}>Detail</th>
                  <th style={hdr} />
                </tr>
              </thead>
              <tbody>
                {reds.map((a) => (
                  <tr key={a.id}>
                    <td style={cell}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: RED }}>{a.title}</div>
                      <div style={{ fontSize: 10.5, color: TOKENS.inkSoft, fontFamily: MONO }}>{a.alarm_code}</div>
                    </td>
                    <td style={cell}>
                      {a.status === 'ack' && a.ack_by ? (
                        <div>
                          <div style={{ fontSize: 11.5, color: AMBER }}>ACK by {a.ack_by}</div>
                          <div style={{ fontSize: 10, color: TOKENS.inkSoft }}>{a.ack_note}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11.5, color: RED }}>OPEN</span>
                      )}
                    </td>
                    <td style={cell}>
                      <div style={{ fontSize: 11.5 }}>{fmtTs(a.fired_at)}</div>
                      {a.last_seen_at && (
                        <div style={{ fontSize: 10, color: TOKENS.inkSoft }}>last {fmtTs(a.last_seen_at)}</div>
                      )}
                    </td>
                    <td style={cell}>
                      <span style={{ fontSize: 11.5 }}>{a.detail ?? '—'}</span>
                      {a.deep_link && (
                        <a href={a.deep_link} style={{ fontSize: 11, color: TOKENS.forest, marginLeft: 8 }}>↗</a>
                      )}
                    </td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => setAckTarget(a)} style={{ ...btn, marginRight: 6 }}>Ack</button>
                      <button type="button" onClick={() => doResolve(a.id)} style={btn}>Resolve</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2 ── WATCHDOG HEALTH */}
      <section style={{ ...card, marginBottom: 14 }}>
        <SectionTitle>Watchdog health ({watchdogs.length})</SectionTitle>
        {silentWds.length > 0 && (
          <div style={{
            padding: 10, marginBottom: 12, background: '#FFF8F8',
            border: `1px solid ${RED}`, borderRadius: 6,
          }}>
            <strong style={{ fontSize: 12.5, color: RED }}>
              {silentWds.length} silent watchdog{silentWds.length === 1 ? '' : 's'}
            </strong>
            <ul style={{ margin: '6px 0 0 20px', padding: 0, fontSize: 11.5 }}>
              {silentWds.map((w) => <li key={w.alarm_code}>{w.title} ({w.watchdog_status})</li>)}
            </ul>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={hdr}>Alarm</th>
              <th style={hdr}>Status</th>
              <th style={hdr}>Last run</th>
              <th style={hdr}>Last OK</th>
              <th style={hdr}>Cadence</th>
              <th style={hdr}>Active</th>
              <th style={hdr} />
            </tr>
          </thead>
          <tbody>
            {watchdogs.map((w) => {
              const statusColor = w.watchdog_status === 'ok' ? GREEN
                : w.watchdog_status === 'disabled' ? TOKENS.inkSoft : RED;
              return (
                <tr key={w.alarm_code}>
                  <td style={cell}>
                    <div style={{ fontWeight: 500 }}>{w.title}</div>
                    <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: MONO }}>{w.alarm_code}</div>
                  </td>
                  <td style={{ ...cell, color: statusColor }}>{w.watchdog_status}</td>
                  <td style={cell}>{fmtTs(w.last_run_at)}</td>
                  <td style={cell}>{fmtTs(w.last_ok_at)}</td>
                  <td style={cell}>{w.cadence_minutes}min</td>
                  <td style={cell}>{w.active ? 'yes' : 'no'}</td>
                  <td style={cell}>
                    {w.deep_link && <a href={w.deep_link} style={{ fontSize: 11, color: TOKENS.forest }}>↗</a>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 3 ── 7-DAY LOG */}
      <section style={{ ...card, marginBottom: 14 }}>
        <SectionTitle
          right={
            <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
              <select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)}
                style={{ fontSize: 11, padding: 4, border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
                <option value="all">All sources</option>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}
                style={{ fontSize: 11, padding: 4, border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
                <option value="all">All severities</option>
                <option value="red">Red</option>
                <option value="amber">Amber</option>
              </select>
            </div>
          }
        >
          Event log (7 days · {filteredEvents.length}/{events.length})
        </SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={hdr}>ID</th>
              <th style={hdr}>Alarm</th>
              <th style={hdr}>Severity</th>
              <th style={hdr}>Fired</th>
              <th style={hdr}>Status</th>
              <th style={hdr}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((e) => {
              const rowBg = e.unack_over_24h ? '#FFF8F8' : 'transparent';
              return (
                <tr key={e.id} style={{ background: rowBg }}>
                  <td style={cell}>{e.id}</td>
                  <td style={cell}>
                    <div style={{ fontWeight: 500 }}>{e.title}</div>
                    <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: MONO }}>{e.alarm_code}</div>
                  </td>
                  <td style={{ ...cell, color: sevColor(e.severity) }}>{e.severity}</td>
                  <td style={cell}>{fmtTs(e.fired_at)}</td>
                  <td style={cell}>
                    {e.resolved_at ? <span style={{ color: GREEN }}>resolved</span>
                      : e.ack_by ? <span style={{ color: AMBER }}>ack ({e.ack_by})</span>
                      : <span style={{ color: RED }}>open</span>}
                  </td>
                  <td style={cell}>{e.detail ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 4 ── NOISE CONTROL */}
      <section style={{ ...card }}>
        <SectionTitle>Noise control ({noise.length} definitions)</SectionTitle>
        <p style={{ fontSize: 12.5, color: TOKENS.inkSoft, marginBottom: 12 }}>
          Alarm definitions with &gt;10 fires in 7d. Tune active/cadence to reduce spam.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={hdr}>Alarm</th>
              <th style={hdr}>7d fires</th>
              <th style={hdr}>24h fires</th>
              <th style={hdr}>Last fired</th>
              <th style={hdr}>Cadence</th>
              <th style={hdr}>Active</th>
              <th style={hdr} />
            </tr>
          </thead>
          <tbody>
            {noise.map((n) => (
              <tr key={n.alarm_code}>
                <td style={cell}>
                  <div style={{ fontWeight: 500 }}>{n.title}</div>
                  <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: MONO }}>{n.alarm_code}</div>
                </td>
                <td style={cell}>{n.fires_7d}</td>
                <td style={cell}>{n.fires_24h}</td>
                <td style={cell}>{fmtTs(n.last_fired_at)}</td>
                <td style={cell}>{n.cadence_minutes}min</td>
                <td style={cell}>{n.active ? 'yes' : 'no'}</td>
                <td style={cell}>
                  <button type="button" onClick={() => doToggleActive(n.alarm_code, n.active)} style={btn}>
                    {n.active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {msg && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, background: TOKENS.bgRaised,
          border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: 12,
          fontSize: 12.5, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {msg}
        </div>
      )}

      {ackTarget && (
        <AckModal alarm={ackTarget} onClose={() => setAckTarget(null)} onConfirm={(note) => doAck(ackTarget, note)} />
      )}
    </div>
  );
}
