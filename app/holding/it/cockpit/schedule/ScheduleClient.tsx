'use client';
// app/holding/it/cockpit/schedule/ScheduleClient.tsx
// Client island for the Scheduler Console (brief ops-scheduler-console-v1).
// Renders: attention queue (exception-first), 9 business-group pulse strips
// with per-job drill-down, per-job controls with toasts, scoped kill-switch
// flow (scope cards → honest preview → hold-to-confirm → proof), audit tab.

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TOKENS, MONO } from '../_components/tokens';
import { GROUPS, cronPlain, cronFireHours } from '@/lib/schedule/catalog';
import { jobSetAction, masterSetAction } from './actions';

export type UnifiedRow = {
  name: string;
  system: 'pg_cron' | 'vercel' | 'ccr';
  schedule: string;
  active: boolean;
  editable: boolean;
  group: string;
  tier: 'ACT' | 'INGEST' | 'SAFETY';
  last_status: string | null;
  last_run: string | null;
  last_secs: number | null;
  last_message: string | null;
  late: boolean;
  note: string | null;
};

export type AuditRow = {
  id: number; target: string; action: string;
  old_value: string | null; new_value: string | null;
  actor: string | null; changed_at: string;
};

type Toast = { id: number; kind: 'ok' | 'err'; text: string };

const SYSTEM_BADGE: Record<UnifiedRow['system'], { label: string; bg: string }> = {
  pg_cron: { label: 'DB cron', bg: '#EAF1EE' },
  vercel: { label: 'Vercel', bg: '#EFEAF7' },
  ccr: { label: 'CCR agent', bg: '#FBF3E2' },
};

function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = Date.parse(iso);
  const mins = Math.round((Date.now() - d) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / (24 * 60))}d ago`;
}

export default function ScheduleClient(props: {
  rows: UnifiedRow[];
  automationOn: boolean;
  interceptCount: number;
  auditRows: AuditRow[];
}) {
  const { rows, automationOn, interceptCount, auditRows } = props;
  const router = useRouter();
  const [tab, setTab] = useState<'loops' | 'audit'>('loops');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [killOpen, setKillOpen] = useState(false);
  const [killScope, setKillScope] = useState<'agents' | 'everything'>('agents');
  const [holdPct, setHoldPct] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pending, startTransition] = useTransition();

  const toast = (kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  };

  const attention = useMemo(() => rows.filter((r) =>
    (r.system === 'pg_cron' && r.active && r.last_status && r.last_status !== 'succeeded') ||
    r.late ||
    (r.system === 'pg_cron' && !r.active)
  ), [rows]);
  const failed = attention.filter((r) => r.active && r.last_status && r.last_status !== 'succeeded');
  const lateRows = attention.filter((r) => r.late && !(r.last_status && r.last_status !== 'succeeded'));
  const paused = attention.filter((r) => r.system === 'pg_cron' && !r.active);
  const healthyCount = rows.length - failed.length - lateRows.length - paused.length;

  const killPreview = useMemo(() => {
    const act = rows.filter((r) => r.system === 'pg_cron' && r.active && r.tier === 'ACT');
    const ingest = rows.filter((r) => r.system === 'pg_cron' && r.active && r.tier === 'INGEST');
    const safety = rows.filter((r) => r.system === 'pg_cron' && r.tier === 'SAFETY');
    const vercelN = rows.filter((r) => r.system === 'vercel').length;
    const ccrN = rows.filter((r) => r.system === 'ccr').length;
    return { act, ingest, safety, vercelN, ccrN };
  }, [rows]);

  const runJobSet = (job: string, input: { active?: boolean; schedule?: string }, okMsg: string) => {
    startTransition(async () => {
      const res = await jobSetAction({ job, ...input });
      if (res.ok) { toast('ok', okMsg); router.refresh(); }
      else toast('err', `${job}: ${res.error}`);
    });
  };

  const runMaster = (enabled: boolean, scope: 'agents' | 'everything') => {
    startTransition(async () => {
      const res = await masterSetAction({ enabled, scope });
      if (res.ok) {
        const d = res.detail ?? {};
        toast('ok', enabled
          ? `Automation back ON — ${d.restored_jobs ?? 0} loops restored.`
          : `KILL executed (${scope}) — ${d.stopped_jobs ?? 0} DB loops stopped; Vercel + CCR loops now exit on the flag.`);
        setKillOpen(false); setHoldPct(0);
        router.refresh();
      } else toast('err', `Kill switch: ${res.error}`);
    });
  };

  const startHold = () => {
    if (holdTimer.current) return;
    const t0 = Date.now();
    holdTimer.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - t0) / 3000) * 100);
      setHoldPct(pct);
      if (pct >= 100) {
        stopHold(false);
        runMaster(false, killScope);
      }
    }, 50);
  };
  const stopHold = (reset = true) => {
    if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null; }
    if (reset) setHoldPct(0);
  };

  const card: React.CSSProperties = {
    background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
  };

  const renderRow = (r: UnifiedRow) => (
    <div key={`${r.system}:${r.name}`} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      borderTop: `1px solid ${TOKENS.border}`, fontSize: 12, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: SYSTEM_BADGE[r.system].bg, color: TOKENS.ink, whiteSpace: 'nowrap' }}>
        {SYSTEM_BADGE[r.system].label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, minWidth: 220, flex: '1 1 220px' }} title={r.last_message ?? undefined}>
        {r.name}
        {r.tier === 'SAFETY' && <span style={{ marginLeft: 6, fontSize: 9, color: TOKENS.text3 }} title="Never stopped by the kill switch">🛡 safety</span>}
      </span>
      {editing === r.name ? (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input value={editValue} onChange={(e) => setEditValue(e.target.value)}
            style={{ fontFamily: MONO, fontSize: 11, padding: '3px 6px', border: `1px solid ${TOKENS.border}`, borderRadius: 4, width: 130 }} />
          <button disabled={pending} onClick={() => { setEditing(null); runJobSet(r.name, { schedule: editValue }, `${r.name} rescheduled to "${editValue}"`); }}
            style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: '#fff' }}>Save</button>
          <button onClick={() => setEditing(null)}
            style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: `1px solid ${TOKENS.border}`, background: TOKENS.bg, cursor: 'pointer' }}>Cancel</button>
        </span>
      ) : (
        <button
          onClick={() => { if (r.editable) { setEditing(r.name); setEditValue(r.schedule); } }}
          title={r.editable ? 'Click to edit cadence (cron, UTC)' : r.note ?? undefined}
          style={{
            fontFamily: MONO, fontSize: 11, padding: '3px 8px', borderRadius: 4,
            border: `1px dashed ${r.editable ? TOKENS.border : 'transparent'}`,
            background: 'transparent', color: TOKENS.text2, cursor: r.editable ? 'pointer' : 'default',
          }}>
          {cronPlain(r.schedule)}
        </button>
      )}
      <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2, whiteSpace: 'nowrap' }}>
        {r.system === 'pg_cron' ? fmtWhen(r.last_run) : '—'}
        {r.last_secs != null && <span style={{ color: TOKENS.text3 }}> · {Math.round(r.last_secs)}s</span>}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
        background: r.late ? '#FDF3E4'
          : r.last_status === 'succeeded' ? '#EAF1EE'
          : r.last_status ? '#FDECE4' : TOKENS.bg,
        color: r.late ? '#8a6d1a'
          : r.last_status === 'succeeded' ? 'var(--status-green)'
          : r.last_status ? 'var(--status-red)' : TOKENS.text2,
      }}>
        {r.late ? 'LATE — expected a run by now' : r.last_status ?? (r.system === 'pg_cron' ? 'never ran' : 'runs off-DB')}
      </span>
      {r.editable ? (
        <button disabled={pending}
          onClick={() => runJobSet(r.name, { active: !r.active }, `${r.name} ${r.active ? 'paused' : 'resumed'}`)}
          style={{
            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${r.active ? 'var(--status-green)' : TOKENS.border}`,
            background: r.active ? '#EAF1EE' : TOKENS.bg,
            color: r.active ? 'var(--status-green)' : TOKENS.text2,
          }}>{r.active ? 'ON — pause' : 'OFF — resume'}</button>
      ) : (
        <span style={{ fontSize: 10, color: TOKENS.text3, maxWidth: 260 }} title={r.note ?? undefined}>read-only · {r.system === 'vercel' ? 'change in vercel.json' : 'change via standing agent schedule'}</span>
      )}
      {r.active && r.last_status && r.last_status !== 'succeeded' && r.last_message && (
        <div style={{ flexBasis: '100%', fontSize: 10.5, color: 'var(--status-red)', paddingLeft: 4 }}>{r.last_message.slice(0, 220)}</div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1160, color: TOKENS.ink }}>
      {/* toasts */}
      <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, maxWidth: 380,
            background: t.kind === 'ok' ? '#EAF1EE' : '#FDECE4',
            border: `1px solid ${t.kind === 'ok' ? 'var(--status-green)' : 'var(--status-red)'}`,
            color: t.kind === 'ok' ? 'var(--status-green)' : 'var(--status-red)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          }}>{t.text}</div>
        ))}
      </div>

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Scheduler Console</div>
          <p style={{ fontSize: 12, color: TOKENS.text2, margin: '4px 0 0' }}>
            Every scheduled loop across DB cron, Vercel and the CCR standing agents. All times UTC (Laos = UTC+7).
          </p>
        </div>
        {automationOn ? (
          <button onClick={() => setKillOpen(true)} style={{
            fontSize: 12, fontWeight: 700, padding: '10px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'var(--status-red)', color: '#fff',
          }}>⏸ KILL SWITCH — stop automation…</button>
        ) : (
          <button disabled={pending} onClick={() => runMaster(true, killScope)} style={{
            fontSize: 12, fontWeight: 700, padding: '10px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'var(--status-green)', color: '#fff',
          }}>▶ Automation is OFF — restore stopped loops</button>
        )}
      </div>

      {/* OFF banner + proof ledger */}
      {!automationOn && (
        <div style={{ background: '#FDECE4', border: '1px solid var(--status-red)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--status-red)', marginBottom: 12 }}>
          <b>Master kill switch is ON.</b> Stopped DB loops stay off until you restore; Vercel and CCR loops
          exit on the flag the moment they fire. <b>Fire attempts intercepted so far: {interceptCount}</b> — every
          intercepted fire is proof the switch is holding (see Change audit tab).
        </div>
      )}

      {/* attention queue */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>
          {failed.length + lateRows.length === 0
            ? <>All clear — {healthyCount} loops healthy{paused.length > 0 ? `, ${paused.length} paused on purpose` : ''}.</>
            : <>Needs attention ({failed.length + lateRows.length})</>}
        </div>
        {failed.map(renderRow)}
        {lateRows.map(renderRow)}
        {paused.length > 0 && failed.length + lateRows.length > 0 && (
          <div style={{ padding: '6px 14px 10px', fontSize: 11, color: TOKENS.text3 }}>
            Also paused: {paused.map((p) => p.name).join(' · ')} — paused loops don’t run and don’t alert; resume or leave intentionally.
          </div>
        )}
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {([['loops', `Loops (${rows.length})`], ['audit', `Change audit (${auditRows.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${tab === k ? 'var(--primary)' : TOKENS.border}`,
            background: tab === k ? 'var(--primary)' : TOKENS.bgRaised,
            color: tab === k ? '#fff' : TOKENS.text2,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'loops' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {GROUPS.map((g) => {
            const members = rows.filter((r) => r.group === g.key);
            if (members.length === 0) return null;
            const bad = members.filter((r) => (r.active && r.last_status && r.last_status !== 'succeeded') || r.late).length;
            const pausedN = members.filter((r) => r.system === 'pg_cron' && !r.active).length;
            const open = openGroups[g.key] ?? false;
            const hours = new Set<number>();
            members.forEach((r) => { if (r.active) cronFireHours(r.schedule).forEach((h) => hours.add(h)); });
            return (
              <div key={g.key} style={card}>
                <button onClick={() => setOpenGroups((s) => ({ ...s, [g.key]: !open }))} style={{
                  display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: TOKENS.ink,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 210 }}>{g.label}</span>
                  {/* 24h pulse strip */}
                  <span style={{ display: 'inline-flex', gap: 2, flex: '0 0 auto' }} title="Fire hours across the day (UTC)">
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h} style={{
                        width: 7, height: 14, borderRadius: 2,
                        background: hours.has(h) ? (bad > 0 ? 'var(--status-red)' : 'var(--primary)') : TOKENS.bg,
                        border: `1px solid ${TOKENS.border}`,
                      }} />
                    ))}
                  </span>
                  <span style={{ fontSize: 11, color: bad > 0 ? 'var(--status-red)' : TOKENS.text2, fontWeight: bad > 0 ? 700 : 400 }}>
                    {members.length} loops{bad > 0 ? ` · ${bad} need attention` : ' · healthy'}{pausedN > 0 ? ` · ${pausedN} paused` : ''}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: TOKENS.text3 }}>{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                  <>
                    <div style={{ padding: '0 14px 8px', fontSize: 11, color: TOKENS.text3 }}>{g.what}</div>
                    {members.map(renderRow)}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'audit' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.bg }}>
                {['When (UTC)', 'Target', 'Action', 'From → To', 'Who'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditRows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '14px 12px', color: TOKENS.text3 }}>No schedule changes logged yet.</td></tr>
              )}
              {auditRows.map((a) => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                  <td style={{ padding: '7px 12px', fontFamily: MONO, fontSize: 11, whiteSpace: 'nowrap' }}>{a.changed_at?.slice(0, 16).replace('T', ' ')}</td>
                  <td style={{ padding: '7px 12px', fontFamily: MONO, fontSize: 11 }}>{a.target}</td>
                  <td style={{ padding: '7px 12px', fontWeight: 700, fontSize: 11 }}>{a.action}</td>
                  <td style={{ padding: '7px 12px', fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>
                    {(a.old_value ?? '—')} → {(a.new_value ?? '—')}
                  </td>
                  <td style={{ padding: '7px 12px', fontSize: 11, color: TOKENS.text2 }}>{a.actor ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* kill-switch modal */}
      {killOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,27,0.55)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { setKillOpen(false); stopHold(); }}>
          <div style={{ ...card, maxWidth: 560, width: '100%', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Stop automation — choose how far</div>
            <p style={{ fontSize: 12, color: TOKENS.text2, margin: '0 0 12px' }}>
              Safety loops (backups, alarms, audits — {killPreview.safety.length}) are never stopped.
            </p>
            {([
              ['agents', 'Stop agents & outbound', `Stops ${killPreview.act.length} DB loops (agents, emails, content, reports) + blocks ${killPreview.vercelN} Vercel crons and ${killPreview.ccrN} CCR agents at the flag. Data syncs keep running — dashboards stay fresh.`],
              ['everything', 'Stop EVERYTHING incl. data syncs', `Stops ${killPreview.act.length + killPreview.ingest.length} DB loops + blocks ${killPreview.vercelN} Vercel crons and ${killPreview.ccrN} CCR agents. ⚠ Dashboards and booking data will go STALE until you restore.`],
            ] as const).map(([key, label, desc]) => (
              <button key={key} onClick={() => setKillScope(key)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 8,
                borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${killScope === key ? 'var(--status-red)' : TOKENS.border}`,
                background: killScope === key ? '#FDECE4' : TOKENS.bgRaised, color: TOKENS.ink,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 11, color: TOKENS.text2, marginTop: 2 }}>{desc}</div>
              </button>
            ))}
            <div style={{ fontSize: 11, color: TOKENS.text3, margin: '4px 0 10px' }}>
              Restore = one click: the exact set of loops stopped now is saved and re-enabled together.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                disabled={pending}
                onMouseDown={startHold} onMouseUp={() => stopHold()} onMouseLeave={() => stopHold()}
                onTouchStart={startHold} onTouchEnd={() => stopHold()}
                style={{
                  position: 'relative', overflow: 'hidden', flex: 1,
                  fontSize: 12, fontWeight: 700, padding: '12px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'var(--status-red)', color: '#fff',
                }}>
                <span style={{ position: 'absolute', inset: 0, width: `${holdPct}%`, background: 'rgba(0,0,0,0.35)', transition: 'width 50ms linear' }} />
                <span style={{ position: 'relative' }}>{holdPct > 0 ? `Hold… ${Math.ceil(3 - (holdPct / 100) * 3)}s` : 'HOLD 3s TO EXECUTE'}</span>
              </button>
              <button onClick={() => { setKillOpen(false); stopHold(); }} style={{ fontSize: 12, padding: '12px 16px', borderRadius: 6, border: `1px solid ${TOKENS.border}`, background: TOKENS.bg, cursor: 'pointer', color: TOKENS.text2 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
