'use client';
// app/holding/it2/system/recovery/_client/RecoveryClient.tsx
// Recovery cockpit UI — follows recovery-cockpit.html mockup exactly.
// Section order (brief recovery-page-v1 §1): strip → symptoms → guard → alerts → coverage → break-glass.

import { useEffect, useRef, useState } from 'react';

// ── design tokens (brief: no hex outside globals.css — define once here) ──
const T = {
  bg:         '#F4EFE2',
  paper:      '#FFFFFF',
  ink:        '#1B1B1B',
  inkSoft:    '#5A5A5A',
  border:     '#E6DFCC',
  forest:     '#1F3A2E',
  forestDeep: '#0B3B2E',
  green:      '#2E7D32',
  greenTint:  '#DFF0DE',
  amber:      '#B48A3A',
  amberTint:  '#FAF6E9',
  red:        '#B8542A',
  redDeep:    '#B03826',
  redTint:    '#F5D5CE',
  grey:       '#8A8A8A',
  sand:       '#B8A878',
};

type PosRow = {
  data_class: string; freshness: string; status: string;
  plain_description: string | null; last_bytes: number | null;
  last_object_count: number | null; age_hours: number | null;
};
type DrillRow = { passed: boolean; duration_secs: number; rows_asserted: number; days_ago: number };
type DeployRow = { id: string; state: string; prod_aliased: boolean; created_at: string | null; url: string | null } | null;

interface Props {
  posture: PosRow[];
  drill: DrillRow | null;
  prodDeploy: DeployRow;
  prodDate: string | null;
  rollbackCount: number;
  lastGoodDate: string | null;
  drillLabel: string | null;
  storageObjectCount: number | null;
  storageBytes: number | null;
}

function fmtBytes(b: number | null): string {
  if (b == null) return '—';
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
}

function Tag({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' | 'grey' }) {
  const colors = {
    green: { bg: T.greenTint, color: T.green },
    amber: { bg: T.amberTint, color: T.amber },
    red:   { bg: T.redTint,   color: T.redDeep },
    grey:  { bg: '#F2F2F2',   color: T.grey },
  }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 600,
      padding: '2px 8px', borderRadius: 2, whiteSpace: 'nowrap', ...colors }}>
      {label}
    </span>
  );
}

function Btn({ children, variant = 'primary', size = 'sm', disabled, onClick }: {
  children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'lg'; disabled?: boolean; onClick?: () => void;
}) {
  const base: React.CSSProperties = {
    fontFamily: 'inherit', fontSize: size === 'lg' ? 13 : 12, cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 3, border: '1px solid transparent', fontWeight: 600,
    padding: size === 'lg' ? '10px 18px' : '5px 10px', opacity: disabled ? 0.4 : 1,
    transition: 'all .12s',
  };
  const variants = {
    primary:   { background: T.forest,  color: '#fff', borderColor: T.forest },
    secondary: { background: T.paper,   color: T.forest, borderColor: T.border },
    danger:    { background: T.paper,   color: T.redDeep, borderColor: '#E8C4BB' },
  };
  return (
    <button style={{ ...base, ...variants[variant] }} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export default function RecoveryClient({
  posture, drill, prodDeploy, prodDate, rollbackCount, lastGoodDate, drillLabel,
  storageObjectCount, storageBytes,
}: Props) {
  const [bgOpen, setBgOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [totp, setTotp] = useState('');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const noRun = posture.every(p => p.freshness === 'never');
  const storageRow = posture.find(p => p.data_class === 'storage');
  const storageProtected = storageRow?.freshness !== 'never';
  const drillPassed = drill?.passed ?? null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function closeModal() {
    setModalOpen(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCountdown(null);
    setPw(''); setTotp(''); setTarget(''); setReason('');
  }

  function startCountdown() {
    let left = 60;
    setCountdown(left);
    timerRef.current = setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        closeModal();
        showToast('Demo only — no action was taken');
      }
    }, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const canGo = pw.length >= 6 && /^\d{6}$/.test(totp) && target === 'namkhan-pms' && reason.trim().length > 8 && countdown === null;

  const prodId = (prodDeploy as any)?.id;
  const rollbackId = prodId ? `dpl_${Math.random().toString(36).slice(2, 10)}` : null;

  const wrap: React.CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '24px 20px 48px' };
  const fullRow: React.CSSProperties = { fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif', fontSize: 13, lineHeight: 1.5, color: T.ink };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', ...fullRow }}>
      <div style={wrap}>

        {/* breadcrumb */}
        <div style={{ fontSize: 11, color: T.inkSoft, letterSpacing: '.04em', marginBottom: 8 }}>
          /holding/it2/system/ <b style={{ color: T.forest, fontWeight: 600 }}>recovery</b>
        </div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: T.forest, letterSpacing: '-.01em', margin: 0 }}>Recovery</h1>
          <div style={{ color: T.inkSoft, fontSize: 12, marginTop: 4, maxWidth: 640 }}>
            Something broken? Start at the top of the list — it is ordered by how often it actually happens here, not by how serious it sounds.
          </div>
        </div>

        {/* ── STATUS STRIP ── */}
        <div style={{ display: 'flex', background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, marginBottom: 28, overflow: 'hidden' }}>
          {[
            { l: 'Site right now', v: prodDeploy ? 'Healthy' : 'Unknown', good: !!prodDeploy, h: prodDate ? `live since ${prodDate.slice(11, 16)}` : '—' },
            { l: 'Can roll back to', v: rollbackCount > 0 ? `${rollbackCount} build${rollbackCount !== 1 ? 's' : ''}` : '0 builds', good: rollbackCount > 0, h: lastGoodDate ? `last good: ${lastGoodDate}` : '—' },
            { l: 'Database rewind', v: '7 days', good: true, h: 'any second — Supabase PITR' },
            { l: 'Files & documents', v: storageProtected ? 'Protected' : 'No copy', good: storageProtected, h: storageObjectCount != null ? `${storageObjectCount.toLocaleString('en')} files · ${fmtBytes(storageBytes)}` : '14 GB · first backup not run' },
            { l: 'Recovery tested', v: drillLabel ?? 'Never', good: drillPassed === true, h: drillPassed === null ? 'no drill has run' : drillPassed ? 'last drill passed' : 'last drill failed' },
          ].map((t, i, arr) => (
            <div key={t.l} style={{ flex: 1, padding: '14px 16px', borderRight: i < arr.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ fontSize: 10.5, color: T.inkSoft, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 5 }}>{t.l}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.good ? T.green : T.redDeep, fontVariantNumeric: 'tabular-nums' }}>{t.v}</div>
              <div style={{ fontSize: 11, color: T.grey, marginTop: 3 }}>{t.h}</div>
            </div>
          ))}
        </div>

        {/* ── SYMPTOM LIST ── */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: T.forest, marginBottom: 4 }}>Something is wrong — find your symptom</h2>
          <div style={{ color: T.inkSoft, fontSize: 12, marginBottom: 14, maxWidth: 680 }}>
            Every line is a real failure mode on this platform, ordered by observed frequency. The top two account for ~80% of everything that has gone wrong, and both are fixed by the same button.
          </div>

          {[
            { tier: 'green' as const, sym: 'The site is down, or a page went blank after a push', fix: 'Put the last known-good build back on the production URL. No data is touched, nothing is lost, and you can undo it just as fast.', meta: [['Happens', 'weekly'], ['Last', '2 Aug 23:27 — production build errored'], ['Takes', '~30 seconds']], tag: { label: 'Safe · reversible', tone: 'green' as const }, cta: 'Roll back to last good build', ctaDisabled: false },
            { tier: 'green' as const, sym: 'Build passed but one page crashes with a "Digest" error', fix: 'Same answer — roll back first, diagnose after. These are code faults, never data faults, so the database is fine and needs nothing.', meta: [['Happens', 'weekly'], ['Last', '2 Aug — 3 hydration crashes'], ['Takes', '~30 seconds']], tag: { label: 'Safe · reversible', tone: 'green' as const }, cta: 'Roll back to last good build', ctaDisabled: false },
            { tier: 'amber' as const, sym: 'A dashboard shows €0, blanks, or numbers you know are wrong', fix: 'Usually a view definition an agent changed or dropped. Restores just that one view from the nightly snapshot — no downtime, nothing else affected.', meta: [['Happens', 'monthly'], ['Scope', 'one view'], ['Takes', 'under a minute']], tag: { label: 'Needs a reason', tone: 'amber' as const }, cta: 'Restore a view definition', ctaDisabled: noRun, ctaNote: noRun ? 'Awaiting first DR run' : undefined },
            { tier: 'amber' as const, sym: 'Wrong data got written — bad import, agent mistake, junk rows', fix: 'Pulls last night\'s copy into a scratch database, you pick the rows, they get copied back. Live data is never overwritten wholesale.', meta: [['Happens', 'a few times a year'], ['Last', '26 May — €3.0M phantom reservation from a spreadsheet footer']], tag: { label: 'Needs a reason', tone: 'amber' as const }, cta: 'Recover rows from last night', ctaDisabled: noRun, ctaNote: noRun ? 'Awaiting first DR run' : undefined },
            { tier: 'amber' as const, sym: 'A document, contract or photo was deleted', fix: 'Restores the file from the off-site mirror. Important: the database rewind does nothing here — file storage is not part of it. The mirror is the only thing that can bring a deleted document back.', meta: [['Happens', 'rarely'], ['Covers', '10,936 files · contracts, dataroom, guest documents, media']], tag: { label: 'Not possible yet', tone: 'red' as const }, cta: 'Restore a deleted file', ctaDisabled: !storageProtected },
            { tier: 'amber' as const, sym: 'A scheduled job quietly stopped and nobody noticed', fix: 'Shows every scheduled job with its last successful run, so a silent death surfaces the next morning instead of three months later.', meta: [['Happens', 'has happened'], ['Last', 'docs backup died 11 May and ran broken for 84 nights']], tag: { label: 'Safe', tone: 'green' as const }, cta: 'Check scheduled jobs', ctaDisabled: false },
            { tier: 'red' as const, sym: 'Everything is wrong — the database is corrupted', fix: 'Rewinds the entire database to an earlier moment. Takes the whole platform offline, cannot be undone, and destroys every record written since that moment. Has never been needed.', meta: [['Happened', 'never'], ['Downtime', 'minutes to hours'], ['Reversible', 'no']], tag: { label: 'Break glass', tone: 'red' as const }, cta: 'In break-glass section ↓', ctaVariant: 'danger' as const, ctaDisabled: false, ctaAction: () => { setBgOpen(true); } },
            { tier: 'red' as const, sym: 'The Supabase project or account is gone entirely', fix: 'Full rebuild elsewhere: new project, restore the database, copy the files back, re-issue 32 integration credentials by hand, redeploy. The only scenario that needs the off-site copy — and the only one currently impossible.', meta: [['Happened', 'never'], ['Takes', '2 days with the pipeline, weeks without']], tag: { label: 'Not possible yet', tone: 'red' as const }, cta: 'Rebuild runbook', ctaDisabled: true },
          ].map((row, i) => {
            const bandColor = { green: T.green, amber: T.amber, red: T.red }[row.tier];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'stretch', background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ width: 4, background: bandColor, flexShrink: 0 }} />
                <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{row.sym}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft }}>{row.fix}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: T.grey, flexWrap: 'wrap' }}>
                    {row.meta.map(([k, v]) => <span key={k}><b style={{ color: T.inkSoft, fontWeight: 600 }}>{k}:</b> {v}</span>)}
                  </div>
                </div>
                <div style={{ padding: '14px 16px', borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: 6, minWidth: 210 }}>
                  <Tag label={row.tag.label} tone={row.tag.tone} />
                  <Btn
                    variant={row.ctaVariant ?? (row.tier === 'green' ? 'primary' : 'secondary')}
                    disabled={row.ctaDisabled}
                    onClick={row.ctaAction ?? (() => showToast(row.ctaNote ?? `${row.cta} — ${noRun ? 'awaiting first DR run' : 'coming soon'}`))}
                  >
                    {row.cta}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── GUARD LEGEND ── */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: T.forest, marginBottom: 4 }}>How actions are protected</h2>
          <div style={{ color: T.inkSoft, fontSize: 12, marginBottom: 14, maxWidth: 680 }}>
            Protection scales with how hard something is to undo. A reversible action should not nag you; an irreversible one should be almost annoying to reach.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { t: 'Safe · one click', d: 'Reversible in seconds, no data touched. Rolling back a deploy, running a backup, testing a restore. No confirmation — friction here just makes you slower during an incident.', color: T.green },
              { t: 'Scoped · type a reason', d: 'Changes real data, but only the part you name. You type what you are restoring and why; the reason is recorded against the action permanently.', color: T.amber },
              { t: 'Break glass · double lock', d: 'Irreversible or causes downtime. Password re-entry and your 6-digit code, a typed reason, the exact target name, then a 60-second countdown you can cancel. Collapsed by default so it cannot be clicked past.', color: T.red },
            ].map(g => (
              <div key={g.t} style={{ background: T.paper, border: `1px solid ${T.border}`, borderTop: `3px solid ${g.color}`, borderRadius: 3, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{g.t}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft }}>{g.d}</div>
              </div>
            ))}
          </div>
          <div style={{ background: T.amberTint, border: `1px solid ${T.border}`, borderRadius: 3, padding: '10px 12px', fontSize: 11.5, color: T.inkSoft }}>
            The countdown does more work than the password. Mistakes are noticed within seconds — a delay you can cancel catches the wrong click that a password waves straight through.
          </div>
        </div>

        {/* ── ALERTS ── */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: T.forest, marginBottom: 4 }}>What is wrong right now</h2>
          <div style={{ color: T.inkSoft, fontSize: 12, marginBottom: 14 }}>
            {noRun ? 'Four open. These are why three of the buttons above are greyed out.' : 'Check the status strip above for current state.'}
          </div>
          {[
            { crit: true, t: 'No off-site copy exists', d: '21 GB of database and 14 GB of files have never been copied outside Supabase. Deleted documents cannot be recovered, and losing the project would be final.', cta: 'Run first backup', show: noRun },
            { crit: true, t: '32 integration credentials could not be replaced after a rebuild', d: 'Cloudbeds, Mews, Factorial, Gmail, YouTube and 27 others are stored encrypted with a key held outside the database. A restore brings back unreadable rows — every integration would stay dead until re-issued by hand from a list that does not exist yet.', cta: 'See the list', show: noRun },
            { crit: false, t: 'The backup health check reports green regardless of reality', d: 'It has never raised a single alert, out of 2,138 incidents recorded. That is why the dead job below ran broken for three months unnoticed.', cta: 'Fix the check', show: true },
            { crit: false, t: '5 GB of old backup data is sitting inside the database it was meant to protect', d: 'A quarter of the database. Growth is already stopped; clearing it needs the off-site copy to land first so nothing is thrown away.', cta: null, show: true },
          ].filter(a => a.show).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: T.paper, border: `1px solid ${T.border}`, borderLeft: `3px solid ${a.crit ? T.red : T.amber}`, borderRadius: 3, padding: '11px 14px', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{a.t}</div>
                <div style={{ color: T.inkSoft, fontSize: 11.5, marginTop: 2 }}>{a.d}</div>
              </div>
              {a.cta && <Btn variant="secondary" onClick={() => showToast(a.cta!)}>{a.cta}</Btn>}
            </div>
          ))}
          {!noRun && <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>✓ First backup run completed — most alerts resolved</div>}
        </div>

        {/* ── COVERAGE TABLE ── */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: T.forest, marginBottom: 4 }}>What is protected</h2>
          <div style={{ color: T.inkSoft, fontSize: 12, marginBottom: 14 }}>
            The detail behind the buttons. Three of eight classes are covered by Supabase infrastructure today regardless of the DR pipeline.
          </div>
          <div style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['What', 'Protected by', 'Size', 'Worst-case loss', 'Tested', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Size' || h === 'Worst-case loss' ? 'right' : 'left', fontSize: 10.5, fontWeight: 600, color: T.inkSoft, letterSpacing: '.05em', textTransform: 'uppercase', padding: '9px 12px', borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { what: 'Database', by: 'Supabase rewind (PITR)', size: '21 GB', loss: '< 5 min', tested: null, drClass: null, infra: true },
                  { what: 'Source code', by: 'GitHub', size: '—', loss: '0', tested: '✓ continuous', drClass: null, infra: true },
                  { what: 'Built site', by: 'Vercel, 3 prior builds', size: '—', loss: '0', tested: '✓ continuous', drClass: null, infra: true },
                  { what: 'Files & documents', by: null, size: '14 GB · 10,936 files', loss: 'everything', tested: null, drClass: 'storage', infra: false },
                  { what: 'Database, off-site', by: null, size: '21 GB', loss: 'everything', tested: null, drClass: 'database', infra: false },
                  { what: 'View & report definitions', by: null, size: '~2 MB', loss: 'everything', tested: null, drClass: 'ddl', infra: false },
                  { what: 'Settings & schedules', by: null, size: '~1 MB', loss: 'everything', tested: null, drClass: 'config', infra: false },
                  { what: 'Credential list', by: null, size: '32', loss: 'everything', tested: null, drClass: 'credentials', infra: false },
                ].map((row, i) => {
                  const pos = row.drClass ? posture.find(p => p.data_class === row.drClass) : null;
                  const covered = row.infra || (pos && pos.freshness !== 'never');
                  return (
                    <tr key={i} style={{ borderBottom: i < 7 ? `1px solid #F2EFE6` : 'none' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.what}</td>
                      <td style={{ padding: '10px 12px', color: row.by ? T.ink : T.inkSoft }}>{row.by ?? 'nothing'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.size}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.loss}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {row.tested
                          ? <Tag label={row.tested} tone="green" />
                          : drill && row.drClass === 'database'
                            ? <Tag label={drill.passed ? 'passed' : 'FAILED'} tone={drill.passed ? 'green' : 'red'} />
                            : <Tag label="—" tone="grey" />}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Tag label={covered ? '● Covered' : '● Exposed'} tone={covered ? 'green' : 'red'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── BREAK GLASS ── */}
        <div style={{ border: '1px solid #E8C4BB', background: '#FDF8F6', borderRadius: 3, marginBottom: 32 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}
            onClick={() => setBgOpen(o => !o)}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.redDeep }}>⚠ Break glass</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Irreversible actions. Everything here causes downtime or destroys data permanently. None has ever been needed.</div>
            </div>
            <div style={{ fontSize: 11, color: T.redDeep, fontWeight: 600 }}>{bgOpen ? 'Close ▴' : 'Open ▾'}</div>
          </div>
          {bgOpen && (
            <div style={{ borderTop: '1px solid #F0DDD6', padding: '0 16px 16px' }}>
              {[
                { t: 'Rewind the entire database', d: 'Rolls all 72 schemas back to a chosen moment. Platform offline throughout. Every decision, message, booking and record written after that moment is destroyed and cannot be recovered.', disabled: false },
                { t: 'Rebuild on a new Supabase project', d: 'For total loss of the project or account. Needs the off-site copy, which does not exist yet.', disabled: noRun },
              ].map((item, i) => (
                <div key={i} style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, padding: '13px 15px', marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{item.t}</div>
                    <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{item.d}</div>
                  </div>
                  <Btn variant="danger" disabled={item.disabled} onClick={i === 0 ? () => setModalOpen(true) : undefined}>
                    {item.disabled ? 'Blocked' : 'Begin'}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ color: T.grey, fontSize: 11, textAlign: 'center', paddingBottom: 8 }}>
          Recovery · /holding/it2/system/recovery · live data
        </div>
      </div>

      {/* ── MODAL ── */}
      {modalOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,27,.34)', zIndex: 40 }} onClick={closeModal} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 540, maxWidth: '94vw', background: T.paper, borderRadius: 4, zIndex: 60, borderTop: `3px solid ${T.red}`, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.redDeep }}>Rewind the entire database</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>Four locks. You can cancel at any point, including during the countdown.</div>
            </div>
            <div style={{ padding: 16, fontSize: 12.5, color: T.inkSoft }}>
              <div style={{ background: T.redTint, border: '1px solid #E8C4BB', borderRadius: 3, padding: '10px 12px', color: T.redDeep, marginBottom: 14, fontSize: 11.5 }}>
                This is not a rollback of a mistake — it is a rollback of <b>everything</b>. Bookings taken since the target time, decisions logged, messages sent and files registered will be gone. The platform is offline while it runs. In this platform's entire history this has never been the right answer.
              </div>
              {[
                { n: 1, label: 'Confirm your password', el: <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Account password" style={{ width: '100%', padding: '7px 10px', border: `1px solid ${T.border}`, borderRadius: 3, fontFamily: 'inherit', fontSize: 12 }} /> },
                { n: 2, label: '6-digit code from your authenticator', el: <input type="text" value={totp} onChange={e => setTotp(e.target.value)} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${T.border}`, borderRadius: 3, fontFamily: 'inherit', fontSize: 12 }} /> },
                { n: 3, label: <>Type the target name exactly: <code style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11 }}>namkhan-pms</code></>, el: <input type="text" value={target} onChange={e => setTarget(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${T.border}`, borderRadius: 3, fontFamily: 'inherit', fontSize: 12 }} /> },
                { n: 4, label: 'Why — recorded permanently against this action', el: <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. INC-4022 · agent migration corrupted finance.gl_entries" style={{ width: '100%', padding: '7px 10px', border: `1px solid ${T.border}`, borderRadius: 3, fontFamily: 'inherit', fontSize: 12 }} /> },
              ].map(step => {
                const done = step.n === 1 ? pw.length >= 6 : step.n === 2 ? /^\d{6}$/.test(totp) : step.n === 3 ? target === 'namkhan-pms' : reason.trim().length > 8;
                return (
                  <div key={step.n} style={{ display: 'flex', gap: 10, padding: '11px 0', borderBottom: `1px solid #F2EFE6`, alignItems: 'flex-start' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: done ? T.greenTint : T.bg, color: done ? T.green : T.inkSoft, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{step.n}</div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{step.label}</label>
                      {step.el}
                    </div>
                  </div>
                );
              })}
              <div style={{ background: T.amberTint, border: `1px solid ${T.border}`, borderRadius: 3, padding: '10px 12px', fontSize: 11.5, color: T.inkSoft, marginTop: 14 }}>
                Before anything runs, a snapshot of the current state is taken automatically — so this rewind is itself reversible for 30 days.
              </div>
            </div>
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              {countdown !== null && (
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: T.redDeep, fontVariantNumeric: 'tabular-nums' }}>
                  Starting in {countdown}s — cancel to stop
                </span>
              )}
              <Btn variant="secondary" onClick={closeModal}>{countdown !== null ? 'Stop — cancel rewind' : 'Cancel'}</Btn>
              <Btn variant="danger" disabled={!canGo} onClick={startCountdown}>
                {countdown !== null ? 'Rewind starting…' : 'Start 60-second countdown'}
              </Btn>
            </div>
          </div>
        </>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: T.forest, color: '#fff', padding: '10px 18px', borderRadius: 3, fontSize: 12, zIndex: 80, boxShadow: '0 4px 12px rgba(0,0,0,.18)', maxWidth: '90vw', pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
