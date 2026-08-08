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
            <option value="low">low</option><option value="medium">medium</option>
            <option value="high">high</option><option value="critical">critical</option>
          </select>
          <button type="button" onClick={submit} disabled={busy || text.trim().length < 5}
            style={{ ...btn, background: TOKENS.ink, color: '#FFF', opacity: busy || text.trim().length < 5 ? 0.5 : 1 }}>
            {busy ? 'Filing…' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── ACK/RESOLVE modal ──────────────────────────────────────────────────────
function AckModal({ ev, mode, onClose }: {
  ev: OpenAlarmRow; mode: 'ack' | 'resolve'; onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (note.trim().length < 3 || isPending) return;
    startTransition(async () => {
      try {
        if (mode === 'ack') await ackAlarm(ev.id, note.trim());
        else await resolveAlarm(ev.id, note.trim());
        router.refresh();
        onClose();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Action failed');
      }
    });
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`,
        borderRadius: 8, padding: 20,
      }}>
        <h3 style={{ fontFamily: SERIF, fontSize: 18, margin: '0 0 12px', color: TOKENS.ink }}>
          {mode === 'ack' ? 'Acknowledge' : 'Resolve'}: {ev.alarm_code}
        </h3>
        <p style={{ fontSize: 12.5, color: TOKENS.text2, margin: '0 0 12px' }}>{ev.title}</p>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={4} autoFocus
          placeholder={mode === 'ack' ? 'Why acknowledged (mandatory note)' : 'Why resolved (mandatory note)'}
          style={{
            width: '100%', fontSize: 12.5, padding: 8, marginBottom: 12, resize: 'vertical',
            border: `1px solid ${TOKENS.border}`, borderRadius: 6, fontFamily: TOKENS.sans,
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btn}>Cancel</button>
          <button type="button" onClick={submit} disabled={note.trim().length < 3 || isPending}
            style={{ ...btn, background: TOKENS.ink, color: '#FFF', opacity: note.trim().length < 3 || isPending ? 0.5 : 1 }}>
            {isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ALARMS CLIENT COMPONENT ────────────────────────────────────────────────
export function AlarmsClient({ open, watchdogs, events, noise, loadError }: {
  open: OpenAlarmRow[]; watchdogs: WatchdogRow[]; events: Event7dRow[];
  noise: NoiseRow[]; loadError: string | null;
}) {
  const [modal, setModal] = useState<{ ev: OpenAlarmRow; mode: 'ack' | 'resolve' } | null>(null);
  const [srcFilter, setSrcFilter] = useState('all');
  const [sevFilter, setSevFilter] = useState('all');

  const reds = open.filter((o) => o.severity === 'red');
  const ambers = open.filter((o) => o.severity !== 'red');
  const lastSweep = watchdogs.reduce<string | null>(
    (acc, w) => (w.last_run_at && (!acc || w.last_run_at > acc) ? w.last_run_at : acc), null);

  const sources = useMemo(() => Array.from(new Set(events.map((e) => e.source))).sort(), [events]);
  const filteredEvents = events.filter((e) =>
    (srcFilter === 'all' || e.source === srcFilter) &&
    (sevFilter === 'all' || e.severity === sevFilter));

  const wdColor = (s: string): string =>
    s === 'ok' ? GREEN : s === 'disabled' ? TOKENS.text3 : RED;

  return (
    <div style={{ padding: 24, color: TOKENS.text, background: TOKENS.bg, minHeight: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, margin: 0, color: TOKENS.ink, fontWeight: 500 }}>
          Alarms
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
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: SERIF, fontSize: 20, color: GREEN, fontWeight: 500 }}>
              ✓ All systems reporting
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>
              zero red alarms open · last sweep {lastSweep ? fmtTs(lastSweep) : '—'}
            </span>
          </div>
        ) : (
          <>
            <SectionTitle>🔴 {reds.length} RED alarm{reds.length > 1 ? 's' : ''} open</SectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={hdr}>Code</th><th style={hdr}>Title</th><th style={hdr}>Source</th>
                <th style={hdr}>Fired</th><th style={hdr}>Item</th><th style={hdr}>Actions</th>
              </tr></thead>
              <tbody>
                {reds.map((r) => (
                  <tr key={r.id}>
                    <td style={cell}>{r.alarm_code}</td>
                    <td style={cell}>{r.title}</td>
                    <td style={cell}>{r.source}</td>
                    <td style={{ ...cell, fontFamily: MONO }}>{fmtTs(r.fired_at)}</td>
                    <td style={{ ...cell, fontSize: 11, color: TOKENS.text2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.item_key ?? '—'}
                    </td>
                    <td style={{ ...cell, display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => setModal({ ev: r, mode: 'ack' })}
                        style={{ ...btn, fontSize: 10.5 }}>
                        Ack
                      </button>
                      <button type="button" onClick={() => setModal({ ev: r, mode: 'resolve' })}
                        style={{ ...btn, fontSize: 10.5 }}>
                        Resolve
                      </button>
                      {r.deep_link && (
                        <a href={r.deep_link} style={{ ...btn, fontSize: 10.5, textDecoration: 'none' }}>↗ Go</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* AMBER strip (only if present) */}
      {ambers.length > 0 && (
        <section style={{
          ...card, marginBottom: 14, borderLeft: `4px solid ${AMBER}`, background: '#FFF9F0',
        }}>
          <SectionTitle>🟠 {ambers.length} AMBER alarm{ambers.length > 1 ? 's' : ''}</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={hdr}>Code</th><th style={hdr}>Title</th><th style={hdr}>Source</th>
              <th style={hdr}>Fired</th><th style={hdr}>Item</th><th style={hdr}>Actions</th>
            </tr></thead>
            <tbody>
              {ambers.map((a) => (
                <tr key={a.id}>
                  <td style={cell}>{a.alarm_code}</td>
                  <td style={cell}>{a.title}</td>
                  <td style={cell}>{a.source}</td>
                  <td style={{ ...cell, fontFamily: MONO }}>{fmtTs(a.fired_at)}</td>
                  <td style={{ ...cell, fontSize: 11, color: TOKENS.text2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.item_key ?? '—'}
                  </td>
                  <td style={{ ...cell, display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => setModal({ ev: a, mode: 'ack' })}
                      style={{ ...btn, fontSize: 10.5 }}>
                      Ack
                    </button>
                    <button type="button" onClick={() => setModal({ ev: a, mode: 'resolve' })}
                      style={{ ...btn, fontSize: 10.5 }}>
                      Resolve
                    </button>
                    {a.deep_link && (
                      <a href={a.deep_link} style={{ ...btn, fontSize: 10.5, textDecoration: 'none' }}>↗ Go</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 2 ── WATCHDOG HEALTH */}
      <section style={{ ...card, marginBottom: 14 }}>
        <SectionTitle>Watchdog health</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={hdr}>Code</th><th style={hdr}>Title</th><th style={hdr}>Source</th>
            <th style={hdr}>Cadence</th><th style={hdr}>Last OK</th><th style={hdr}>Status</th>
            <th style={hdr}>Active</th><th style={hdr}>Link</th>
          </tr></thead>
          <tbody>
            {watchdogs.map((w) => (
              <tr key={w.alarm_code} style={{ background: w.watchdog_status === 'ok' ? 'transparent' : '#FFF8F8' }}>
                <td style={cell}>{w.alarm_code}</td>
                <td style={cell}>{w.title}</td>
                <td style={cell}>{w.source}</td>
                <td style={{ ...cell, fontFamily: MONO }}>{w.cadence_minutes}m</td>
                <td style={{ ...cell, fontFamily: MONO }}>{fmtTs(w.last_ok_at)}</td>
                <td style={{ ...cell, color: wdColor(w.watchdog_status), fontWeight: 600, fontSize: 11 }}>
                  {w.watchdog_status}
                  {w.last_error && <span style={{ fontSize: 10, color: TOKENS.text3, display: 'block' }}>{w.last_error}</span>}
                </td>
                <td style={cell}>{w.active ? 'yes' : 'no'}</td>
                <td style={cell}>
                  {w.deep_link && <a href={w.deep_link} style={{ fontSize: 11, color: TOKENS.link }}>↗</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 3 ── 7-DAY LOG */}
      <section style={{ ...card, marginBottom: 14 }}>
        <SectionTitle right={
          <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
            <select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)}
              style={{ fontSize: 11, padding: '2px 6px', border: `1px solid ${TOKENS.border}`, borderRadius: 4 }}>
              <option value="all">All sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}
              style={{ fontSize: 11, padding: '2px 6px', border: `1px solid ${TOKENS.border}`, borderRadius: 4 }}>
              <option value="all">All severities</option>
              <option value="red">red</option>
              <option value="amber">amber</option>
            </select>
          </div>
        }>
          7-day log ({filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''})
        </SectionTitle>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#FAFAF7', zIndex: 5 }}>
              <tr>
                <th style={hdr}>Code</th><th style={hdr}>Sev</th><th style={hdr}>Source</th>
                <th style={hdr}>Fired</th><th style={hdr}>Status</th><th style={hdr}>Ack/Resolved</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((e) => (
                <tr key={e.id} style={{
                  background: e.unack_over_24h ? '#FFFBF0' : e.severity === 'red' ? '#FFF8F8' : 'transparent',
                }}>
                  <td style={cell}>{e.alarm_code}</td>
                  <td style={{ ...cell, color: sevColor(e.severity), fontWeight: 600 }}>{e.severity}</td>
                  <td style={cell}>{e.source}</td>
                  <td style={{ ...cell, fontFamily: MONO }}>{fmtTs(e.fired_at)}</td>
                  <td style={cell}>{e.status}</td>
                  <td style={{ ...cell, fontSize: 11, color: TOKENS.text2 }}>
                    {e.resolved_at ? `✓ ${fmtTs(e.resolved_at)}` : e.ack_at ? `ack ${fmtTs(e.ack_at)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4 ── NOISE CONTROL */}
      <section style={{ ...card }}>
        <SectionTitle>Noise control — top 20 by 7d fires</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={hdr}>Code</th><th style={hdr}>Title</th><th style={hdr}>Source</th>
            <th style={hdr}>Fires 7d</th><th style={hdr}>Fires 24h</th><th style={hdr}>Last</th>
            <th style={hdr}>Cadence</th><th style={hdr}>Active</th>
          </tr></thead>
          <tbody>
            {noise.slice(0, 20).map((n) => (
              <tr key={n.alarm_code}>
                <td style={cell}>{n.alarm_code}</td>
                <td style={cell}>{n.title}</td>
                <td style={cell}>{n.source}</td>
                <td style={{ ...cell, fontWeight: 600, color: n.fires_7d > 50 ? RED : TOKENS.text }}>{n.fires_7d}</td>
                <td style={{ ...cell, fontWeight: 600, color: n.fires_24h > 10 ? RED : TOKENS.text }}>{n.fires_24h}</td>
                <td style={{ ...cell, fontFamily: MONO }}>{fmtTs(n.last_fired_at)}</td>
                <td style={cell}>{n.cadence_minutes}m</td>
                <td style={cell}>{n.active ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modal && <AckModal ev={modal.ev} mode={modal.mode} onClose={() => setModal(null)} />}
    </div>
  );
}
