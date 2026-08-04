'use client';
// app/holding/it2/modules/specs/SpecsExplorer.tsx
// modules-specs-redesign-v1 (PBS 2026-08-04): department subtabs + audience
// toggle + compact expandable rows. Kills the endless-scroll card wall.
// - Dept subtabs with count badges + per-tab "needs you" red badge
// - Audience toggle: Owner/staff (default) vs Backend/tech — never mixed
// - Compact rows (module · SPEC/TESTED · findings · stage · last audit),
//   click to expand to the full card
// - Last tab + audience remembered (localStorage), "new since your last
//   visit" dot per tab (localStorage timestamps, effect-driven — rule 712:
//   no Date.now() in render path, all of this resolves post-hydration)
// - Scope 3 card extras: UNPROVEN shrunk to chip w/ tooltip, audit box with
//   post-audit delta, Re-audit flips card to "queued for audit" instantly.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

export type ModuleRow = {
  docType: string;
  title: string;
  version: number;
  docStatus: string;
  department: string;
  audience: 'owner' | 'staff' | 'backend';
  specPct: number | null;
  testedPct: number | null;
  testOk: number;
  testTarget: number | null;
  frozen: boolean;
  signedOff: boolean;
  live: boolean;
  nRed: number;   // restated — waiting for PBS confirm (HIS move)
  nBlue?: number; // filed — with agents, restatement pending (optional: push-order 759, intermediate commit stays green)
  nAmber: number; // confirmed / acknowledged — in build
  gapList: { gap?: string; weight_pct?: number }[];
  stageDone: number;
  stageActive: string;
  stageAlert: boolean;
  completionEstimate: number | null;
  briefSlug: string | null;
  briefStatus: string | null;
  entryUrl: string | null;
  lastUpdated: string | null;     // preformatted, server
  lastUpdatedIso: string | null;  // for new-since-visit dot
  auditDate: string | null;       // preformatted queue.updated_at
  prevSpec: number | null;        // from last consumed reaudit signal payload
  gapsClosed: number | null;
  ctaLabel: string;
  ctaHref?: string;
  ctaRpc?: 'sign_off' | 'reaudit';
  ctaTone: 'red' | 'green' | 'gold' | 'grey';
  needsYou: boolean;
  unregistered: boolean;
};

const DEPTS: { key: string; label: string }[] = [
  { key: 'holding',     label: 'Holding' },
  { key: 'finance',     label: 'Finance' },
  { key: 'revenue',     label: 'Revenue' },
  { key: 'sales',       label: 'Sales' },
  { key: 'marketing',   label: 'Marketing' },
  { key: 'ops',         label: 'Ops' },
  { key: 'guest',       label: 'Guest' },
  { key: 'it_platform', label: 'IT / Platform' },
];

const STAGES = ['Audit', 'Spec', 'Repair', 'Check', 'Testing', 'Frozen'];

const CTA_TONE: Record<string, { bg: string; color: string }> = {
  red:   { bg: '#B71C1C', color: '#FFFFFF' },
  green: { bg: '#1F3A2E', color: '#FFFFFF' },
  gold:  { bg: '#B8A878', color: '#1B1B1B' },
  grey:  { bg: '#F0EBE0', color: '#5A5A5A' },
};

const LS_TAB = 'it2_specs_tab_v1';
const LS_AUD = 'it2_specs_audience_v1';
const LS_SEEN = 'it2_specs_seen_v1'; // { [tabKey]: iso }

function PipelineStrip({ m }: { m: ModuleRow }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {STAGES.map((label, i) => {
          const isDone = i <= m.stageDone;
          const isNext = i === m.stageDone + 1;
          return (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: 3, borderRadius: 99,
                background: isDone ? '#2E7D32' : isNext ? (m.stageAlert ? '#B71C1C' : '#B8A878') : '#F0EBE0' }} />
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                color: isDone ? '#2E7D32' : isNext ? (m.stageAlert ? '#B71C1C' : '#8A8A8A') : '#C9C2B2' }}>{label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: m.stageAlert ? '#B71C1C' : '#5A5A5A', marginTop: 2 }}>
        {m.stageActive}{m.completionEstimate != null ? ` · agent-audited: ${m.completionEstimate}% complete` : ''}
      </div>
    </div>
  );
}

function MiniBar({ pct, thresholds }: { pct: number | null; thresholds: [number, number] }) {
  const v = pct ?? 0;
  return (
    <div style={{ width: 46, height: 4, background: '#F0EBE0', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ height: '100%', width: `${v}%`, borderRadius: 99,
        background: v >= thresholds[0] ? '#2E7D32' : v >= thresholds[1] ? '#F57F17' : '#D32F2F' }} />
    </div>
  );
}

// Scope 3: FROZEN prominent; UNPROVEN shrinks to a small chip with tooltip.
function TruthChip({ frozen, compact }: { frozen: boolean; compact?: boolean }) {
  if (frozen) {
    return (
      <span style={{ fontSize: compact ? 9 : 10, fontWeight: 700, padding: compact ? '1px 7px' : '2px 10px',
        borderRadius: 99, background: '#E8F5E9', color: '#2E7D32', whiteSpace: 'nowrap' }}>
        🧊 FROZEN
      </span>
    );
  }
  return (
    <span title="FROZEN needs: tests + zero blocking findings + owner sign-off"
      style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
        background: '#FFF8EE', color: '#B26A00', border: '1px dashed #E8CFA0', cursor: 'help', whiteSpace: 'nowrap' }}>
      unproven
    </span>
  );
}

function ModuleCard({ m, signOffAction, reauditAction, queued, onReaudit }: {
  m: ModuleRow;
  signOffAction: (fd: FormData) => Promise<void>;
  reauditAction: (fd: FormData) => Promise<void>;
  queued: boolean;
  onReaudit: (docType: string) => void;
}) {
  const tone = CTA_TONE[m.ctaTone];
  const stageActive = queued ? 'queued for audit' : m.stageActive;
  return (
    <div style={{ background: '#FFFFFF', borderTop: '1px dashed #E6DFCC', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* SPEC vs TESTED split (ADR-218) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#8A8A8A', width: 38 }}>SPEC</span>
        <div style={{ flex: 1, height: 4, background: '#F0EBE0', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${m.specPct ?? 0}%`, borderRadius: 99,
            background: (m.specPct ?? 0) >= 80 ? '#2E7D32' : (m.specPct ?? 0) >= 50 ? '#F57F17' : '#D32F2F' }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: m.specPct == null ? '#B71C1C' : '#5A5A5A' }}>
          {m.specPct == null ? 'no audit yet' : `${m.specPct}%`}
        </span>
        {m.live && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px',
          borderRadius: 99, background: '#E8F5E9', color: '#2E7D32' }}>live</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#8A8A8A', width: 38 }}>TESTED</span>
        <div style={{ flex: 1, height: 4, background: '#F0EBE0', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${m.testedPct ?? 0}%`, borderRadius: 99,
            background: (m.testedPct ?? 0) >= 100 ? '#2E7D32' : (m.testedPct ?? 0) > 0 ? '#F57F17' : '#D32F2F' }} />
        </div>
        {m.testTarget == null ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#B26A00' }}>no test target</span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: m.testOk === 0 ? '#B71C1C' : '#5A5A5A' }}>
            {m.testedPct ?? 0}% · {m.testOk}/{m.testTarget} runs
          </span>
        )}
      </div>
      {/* Scope 3 audit box: date · by · SPEC n% + post-audit delta */}
      {m.auditDate && (
        <div style={{ fontSize: 10, color: '#5A5A5A', background: '#FAFAF7', border: '1px solid #F0EBE0',
          borderRadius: 4, padding: '5px 8px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 700 }}>Last audit: {m.auditDate} · module-auditor{m.specPct != null ? ` · SPEC ${m.specPct}%` : ''}</span>
          {m.prevSpec != null && m.specPct != null && m.prevSpec !== m.specPct && (
            <span style={{ color: m.specPct > m.prevSpec ? '#2E7D32' : '#B71C1C', fontWeight: 600 }}>
              was {m.prevSpec}% → now {m.specPct}%{m.gapsClosed != null && m.gapsClosed > 0 ? `, gaps closed ${m.gapsClosed}` : ''}
            </span>
          )}
        </div>
      )}
      {/* Gap chips (bug #88: % without gap list is meaningless) */}
      {Array.isArray(m.gapList) && m.gapList.length > 0 ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: -2 }}>
          {m.gapList.slice(0, 3).map((g, i) => (
            <span key={i} title={String(g?.gap ?? '')} style={{
              fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
              background: '#FDECE4', color: '#B04A2F', maxWidth: 220, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
              −{g?.weight_pct ?? '?'}% · {String(g?.gap ?? '').slice(0, 60)}
            </span>
          ))}
          {m.gapList.length > 3 && <span style={{ fontSize: 9, color: '#8A8A8A' }}>+{m.gapList.length - 3} more</span>}
        </div>
      ) : m.specPct != null && m.specPct < 100 ? (
        <div style={{ fontSize: 9, color: '#B8A878', marginTop: -2 }}>no gap data · ⟳ re-audit to populate</div>
      ) : null}
      <PipelineStrip m={{ ...m, stageActive }} />
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1B1B1B', lineHeight: 1.4 }}>{m.title}</div>
      <div style={{ fontSize: 11, color: '#8A8A8A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span>v{m.version} · {m.signedOff ? 'signed off' : m.docStatus}{m.lastUpdated ? ` · ${m.lastUpdated}` : ''}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {queued ? (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 3,
              background: '#FFF3E0', color: '#B26A00' }}>⏳ queued for audit</span>
          ) : m.ctaHref ? (
            <Link href={m.ctaHref} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px',
              borderRadius: 3, background: tone.bg, color: tone.color, textDecoration: 'none' }}>
              {m.ctaLabel}
            </Link>
          ) : m.ctaRpc ? (
            <form action={m.ctaRpc === 'sign_off' ? signOffAction : reauditAction} style={{ margin: 0 }}
              onSubmit={m.ctaRpc === 'reaudit' ? () => onReaudit(m.docType) : undefined}>
              <input type="hidden" name="doc_type" value={m.docType} />
              <button type="submit" style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px',
                borderRadius: 3, background: tone.bg, color: tone.color, border: 'none', cursor: 'pointer' }}>
                {m.ctaLabel}
              </button>
            </form>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px',
              borderRadius: 3, background: tone.bg, color: tone.color }}>{m.ctaLabel}</span>
          )}
          {/* Re-audit is always reachable from the expanded card (scope 3) */}
          {!queued && m.ctaRpc !== 'reaudit' && (
            <form action={reauditAction} style={{ margin: 0 }} onSubmit={() => onReaudit(m.docType)}>
              <input type="hidden" name="doc_type" value={m.docType} />
              <button type="submit" title="Ask the auditor to re-grade this module now"
                style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 3,
                  border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#1B1B1B', cursor: 'pointer' }}>
                ⟳ Re-audit
              </button>
            </form>
          )}
          {m.entryUrl && (
            <Link href={m.entryUrl} title="Open the module's live page" style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px',
              borderRadius: 3, background: '#1F3A2E', color: '#FFFFFF', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              ↗ Open
            </Link>
          )}
          {/* PBS 2026-08-04 #2 (bf42dff, re-ported): THREE states — whose move:
              red=confirm(PBS), blue=with agents, amber=in build */}
          <Link href={`/holding/it2/modules/findings/${encodeURIComponent(m.docType)}`}
            style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 3,
              background: m.nRed > 0 ? '#B71C1C' : (m.nBlue ?? 0) > 0 ? '#E3F2FD' : m.nAmber > 0 ? '#FFF3E0' : '#FFFFFF',
              color: m.nRed > 0 ? '#FFFFFF' : (m.nBlue ?? 0) > 0 ? '#1565C0' : m.nAmber > 0 ? '#B26A00' : '#1B1B1B',
              border: m.nRed > 0 ? '1px solid #B71C1C' : (m.nBlue ?? 0) > 0 ? '1px solid #90CAF9' : m.nAmber > 0 ? '1px solid #E8A13C' : '1px solid #E6DFCC',
              textDecoration: 'none', whiteSpace: 'nowrap' }}
            title={m.nRed > 0 ? `${m.nRed} restated — waiting for YOUR confirm` : (m.nBlue ?? 0) > 0 ? `${m.nBlue ?? 0} filed — with agents, restatement pending` : m.nAmber > 0 ? `${m.nAmber} confirmed — in build` : 'Owner findings — file feedback on this module'}>
            ⚑ {m.nRed > 0 ? `${m.nRed} confirm` : (m.nBlue ?? 0) > 0 ? `${m.nBlue ?? 0} with agents` : m.nAmber > 0 ? `${m.nAmber} in build` : 'Findings'}{m.nRed > 0 && ((m.nBlue ?? 0) + m.nAmber) > 0 ? ` +${(m.nBlue ?? 0) + m.nAmber}` : (m.nBlue ?? 0) > 0 && m.nAmber > 0 ? ` +${m.nAmber}` : ''}
          </Link>
          {m.briefSlug && (
            <Link href={`/holding/it2/modules/briefs/${m.briefSlug}`} title="Refine the goal / read the brief"
              style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 3,
                border: '1px solid #E6DFCC', color: '#1B1B1B', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              ✎ Goal
            </Link>
          )}
          <Link href={`/holding/it2/modules/specs/${encodeURIComponent(m.docType)}`} title="Read the spec document"
            style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 3,
              border: '1px solid #E6DFCC', color: '#1B1B1B', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            📄 Spec
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SpecsExplorer({ modules, signOffAction, reauditAction }: {
  modules: ModuleRow[];
  signOffAction: (fd: FormData) => Promise<void>;
  reauditAction: (fd: FormData) => Promise<void>;
}) {
  const [tab, setTab] = useState<string>('holding');
  const [backend, setBackend] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [queuedNow, setQueuedNow] = useState<Record<string, boolean>>({});
  const [newDots, setNewDots] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  // Restore last tab + audience; compute per-tab "new since your last visit"
  // dots. All localStorage work happens post-hydration (rule 712-safe).
  useEffect(() => {
    try {
      const savedTab = window.localStorage.getItem(LS_TAB);
      if (savedTab && DEPTS.some(d => d.key === savedTab)) setTab(savedTab);
      const savedAud = window.localStorage.getItem(LS_AUD);
      if (savedAud === 'backend') setBackend(true);
      const seen: Record<string, string> = JSON.parse(window.localStorage.getItem(LS_SEEN) ?? '{}');
      const dots: Record<string, boolean> = {};
      for (const d of DEPTS) {
        const last = seen[d.key];
        dots[d.key] = modules.some(m => m.department === d.key && m.lastUpdatedIso != null
          && (!last || m.lastUpdatedIso > last));
      }
      setNewDots(dots);
    } catch { /* localStorage unavailable — degrade quietly */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark the active tab as seen (clears its dot for next visit).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(LS_TAB, tab);
      const seen: Record<string, string> = JSON.parse(window.localStorage.getItem(LS_SEEN) ?? '{}');
      seen[tab] = new Date().toISOString();
      window.localStorage.setItem(LS_SEEN, JSON.stringify(seen));
      setNewDots(d => ({ ...d, [tab]: false }));
    } catch { /* ignore */ }
  }, [tab, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(LS_AUD, backend ? 'backend' : 'owner_staff'); } catch { /* ignore */ }
  }, [backend, hydrated]);

  const inAudience = useMemo(
    () => modules.filter(m => backend ? m.audience === 'backend' : m.audience !== 'backend'),
    [modules, backend]);

  const byDept = useMemo(() => {
    const map: Record<string, ModuleRow[]> = {};
    for (const d of DEPTS) map[d.key] = [];
    for (const m of inAudience) (map[m.department] ?? (map[m.department] = [])).push(m);
    return map;
  }, [inAudience]);

  const rows = byDept[tab] ?? [];

  return (
    <section style={{ marginBottom: 36 }}>
      {/* Audience toggle — Owner/staff default; backend never mixed in (A2) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', margin: 0, letterSpacing: '0.04em' }}>
          MODULE SPECS ({inAudience.length})
        </h2>
        <div style={{ display: 'flex', border: '1px solid #E6DFCC', borderRadius: 99, overflow: 'hidden' }}>
          {[{ v: false, label: 'Owner / staff' }, { v: true, label: 'Backend / tech' }].map(o => (
            <button key={o.label} type="button" onClick={() => setBackend(o.v)}
              style={{ fontSize: 10, fontWeight: 700, padding: '5px 14px', border: 'none', cursor: 'pointer',
                background: backend === o.v ? '#1F3A2E' : '#FFFFFF', color: backend === o.v ? '#FFFFFF' : '#5A5A5A' }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Department subtabs with count + needs-you badges + new-dot */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {DEPTS.map(d => {
          const list = byDept[d.key] ?? [];
          const needs = list.filter(m => m.needsYou).length;
          const active = tab === d.key;
          return (
            <button key={d.key} type="button" onClick={() => setTab(d.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
                padding: '6px 12px', borderRadius: 5, cursor: 'pointer',
                border: active ? '1px solid #1F3A2E' : '1px solid #E6DFCC',
                background: active ? '#1F3A2E' : '#FFFFFF',
                color: active ? '#FFFFFF' : list.length === 0 ? '#B8B2A2' : '#1B1B1B' }}>
              {newDots[d.key] && <span title="new since your last visit"
                style={{ width: 6, height: 6, borderRadius: 99, background: '#B8542A', display: 'inline-block' }} />}
              {d.label}
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                background: active ? 'rgba(255,255,255,0.18)' : '#F4EFE2',
                color: active ? '#FFFFFF' : '#5A5A5A' }}>{list.length}</span>
              {needs > 0 && (
                <span title={`${needs} module(s) need you in ${d.label}`}
                  style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                    background: '#B71C1C', color: '#FFFFFF' }}>{needs}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Compact rows, expandable to the full card */}
      <div style={{ border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden', background: '#FFFFFF' }}>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8A8A8A', padding: '18px 16px' }}>
            No {backend ? 'backend/tech' : 'owner/staff'} modules in {DEPTS.find(d => d.key === tab)?.label ?? tab}.
            {backend ? '' : ' Machine-registered plumbing lives under Backend / tech.'}
          </div>
        ) : rows.map((m, i) => {
          const isOpen = !!expanded[m.docType];
          const queued = !!queuedNow[m.docType];
          const stageActive = queued ? 'queued for audit' : m.stageActive;
          return (
            <div key={m.docType} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F0EBE0' : 'none' }}>
              <button type="button" onClick={() => setExpanded(e => ({ ...e, [m.docType]: !isOpen }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  padding: '9px 12px', background: isOpen ? '#FAFAF7' : '#FFFFFF', border: 'none', cursor: 'pointer' }}>
                <span style={{ fontSize: 10, color: '#8A8A8A', width: 10, flexShrink: 0 }}>{isOpen ? '▾' : '▸'}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1B1B1B', width: 170, flexShrink: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={m.title}>
                  {m.docType.replace(/_module$/, '').replace(/_/g, ' ')}
                </span>
                <TruthChip frozen={m.frozen} compact />
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: '#8A8A8A' }}>SPEC</span>
                  <MiniBar pct={m.specPct} thresholds={[80, 50]} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: m.specPct == null ? '#B71C1C' : '#5A5A5A', width: 30 }}>
                    {m.specPct == null ? '—' : `${m.specPct}%`}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: '#8A8A8A' }}>TESTED</span>
                  <MiniBar pct={m.testedPct} thresholds={[100, 1]} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: (m.testedPct ?? 0) === 0 ? '#B71C1C' : '#5A5A5A', width: 30 }}>
                    {m.testedPct == null ? '—' : `${m.testedPct}%`}
                  </span>
                </span>
                {(m.nRed > 0 || (m.nBlue ?? 0) > 0 || m.nAmber > 0) && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 99, flexShrink: 0,
                    background: m.nRed > 0 ? '#B71C1C' : (m.nBlue ?? 0) > 0 ? '#E3F2FD' : '#FFF3E0',
                    color: m.nRed > 0 ? '#FFFFFF' : (m.nBlue ?? 0) > 0 ? '#1565C0' : '#B26A00' }}>
                    ⚑ {m.nRed > 0 ? `${m.nRed} confirm` : (m.nBlue ?? 0) > 0 ? `${m.nBlue ?? 0} with agents` : `${m.nAmber} in build`}
                  </span>
                )}
                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, textAlign: 'right',
                  color: queued ? '#B26A00' : m.stageAlert ? '#B71C1C' : '#5A5A5A',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {stageActive}
                </span>
                <span style={{ fontSize: 9.5, color: '#8A8A8A', width: 92, textAlign: 'right', flexShrink: 0 }}>
                  {m.auditDate ? `audited ${m.auditDate}` : 'never audited'}
                </span>
              </button>
              {isOpen && (
                <ModuleCard m={m} signOffAction={signOffAction} reauditAction={reauditAction}
                  queued={queued} onReaudit={dt => setQueuedNow(q => ({ ...q, [dt]: true }))} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
