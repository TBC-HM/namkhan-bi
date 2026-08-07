'use client';

// app/holding/it2/fleet/team/PillarsView.tsx
// Agent Team v2 — Slice 2 (brief agent-team-page-v2, ADR-227 discipline).
// Default view of /holding/it2/fleet/team: KPI row + filterable agent list
// + per-agent 4-pillar detail panels + health strip. Reads ONLY the two
// PostgREST bridges public.v_agent_pillars / public.v_fleet_team_kpis
// (claude_md §0.5 — no direct cockpit.*/governance.* reads).
//
// Known truths surfaced honestly (slice-1 findings, re-confirmed):
//  - Pillar-4 (triggers/budget) registry is mis-keyed: 0/10 triggers and
//    0/2 budgets match cockpit.id_agents. Decision filed with PBS via
//    fn_owner_question_ask; until answered, per-agent trigger/budget reads
//    0 and the panel says why.
//  - Run attribution: aud_audit_log.agent matches ~1/112 role handles, so
//    most health strips read 0. Shown with a caveat, not hidden.
//  - KPI agents_total (111) excludes 1 disabled agent; the pillars list
//    holds all 112. The list defaults to active-only so both agree.
// CTAs render but are disabled pending the fn_* SECURITY DEFINER write
// wrappers (slice 3) — no direct table writes from the browser, ever.

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Container, MetricRow } from '@/app/(cockpit)/_design';

export type PillarRow = {
  agent_id: string;
  role: string;
  display_name: string | null;
  department: string | null;
  property_id: number | null;
  scope_label: string | null;
  status: string | null;
  hierarchy_level: string | null;
  reports_to: string | null;
  prompt_versions: number;
  has_current_prompt: boolean;
  current_prompt_version: number | null;
  skills_enabled: number;
  skills_total: number;
  memories_active: number;
  memories_hard_rules: number;
  triggers_total: number;
  triggers_active: number;
  last_trigger_fired_at: string | null;
  daily_cap_usd: number | null;
  monthly_cap_usd: number | null;
  budget_enforced: boolean | null;
  last_run_at: string | null;
  runs_7d: number;
  failures_7d: number;
  spend_7d_usd: number | null;
  spend_mtd_usd: number | null;
  over_budget: boolean | null;
};

export type FleetKpis = {
  agents_total: number;
  agents_zero_skills: number;
  orphan_skills: number;
  agents_no_trigger: number;
  agents_over_budget: number;
  runs_7d: number;
};

type Props = { rows: PillarRow[]; kpis: FleetKpis | null };

const MONO = 'JetBrains Mono, ui-monospace, monospace';
const NAMKHAN = 260955;
const DONNA = 1000001;

type ScopeKey = 'all' | 'holding' | 'namkhan' | 'donna';

const SCOPES: { key: ScopeKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'holding', label: 'Holding' },
  { key: 'namkhan', label: 'Namkhan' },
  { key: 'donna', label: 'Donna' },
];

function inScope(r: PillarRow, s: ScopeKey): boolean {
  if (s === 'all') return true;
  if (s === 'holding') return r.property_id === null;
  if (s === 'namkhan') return r.property_id === NAMKHAN;
  return r.property_id === DONNA;
}

function fmtAgo(ts: string | null): string {
  if (!ts) return '—';
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 0) return 'now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtUsd(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return `$${Number(n).toFixed(2)}`;
}

export function PillarsView({ rows, kpis }: Props) {
  const [scope, setScope] = useState<ScopeKey>('all');
  const [dept, setDept] = useState<string>('all');
  const [q, setQ] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [openRole, setOpenRole] = useState<string | null>(null);

  const depts = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.department && s.add(r.department));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showDisabled && r.status === 'disabled') return false;
      if (!inScope(r, scope)) return false;
      if (dept !== 'all' && r.department !== dept) return false;
      if (needle) {
        const hay = `${r.role} ${r.display_name ?? ''} ${r.department ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, scope, dept, q, showDisabled]);

  const tiles = kpis
    ? [
        { label: 'Agents', value: kpis.agents_total, footnote: 'active (1 disabled hidden)' },
        {
          label: 'Zero-skill agents', value: kpis.agents_zero_skills,
          status: (kpis.agents_zero_skills > 0 ? 'amber' : 'green') as 'amber' | 'green',
        },
        {
          label: 'Orphan skills', value: kpis.orphan_skills,
          status: (kpis.orphan_skills > 0 ? 'amber' : 'green') as 'amber' | 'green',
          footnote: 'granted to no agent',
        },
        {
          label: 'No trigger', value: kpis.agents_no_trigger, status: 'red' as const,
          footnote: 'trigger registry mis-keyed — decision with PBS',
        },
        {
          label: 'Over budget', value: kpis.agents_over_budget,
          status: (kpis.agents_over_budget > 0 ? 'red' : 'green') as 'red' | 'green',
        },
        { label: 'Runs 7d', value: kpis.runs_7d },
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {kpis && <MetricRow tiles={tiles} size="sm" />}

      <Container title="Agent fleet" subtitle={`${filtered.length} of ${rows.length} agents`} density="compact">
        <div style={st.filterRow}>
          {SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              style={{ ...st.chip, ...(scope === s.key ? st.chipActive : null) }}
            >
              {s.label}
            </button>
          ))}
          <select value={dept} onChange={(e) => setDept(e.target.value)} style={st.select}>
            <option value="all">All departments</option>
            {depts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search role / name…"
            style={st.search}
          />
          <button onClick={() => setShowDisabled((v) => !v)} style={st.toggle}>
            {showDisabled ? 'HIDE DISABLED' : 'SHOW DISABLED'}
          </button>
        </div>

        <div style={st.attributionNote}>
          Health strip caveat: run attribution in the audit log matches only ~1 of 112 role
          handles today, so most per-agent run/spend figures read 0 until log naming is
          normalised (slice-1 finding #2). Fleet-wide runs 7d above is accurate.
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={st.table}>
            <thead>
              <tr>
                {['Agent', 'Dept', 'Scope', 'P1 Prompt', 'P2 Skills', 'P3 Memory', 'P4 Triggers·Budget', 'Last run', 'Runs 7d', 'Spend 7d'].map((h) => (
                  <th key={h} style={st.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <RowBlock
                  key={r.agent_id}
                  r={r}
                  open={openRole === r.role}
                  onToggle={() => setOpenRole(openRole === r.role ? null : r.role)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </div>
  );
}

function RowBlock({ r, open, onToggle }: { r: PillarRow; open: boolean; onToggle: () => void }) {
  const disabled = r.status === 'disabled';
  return (
    <>
      <tr onClick={onToggle} style={{ ...st.tr, opacity: disabled ? 0.5 : 1, cursor: 'pointer' }}>
        <td style={st.td}>
          <span style={{ fontWeight: 600 }}>{r.display_name ?? r.role}</span>
          <span style={st.roleTag}> {r.role}</span>
        </td>
        <td style={st.td}>{r.department ?? '—'}</td>
        <td style={st.td}>{r.scope_label ?? (r.property_id === null ? 'Holding' : String(r.property_id))}</td>
        <td style={st.td}>
          {r.has_current_prompt ? `v${r.current_prompt_version} (${r.prompt_versions} vers)` : <Bad>none</Bad>}
        </td>
        <td style={st.td}>
          {r.skills_enabled === 0 ? <Bad>0</Bad> : `${r.skills_enabled}/${r.skills_total}`}
        </td>
        <td style={st.td}>{r.memories_active} · {r.memories_hard_rules} hard</td>
        <td style={st.td}>
          {r.triggers_total === 0 ? <Muted>0 · no budget</Muted> : `${r.triggers_active}/${r.triggers_total} · ${fmtUsd(r.daily_cap_usd)}/d`}
        </td>
        <td style={st.td}>{fmtAgo(r.last_run_at)}</td>
        <td style={st.td}>{r.runs_7d}{r.failures_7d > 0 ? <Bad> · {r.failures_7d} fail</Bad> : ''}</td>
        <td style={st.td}>{fmtUsd(r.spend_7d_usd)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={10} style={{ padding: 0, borderBottom: '1px solid #E6DFCC' }}>
            <PillarPanels r={r} />
          </td>
        </tr>
      )}
    </>
  );
}

function PillarPanels({ r }: { r: PillarRow }) {
  return (
    <div style={st.panelGrid}>
      <div style={st.panel}>
        <div style={st.panelTitle}>1 · Identity & instructions</div>
        <Fact k="Status" v={r.status ?? '—'} />
        <Fact k="Hierarchy" v={r.hierarchy_level ?? '—'} />
        <Fact k="Reports to" v={r.reports_to ?? '—'} />
        <Fact k="Prompt" v={r.has_current_prompt ? `current v${r.current_prompt_version} · ${r.prompt_versions} versions` : 'NO CURRENT PROMPT'} />
        <div style={st.ctaRow}>
          <Cta label="Edit prompt" />
          <Cta label="Set trust" />
          <Cta label={r.status === 'disabled' ? 'Enable' : 'Disable'} />
        </div>
      </div>
      <div style={st.panel}>
        <div style={st.panelTitle}>2 · Skills & tools</div>
        <Fact k="Enabled" v={`${r.skills_enabled} of ${r.skills_total} granted`} />
        <div style={{ marginTop: 6 }}>
          <Link href={`/holding/it2/fleet/team/agent/${encodeURIComponent(r.role)}`} style={st.link}>
            Full skill list & debug →
          </Link>
        </div>
        <div style={st.ctaRow}>
          <Cta label="Add skill" />
          <Cta label="Revoke" />
          <Cta label="Propose new" />
          <Cta label="Test-run" />
        </div>
      </div>
      <div style={st.panel}>
        <div style={st.panelTitle}>3 · Memory</div>
        <Fact k="Active memories" v={String(r.memories_active)} />
        <Fact k="Hard rules (imp ≥ 8)" v={String(r.memories_hard_rules)} />
        <div style={st.ctaRow}>
          <Cta label="Add memory" />
          <Cta label="Edit" />
          <Cta label="Archive" />
        </div>
      </div>
      <div style={st.panel}>
        <div style={st.panelTitle}>4 · Triggers & budget</div>
        <Fact k="Triggers" v={`${r.triggers_active} active / ${r.triggers_total}`} />
        <Fact k="Daily cap" v={fmtUsd(r.daily_cap_usd)} />
        <Fact k="Monthly cap" v={fmtUsd(r.monthly_cap_usd)} />
        <Fact k="Spend MTD" v={fmtUsd(r.spend_mtd_usd)} />
        {r.over_budget ? <div style={{ color: '#B4231F', fontSize: 12, fontWeight: 600 }}>OVER BUDGET</div> : null}
        <div style={st.blockNote}>
          Trigger/budget registry is keyed to a diverged agent registry (0/10 triggers match).
          Re-key decision is filed with PBS — CTAs unlock once answered.
        </div>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '2px 0' }}>
      <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>{k}</span>
      <span style={{ fontFamily: MONO }}>{v}</span>
    </div>
  );
}

function Cta({ label }: { label: string }) {
  return (
    <button
      disabled
      title="Write wrapper ships in slice 3 — all writes go through audited public.fn_* only"
      style={st.cta}
    >
      {label}
    </button>
  );
}

function Bad({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#B4231F', fontWeight: 600 }}>{children}</span>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>{children}</span>;
}

const st: Record<string, CSSProperties> = {
  filterRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  chip: { background: 'transparent', border: '1px solid #E6DFCC', borderRadius: 999, padding: '4px 12px',
    fontSize: 12, cursor: 'pointer', color: 'var(--ink-soft, #5A5A5A)', fontFamily: 'inherit' },
  chipActive: { background: '#F4EFE2', color: 'var(--primary, #1F3A2E)', fontWeight: 600,
    borderColor: 'var(--primary, #1F3A2E)' },
  select: { border: '1px solid #E6DFCC', borderRadius: 4, padding: '4px 8px', fontSize: 12,
    fontFamily: 'inherit', background: '#FFF', color: 'var(--ink, #1B1B1B)' },
  search: { border: '1px solid #E6DFCC', borderRadius: 4, padding: '4px 8px', fontSize: 12,
    fontFamily: 'inherit', minWidth: 180 },
  toggle: { marginLeft: 'auto', background: 'transparent', border: '1px solid #E6DFCC',
    borderRadius: 4, padding: '4px 10px', fontSize: 11, fontFamily: MONO, letterSpacing: 0.4,
    color: 'var(--ink-soft, #5A5A5A)', cursor: 'pointer' },
  attributionNote: { fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', background: '#F4EFE2',
    border: '1px solid #E6DFCC', borderRadius: 4, padding: '6px 10px', marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #E6DFCC', fontSize: 10,
    fontFamily: MONO, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)',
    whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #F0EADC' },
  td: { padding: '6px 8px', whiteSpace: 'nowrap' },
  roleTag: { fontFamily: MONO, fontSize: 10, color: 'var(--ink-soft, #5A5A5A)' },
  panelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
    padding: 12, background: '#FBF8F0' },
  panel: { background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, padding: 12 },
  panelTitle: { fontSize: 11, fontFamily: MONO, letterSpacing: 0.5, textTransform: 'uppercase',
    color: 'var(--primary, #1F3A2E)', fontWeight: 700, marginBottom: 8 },
  ctaRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  cta: { border: '1px solid #E6DFCC', background: '#F4EFE2', borderRadius: 4, padding: '3px 10px',
    fontSize: 11, fontFamily: 'inherit', color: 'var(--ink-soft, #5A5A5A)', cursor: 'not-allowed' },
  blockNote: { fontSize: 11, color: '#8A6D1D', background: '#FBF4DD', border: '1px solid #EADFB8',
    borderRadius: 4, padding: '6px 8px', marginTop: 10 },
  link: { fontSize: 12, color: 'var(--primary, #1F3A2E)', textDecoration: 'underline' },
};
