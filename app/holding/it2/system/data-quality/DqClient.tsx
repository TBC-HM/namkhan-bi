'use client';
// app/holding/it2/system/data-quality/DqClient.tsx
// dq-engine-v1 — all four brief containers + findings button + run-now.
// Container contract (law 737): every container names its source, has a working
// CTA, drills to rows, and renders an honest empty-state.
// Hydration safety (§0.55/§0.56): timestamps rendered via ISO slicing only.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import { resolveDqException, runDqNow, setDqRule } from './actions';

export interface DqPostureRow {
  source: string; label: string; property_id: number | null;
  max_age_minutes: number; affected: string | null; watermark_at: string | null;
  age_minutes: number | null; status: 'fresh' | 'stale' | 'unknown'; stale_factor: number | null;
}
export interface DqExceptionRow {
  id: number; rule_code: string; rule_name: string; category: string;
  severity: string; status: string; property_id: number | null; record_ref: string;
  detail: string | null; is_systemic: boolean; detected_at: string; last_seen_at: string;
  first_run_id: number | null; last_seen_run_id: number | null; fix_owner: string | null; target: string;
}
export interface DqRuleRow {
  rule_code: string; rule_name: string; category: string; severity: string; target: string;
  threshold_source: string; guardrail_domain: string | null; guardrail_key: string | null;
  threshold_display: string | null; threshold_val: number | null; fix_owner: string | null;
  provenance: string | null; active: boolean; last_fired_at: string | null;
  fire_count: number; open_exceptions: number;
}
export interface DqTrendRow {
  week_start: string; opened: number; resolved: number; runs: number; last_run_id: number | null;
}
export interface DqRunRow {
  run_id: number; started_at: string; finished_at: string | null; trigger: string;
  property_id: number | null; rules_checked: number; exceptions_opened: number;
  exceptions_seen_again: number; exceptions_autoclosed: number; rules_errored: number;
  duration_ms: number | null;
}

const fmt = (iso: string | null | undefined): string => (iso ? iso.slice(0, 16).split('T').join(' ') : '—');
// ISO week-start (Monday, UTC) — pure function of the input, hydration-safe.
const weekOf = (iso: string): string => {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const propName = (pid: number | null): string =>
  pid === 260955 ? 'Namkhan' : pid === 1000001 ? 'Donna' : pid == null ? 'platform' : String(pid);

function drillHref(target: string, pid: number | null): string {
  const p = pid ?? 260955;
  if (target.includes('v_reservations') || target.includes('v_reservation_rooms')) return `/h/${p}/guests`;
  if (target.includes('cost_events')) return '/holding/finance/costs';
  if (target.includes('fx_rates')) return `/h/${p}/finance`;
  if (target.includes('forecast')) return `/h/${p}/revenue`;
  if (target.includes('sync')) return '/holding/it2/system/activity';
  if (target.includes('dq_known_issues')) return '/holding/it2/knowledge/data/freshness';
  return '/holding/it2/system/data-quality';
}

const card: React.CSSProperties = {
  background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 10,
  padding: 16, marginBottom: 22,
};
const h2: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: TOKENS.inkSoft, margin: 0,
};
const cell: React.CSSProperties = { padding: '6px 10px', borderBottom: `1px solid ${TOKENS.border}`, fontSize: 12.5 };
const hdr: React.CSSProperties = {
  ...cell, textAlign: 'left', fontWeight: 600, fontSize: 11, color: TOKENS.inkSoft,
  background: '#FAFAF7', whiteSpace: 'nowrap',
};
const btn: React.CSSProperties = {
  fontSize: 11.5, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
  border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, color: TOKENS.ink,
};
const sevColor = (s: string): string =>
  s === 'critical' ? '#C62828' : s === 'warning' ? '#B8542A' : TOKENS.inkSoft;

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
      fd.set('module', 'dq_engine');
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

// ── resolve modal ──────────────────────────────────────────────────────────
function ResolveModal({ exc, onClose }: { exc: DqExceptionRow; onClose: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState<'acknowledged' | 'fixed' | 'waived'>('acknowledged');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setErr(null);
    startTransition(async () => {
      const r = await resolveDqException(exc.id, status, note);
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
        width: 420, maxWidth: '92vw', background: TOKENS.bgRaised, borderRadius: 10,
        border: `1px solid ${TOKENS.border}`, padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TOKENS.ink }}>
          Resolve exception #{exc.id}
        </div>
        <div style={{ fontSize: 11.5, fontFamily: MONO, color: TOKENS.inkSoft }}>
          {exc.rule_code} · {exc.record_ref}
        </div>
        <div style={{ fontSize: 12, color: TOKENS.ink }}>{exc.detail}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['acknowledged', 'fixed', 'waived'] as const).map((s) => (
            <button key={s} type="button"
              style={{ ...btn, background: status === s ? TOKENS.forest : TOKENS.bgRaised, color: status === s ? '#fff' : TOKENS.ink }}
              onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>
        {status === 'waived' && (
          <div style={{ fontSize: 11, color: TOKENS.inkSoft }}>
            Waivers expire after 90 days, then the exception reopens automatically.
          </div>
        )}
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Resolution note (required)"
          style={{ fontSize: 12.5, padding: 8, border: `1px solid ${TOKENS.border}`, borderRadius: 6, resize: 'vertical' }}
        />
        {err && <div style={{ fontSize: 11.5, color: '#C62828' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={btn} onClick={onClose}>Cancel</button>
          <button type="button" style={{ ...btn, background: TOKENS.forest, color: '#fff' }} onClick={submit}
            disabled={isPending || note.trim().length < 5}>
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main ───────────────────────────────────────────────────────────────────
export function DqClient({ posture, exceptions, rules, trend, runs, loadError }: {
  posture: DqPostureRow[]; exceptions: DqExceptionRow[]; rules: DqRuleRow[];
  trend: DqTrendRow[]; runs: DqRunRow[]; loadError: string | null;
}) {
  const router = useRouter();
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [resolving, setResolving] = useState<DqExceptionRow | null>(null);
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const staleCount = posture.filter((p) => p.status === 'stale').length;
  const unknownCount = posture.filter((p) => p.status === 'unknown').length;
  const critOpen = exceptions.filter((e) => e.severity === 'critical').length;
  const lastRun = runs[0] ?? null;

  const byRule = useMemo(() => {
    const m = new Map<string, DqExceptionRow[]>();
    for (const e of exceptions) {
      const arr = m.get(e.rule_code) ?? [];
      arr.push(e);
      m.set(e.rule_code, arr);
    }
    return [...m.entries()].sort((a, b) => {
      const sev = (x: DqExceptionRow[]) => (x[0].severity === 'critical' ? 0 : x[0].severity === 'warning' ? 1 : 2);
      return sev(a[1]) - sev(b[1]);
    });
  }, [exceptions]);

  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.opened, t.resolved)));

  function runNow() {
    setRunMsg(null);
    startTransition(async () => {
      const r = await runDqNow();
      if (!r.ok) { setRunMsg(`✗ ${r.error}`); return; }
      const d = r.data as { exceptions_opened?: number; exceptions_autoclosed?: number; rules_checked?: number };
      setRunMsg(`✓ ${d?.rules_checked ?? '?'} rules · ${d?.exceptions_opened ?? 0} opened · ${d?.exceptions_autoclosed ?? 0} auto-closed`);
      router.refresh();
    });
  }

  function toggleRule(rc: string, active: boolean) {
    startTransition(async () => {
      const r = await setDqRule(rc, active, null);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 1080, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* header — freshness gates the verdict: any stale feed = never green */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: TOKENS.ink, margin: 0 }}>Data Quality</h1>
          {staleCount === 0 && unknownCount === 0 && critOpen === 0 ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2E7D32', background: '#E8F5E9', padding: '2px 8px', borderRadius: 4, border: '1px solid #A5D6A7' }}>
              all feeds fresh · 0 critical
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#C62828', background: '#FFEBEE', padding: '2px 8px', borderRadius: 4, border: '1px solid #EF9A9A' }}>
              {staleCount} stale feed{staleCount === 1 ? '' : 's'} · {critOpen} critical exception{critOpen === 1 ? '' : 's'}
            </span>
          )}
          {lastRun && (
            <span style={{ fontSize: 11, color: TOKENS.text3 }}>
              last run {fmt(lastRun.started_at)} UTC · {lastRun.rules_checked} rules · cron dq-run-hourly
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {runMsg && <span style={{ fontSize: 11, color: runMsg.startsWith('✓') ? '#2E7D32' : '#C62828' }}>{runMsg}</span>}
          <button type="button" style={btn} onClick={runNow} disabled={isPending}>
            {isPending ? 'Running…' : 'Run all rules now'}
          </button>
          <FindingButton />
        </div>
      </div>

      {loadError && (
        <div style={{ ...card, borderColor: '#EF9A9A', color: '#C62828', fontSize: 12.5 }}>
          Bridge read failed: {loadError} — check public.v_dq_* grants (L5).
        </div>
      )}

      {/* 1 · FRESHNESS BOARD — source: public.v_dq_posture */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={h2}>Freshness board</h2>
          <span style={{ fontSize: 10.5, color: TOKENS.text3, fontFamily: MONO }}>public.v_dq_posture · dq.freshness_targets</span>
        </div>
        {posture.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#C62828', padding: 10, border: '1px solid #EF9A9A', borderRadius: 6 }}>
            No sources registered in dq.freshness_targets — the board is blind, not healthy. Seed targets before trusting any number on this platform.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={hdr}>Source</th><th style={hdr}>Property</th><th style={hdr}>Status</th>
              <th style={hdr}>Age</th><th style={hdr}>Target</th><th style={hdr}>Last data</th>
            </tr></thead>
            <tbody>
              {posture.map((p) => (
                <>
                  <tr key={p.source} style={{ cursor: 'pointer', background: p.status === 'stale' ? '#FFF8F8' : 'transparent' }}
                    onClick={() => setOpenSource(openSource === p.source ? null : p.source)}>
                    <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{p.label}</td>
                    <td style={cell}>{propName(p.property_id)}</td>
                    <td style={{ ...cell, fontWeight: 700, color: p.status === 'fresh' ? '#2E7D32' : p.status === 'stale' ? '#C62828' : TOKENS.text3 }}>
                      {p.status}{p.stale_factor != null && p.status === 'stale' ? ` (${p.stale_factor}×)` : ''}
                    </td>
                    <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{p.age_minutes != null ? `${Math.round(p.age_minutes)}m` : '—'}</td>
                    <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{p.max_age_minutes}m</td>
                    <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{fmt(p.watermark_at)}</td>
                  </tr>
                  {openSource === p.source && (
                    <tr key={`${p.source}-detail`}>
                      <td colSpan={6} style={{ ...cell, background: '#FAFAF7', fontSize: 12 }}>
                        <strong>Affected when stale:</strong> {p.affected ?? 'not documented'} ·{' '}
                        <span style={{ fontFamily: MONO, fontSize: 11 }}>source key: {p.source}</span>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 2 · OPEN EXCEPTIONS — source: public.v_dq_exceptions_open */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={h2}>Open exceptions ({exceptions.length})</h2>
          <span style={{ fontSize: 10.5, color: TOKENS.text3, fontFamily: MONO }}>public.v_dq_exceptions_open · fn_dq_exception_resolve</span>
        </div>
        {exceptions.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#2E7D32', padding: 10, border: '1px solid #A5D6A7', background: '#E8F5E9', borderRadius: 6 }}>
            0 open exceptions — last full run {lastRun ? `${fmt(lastRun.started_at)} UTC checked ${lastRun.rules_checked} rules` : 'not yet recorded'}.
          </div>
        ) : (
          byRule.map(([rc, list]) => (
            <div key={rc} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: sevColor(list[0].severity), marginBottom: 4 }}>
                {list[0].severity.toUpperCase()} · {list[0].rule_name}{' '}
                <span style={{ fontFamily: MONO, fontWeight: 400, fontSize: 11, color: TOKENS.text3 }}>{rc} · {list.length} open</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} style={{ background: e.is_systemic ? '#FFF4E8' : 'transparent' }}>
                      <td style={{ ...cell, width: 90, fontFamily: MONO, fontSize: 11 }}>{propName(e.property_id)}</td>
                      <td style={cell}>{e.detail ?? e.record_ref}</td>
                      <td style={{ ...cell, width: 100, fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>{e.status} · {fmt(e.detected_at).slice(0, 10)}</td>
                      <td style={{ ...cell, width: 150, whiteSpace: 'nowrap' }}>
                        <a href={drillHref(e.target, e.property_id)} style={{ fontSize: 11.5, color: TOKENS.forest, marginRight: 10 }}>source →</a>
                        <button type="button" style={btn} onClick={() => setResolving(e)}>Resolve</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* 3 · RULE CATALOG — source: public.v_dq_rules */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={h2}>Rule catalog ({rules.filter((r) => r.active).length} active / {rules.length})</h2>
          <span style={{ fontSize: 10.5, color: TOKENS.text3, fontFamily: MONO }}>dq.rules · fn_dq_rule_set · guardrail thresholds live in public.guardrails</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={hdr}>Rule</th><th style={hdr}>Category</th><th style={hdr}>Severity</th>
            <th style={hdr}>Threshold</th><th style={hdr}>Open</th><th style={hdr}>Fired</th><th style={hdr}>Active</th>
          </tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.rule_code} style={{ opacity: r.active ? 1 : 0.5 }}>
                <td style={cell}>
                  <span style={{ fontFamily: MONO, fontSize: 11 }}>{r.rule_code}</span>
                  <div style={{ fontSize: 11.5, color: TOKENS.inkSoft }}>{r.rule_name}{r.provenance ? ` · ${r.provenance}` : ''}</div>
                </td>
                <td style={cell}>{r.category}</td>
                <td style={{ ...cell, fontWeight: 700, color: sevColor(r.severity) }}>{r.severity}</td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 11 }}>
                  {r.threshold_source === 'guardrail' ? `guardrail ${r.guardrail_key}: ${r.threshold_display ?? '?'}` : r.threshold_display ?? '—'}
                </td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{r.open_exceptions}</td>
                <td style={{ ...cell, fontFamily: MONO, fontSize: 11 }}>{r.fire_count > 0 ? `${r.fire_count}× · ${fmt(r.last_fired_at).slice(0, 10)}` : 'never'}</td>
                <td style={cell}>
                  <button type="button" style={{ ...btn, background: r.active ? TOKENS.forest : TOKENS.bgRaised, color: r.active ? '#fff' : TOKENS.ink }}
                    onClick={() => toggleRule(r.rule_code, !r.active)} disabled={isPending}>
                    {r.active ? 'on' : 'off'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4 · TREND — source: public.v_dq_trend_weekly */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={h2}>Trend — opened vs resolved per week</h2>
          <span style={{ fontSize: 10.5, color: TOKENS.text3, fontFamily: MONO }}>public.v_dq_trend_weekly · dq.runs</span>
        </div>
        {trend.every((t) => t.opened === 0 && t.resolved === 0 && t.runs === 0) ? (
          <div style={{ fontSize: 12.5, color: TOKENS.inkSoft, padding: 10, border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
            No runs recorded yet — the trend starts once dq-run-hourly has fired. An empty chart here means the engine has not run, not that quality is perfect.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90, marginBottom: 8 }}>
              {trend.map((t) => (
                <div key={t.week_start} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}
                  onClick={() => setOpenWeek(openWeek === t.week_start ? null : t.week_start)}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
                    <div title={`opened ${t.opened}`} style={{ width: 10, height: Math.max(2, (t.opened / maxTrend) * 60), background: '#B8542A', borderRadius: 2 }} />
                    <div title={`resolved ${t.resolved}`} style={{ width: 10, height: Math.max(2, (t.resolved / maxTrend) * 60), background: TOKENS.forest, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 9.5, fontFamily: MONO, color: openWeek === t.week_start ? TOKENS.ink : TOKENS.text3 }}>
                    {t.week_start.slice(5, 10)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: TOKENS.text3, marginBottom: 8 }}>
              <span style={{ color: '#B8542A' }}>■</span> opened · <span style={{ color: TOKENS.forest }}>■</span> resolved — click a week for its runs
            </div>
            {openWeek && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={hdr}>Run</th><th style={hdr}>Started (UTC)</th><th style={hdr}>Trigger</th>
                  <th style={hdr}>Rules</th><th style={hdr}>Opened</th><th style={hdr}>Auto-closed</th><th style={hdr}>Errors</th>
                </tr></thead>
                <tbody>
                  {runs.filter((r) => weekOf(r.started_at) === openWeek).map((r) => (
                    <tr key={r.run_id}>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>#{r.run_id}</td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{fmt(r.started_at)}</td>
                      <td style={cell}>{r.trigger}</td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{r.rules_checked}</td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{r.exceptions_opened}</td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5 }}>{r.exceptions_autoclosed}</td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 11.5, color: r.rules_errored > 0 ? '#C62828' : TOKENS.text3 }}>{r.rules_errored}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {resolving && <ResolveModal exc={resolving} onClose={() => setResolving(null)} />}
    </div>
  );
}
