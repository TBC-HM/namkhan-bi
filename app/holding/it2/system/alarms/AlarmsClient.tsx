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

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { TOKENS, SERIF, MONO } from '@/components/cockpit/tokens';
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
          <button type="button" style={{ ...btn, background: TOKENS.forest, color: '#fff' }} onClick={submit} disabled={busy}>
            {busy ? 'Filing…' : 'File finding'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── ack / resolve modal (mandatory note per brief) ─────────────────────────
function AckModal({ ev, mode, onClose }: { ev: OpenAlarmRow; mode: 'ack' | 'resolve'; onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setErr(null);
    startTransition(async () => {
      const r = mode === 'ack' ? await ackAlarm(ev.id, note) : await resolveAlarm(ev.id, note);
      if (!r.ok) { setErr(r.error ?? 'failed'); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(27,27,27,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: 440, maxWidth: '92vw', background: TOKENS.bgRaised, borderRadius: 10,
        border: `1px solid ${TOKENS.border}`, padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TOKENS.ink }}>
          {mode === 'ack' ? 'Acknowledge' : 'Resolve'} alarm #{ev.id}
        </div>
        <div style={{ fontSize: 11.5, fontFamily: MONO, color: TOKENS.inkSoft }}>
          {ev.alarm_code} · {ev.item_key ?? '—'}
        </div>
        <div style={{ fontSize: 12, color: TOKENS.ink }}>{ev.detail ?? ev.title}</div>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder={mode === 'ack'
            ? 'Mandatory: what did you see, what happens next? (min 5 chars)'
            : 'Mandatory: what fixed it? (min 5 chars)'}
          style={{ fontSize: 12.5, padding: 8, border: `1px solid ${TOKENS.border}`, borderRadius: 6, resize: 'vertical' }}
        />
        {err && <div style={{ fontSize: 12, color: RED }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={btn} onClick={onClose}>Cancel</button>
          <button
            type="button"
            style={{ ...btn, background: TOKENS.forest, color: '#fff', opacity: note.trim().length < 5 || isPending ? 0.6 : 1 }}
            onClick={submit} disabled={note.trim().length < 5 || isPending}
          >
            {isPending ? 'Saving…' : mode === 'ack' ? 'Acknowledge' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── container 4 row editor ─────────────────────────────────────────────────
function NoiseRowCtl({ row }: { row: NoiseRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggleActive() {
    setErr(null);
    startTransition(async () => {
      const r = await setAlarmDef(row.alarm_code, !row.active, null);
      if (!r.ok) { setErr(r.error ?? 'failed'); return; }
      router.refresh();
    });
  }
  function changeCadence(v: string) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return;
    setErr(null);
    startTransition(async () => {
      const r = await setAlarmDef(row.alarm_code, null, n);
      if (!r.ok) { setErr(r.error ?? 'failed'); return; }
      router.refresh();
    });
  }

  return (
    <>
      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
        <select
          defaultValue={String(row.cadence_minutes)}
          onChange={(e) => changeCadence(e.target.value)}
          disabled={isPending}
          style={{ fontSize: 11.5, padding: '3px 6px', border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}
        >
          {[15, 30, 60, 120, 360, 720, 1440].map((m) => (
            <option key={m} value={m}>{m >= 60 ? `${m / 60}h` : `${m}min`}</option>
          ))}
        </select>
      </td>
      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
        <button type="button" style={{
          ...btn,
          background: row.active ? TOKENS.forest : TOKENS.bgRaised,
          color: row.active ? '#fff' : TOKENS.inkSoft,
          opacity: isPending ? 0.6 : 1,
        }} onClick={toggleActive} disabled={isPending}>
          {row.active ? 'active' : 'off'}
        </button>
        {err && <span style={{ fontSize: 10.5, color: RED, marginLeft: 6 }}>{err}</span>}
      </td>
    </>
  );
}

// ── main client ────────────────────────────────────────────────────────────
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
              last sweep {fmtTs(lastSweep)} · {watchdogs.filter((w) => w.active).length} watchdogs live
              {ambers.length > 0 && ` · ${ambers.length} amber open below`}
            </span>
          </div>
        ) : (
          <>
            <SectionTitle right={<span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>last sweep {fmtTs(lastSweep)}</span>}>
              <span style={{ color: RED }}>{reds.length} red {reds.length === 1 ? 'alarm' : 'alarms'} open</span>
            </SectionTitle>
            <div style={{ display: 'grid', gap: 8 }}>
              {reds.map((ev) => (
                <div key={ev.id} style={{
                  display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center',
                  background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 6, padding: '8px 12px',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: RED, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {ev.status === 'acknowledged' ? 'red · acked' : 'red'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>{ev.title}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
                        {ev.alarm_code}{ev.item_key ? ` · ${ev.item_key}` : ''} · fired {fmtTs(ev.fired_at)}
                      </span>
                    </div>
                    {ev.detail && (
                      <div style={{ fontSize: 12, color: TOKENS.text2, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.detail}
                      </div>
                    )}
                    {ev.ack_note && (
                      <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2, fontStyle: 'italic' }}>
                        ack {ev.ack_by} {fmtTs(ev.ack_at)}: {ev.ack_note}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {ev.deep_link && (
                      <a href={ev.deep_link} style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>Open →</a>
                    )}
                    {ev.status !== 'acknowledged' ? (
                      <button type="button" style={{ ...btn, background: TOKENS.forest, color: '#fff' }}
                        onClick={() => setModal({ ev, mode: 'ack' })}>Acknowledge</button>
                    ) : (
                      <button type="button" style={btn} onClick={() => setModal({ ev, mode: 'resolve' })}>Resolve</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* amber open (same pipe, below the strip) */}
      {ambers.length > 0 && (
        <section style={{ ...card, marginBottom: 14, borderLeft: `3px solid ${AMBER}` }}>
          <SectionTitle>{ambers.length} amber open</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={hdr}>alarm</th><th style={hdr}>item</th><th style={hdr}>fired</th><th style={hdr}></th>
            </tr></thead>
            <tbody>
              {ambers.map((ev) => (
                <tr key={ev.id}>
                  <td style={cell}>
                    <span style={{ fontWeight: 600 }}>{ev.title}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginLeft: 8 }}>{ev.alarm_code}</span>
                  </td>
                  <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{ev.item_key ?? '—'}</td>
                  <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtTs(ev.fired_at)}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {ev.deep_link && <a href={ev.deep_link} style={{ ...btn, textDecoration: 'none', marginRight: 6 }}>Open →</a>}
                    {ev.status !== 'acknowledged'
                      ? <button type="button" style={btn} onClick={() => setModal({ ev, mode: 'ack' })}>Acknowledge</button>
                      : <button type="button" style={btn} onClick={() => setModal({ ev, mode: 'resolve' })}>Resolve</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 2 ── WATCHDOG HEALTH */}
      <section style={{ ...card, marginBottom: 14 }}>
        <SectionTitle right={
          <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>
            a watchdog silent &gt;2 cycles is RED regardless of its target
          </span>
        }>
          Watchdog health
        </SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={hdr}>status</th><th style={hdr}>definition</th><th style={hdr}>source</th>
            <th style={hdr}>cadence</th><th style={hdr}>last OK</th><th style={hdr}>last error</th>
          </tr></thead>
          <tbody>
            {watchdogs.map((w) => (
              <tr key={w.alarm_code} style={{ background: w.watchdog_status === 'silent' || w.watchdog_status === 'never_reported' ? '#FFF8F8' : 'transparent' }}>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: wdColor(w.watchdog_status), letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {w.watchdog_status === 'ok' ? '● ok' : w.watchdog_status === 'disabled' ? '○ off' : `● ${w.watchdog_status}`}
                  </span>
                </td>
                <td style={cell}>
                  <span style={{ fontWeight: 600 }}>{w.title}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginLeft: 8 }}>{w.alarm_code}</span>
                </td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{w.source}</td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'nowrap' }}>
                  {w.cadence_minutes >= 60 ? `${w.cadence_minutes / 60}h` : `${w.cadence_minutes}min`}
                </td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtTs(w.last_ok_at)}</td>
                <td style={{ ...cell, fontSize: 11, color: w.last_error ? RED : TOKENS.text3 }}>{w.last_error ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 3 ── 7-DAY LOG */}
      <section style={{ ...card, marginBottom: 14 }}>
        <SectionTitle right={
          <span style={{ display: 'flex', gap: 8 }}>
            <select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)}
              style={{ fontSize: 11.5, padding: '3px 6px', border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
              <option value="all">all sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}
              style={{ fontSize: 11.5, padding: '3px 6px', border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
              <option value="all">all severities</option>
              <option value="red">red</option><option value="amber">amber</option>
            </select>
          </span>
        }>
          7-day log <span style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.text3 }}>({filteredEvents.length})</span>
        </SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={hdr}>sev</th><th style={hdr}>alarm</th><th style={hdr}>item</th>
            <th style={hdr}>fired</th><th style={hdr}>status</th><th style={hdr}>ack / resolution</th>
          </tr></thead>
          <tbody>
            {filteredEvents.slice(0, 100).map((e) => (
              <tr key={e.id} style={{ background: e.unack_over_24h ? '#FFF3E8' : 'transparent' }}>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: sevColor(e.severity), textTransform: 'uppercase' }}>{e.severity}</span>
                </td>
                <td style={cell}>
                  <span style={{ fontWeight: 600 }}>{e.title}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginLeft: 8 }}>{e.alarm_code}</span>
                </td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.item_key ?? '—'}</td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtTs(e.fired_at)}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: e.status === 'open' ? (e.unack_over_24h ? RED : AMBER) : e.status === 'resolved' ? GREEN : TOKENS.text2 }}>
                    {e.status}{e.unack_over_24h ? ' · unack >24h' : ''}
                  </span>
                </td>
                <td style={{ ...cell, fontSize: 11, color: TOKENS.text3, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.ack_note ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEvents.length > 100 && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, paddingTop: 8, fontStyle: 'italic' }}>
            … and {filteredEvents.length - 100} more (filter to narrow)
          </div>
        )}
        {filteredEvents.length === 0 && (
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: TOKENS.text3, fontStyle: 'italic' }}>
            no events in the last 7 days for this filter
          </div>
        )}
      </section>

      {/* 4 ── NOISE CONTROL */}
      <section style={card}>
        <SectionTitle right={
          <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>
            your levers — tune cadence or switch a watchdog off (it will render as disabled above, never silently vanish)
          </span>
        }>
          Noise control
        </SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={hdr}>definition</th><th style={hdr}>sev</th><th style={hdr}>fires 24h</th>
            <th style={hdr}>fires 7d</th><th style={hdr}>last fired</th><th style={hdr}>cadence</th><th style={hdr}>state</th>
          </tr></thead>
          <tbody>
            {noise.map((n) => (
              <tr key={n.alarm_code} style={{ opacity: n.active ? 1 : 0.55 }}>
                <td style={cell}>
                  <span style={{ fontWeight: 600 }}>{n.title}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginLeft: 8 }}>{n.alarm_code}</span>
                </td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: sevColor(n.severity), textTransform: 'uppercase' }}>{n.severity}</span>
                </td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 12, textAlign: 'right', fontWeight: n.fires_24h > 5 ? 700 : 400, color: n.fires_24h > 5 ? AMBER : TOKENS.ink }}>{n.fires_24h}</td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 12, textAlign: 'right' }}>{n.fires_7d}</td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtTs(n.last_fired_at)}</td>
                <NoiseRowCtl row={n} />
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modal && <AckModal ev={modal.ev} mode={modal.mode} onClose={() => setModal(null)} />}
    </div>
  );
}
