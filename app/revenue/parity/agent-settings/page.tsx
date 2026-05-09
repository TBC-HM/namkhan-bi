// /revenue/parity/agent-settings — read-only view of the parity agent metadata.
// Schedule + budget + status come from governance.agents.

import Page from '@/components/page/Page';
import { REVENUE_SUBPAGES } from '../../_subpages';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { supabase } from '@/lib/supabase';
import { fmtTableUsd, EMPTY } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

type AgentRow = {
  agent_id: string;
  code: string;
  name: string;
  status: string;
  schedule_human: string | null;
  schedule_cron: string | null;
  monthly_budget_usd: number | null;
  month_to_date_cost_usd: number | null;
  last_run_at: string | null;
  description: string | null;
  model_id: string | null;
};

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'active', beta: 'pending', planned: 'inactive', paused: 'inactive',
};

export default async function ParityAgentSettings() {
  const { data } = await supabase
    .schema('governance')
    .from('agents')
    .select('agent_id, code, name, status, schedule_human, schedule_cron, monthly_budget_usd, month_to_date_cost_usd, last_run_at, description, model_id')
    .eq('code', 'parity_agent')
    .maybeSingle();
  const a = (data as AgentRow | null) ?? null;
  const status = (a?.status ?? 'planned').toLowerCase();
  const budget = Number(a?.monthly_budget_usd ?? 0);
  const spent = Number(a?.month_to_date_cost_usd ?? 0);
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Agent code', value: <span style={mono}>{a?.code ?? EMPTY}</span> },
    { label: 'Display name', value: a?.name ?? EMPTY },
    { label: 'Status', value: <StatusPill tone={STATUS_TONE[status] ?? 'inactive'}>{status.toUpperCase()}</StatusPill> },
    { label: 'Schedule', value: <span style={mono}>{a?.schedule_human ?? 'manual only'}</span> },
    { label: 'Cron', value: <span style={mono}>{a?.schedule_cron ?? EMPTY}</span> },
    { label: 'Monthly budget', value: <span style={mono}>{budget > 0 ? fmtTableUsd(budget) : EMPTY}</span> },
    {
      label: 'Month-to-date cost',
      value: (
        <span style={mono}>
          {fmtTableUsd(spent)}
          {budget > 0 && (
            <span style={{ color: pct > 80 ? 'var(--st-bad)' : pct > 50 ? 'var(--brass)' : 'var(--ink-mute)', marginLeft: 6 }}>
              ({pct}%)
            </span>
          )}
        </span>
      ),
    },
    { label: 'Last run at', value: <span style={mono}>{a?.last_run_at ?? EMPTY}</span> },
    { label: 'Model', value: <span style={mono}>{a?.model_id ?? '—  (SQL-only, no LLM)'}</span> },
    { label: 'Description', value: <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-sm)', lineHeight: 1.5 }}>{a?.description ?? EMPTY}</span> },
  ];

  return (
    <Page eyebrow="Revenue · Parity · Agent" title="Agent metadata" subPages={REVENUE_SUBPAGES}>
      <div style={card}>
        <div style={cardHeader}>
          <div className="t-eyebrow">PARITY AGENT</div>
          <div style={cardTitle}>Configuration</div>
        </div>
        <table style={tbl}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td style={{ ...td, width: 220, color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase' }}>
                  {r.label}
                </td>
                <td style={td}>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

const card: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  marginTop: 14,
  overflow: 'hidden',
};
const cardHeader: React.CSSProperties = { padding: '18px 22px', borderBottom: '1px solid var(--paper-deep)' };
const cardTitle: React.CSSProperties = {
  fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, marginTop: 6,
};
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const td: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 'var(--t-sm)',
  color: 'var(--ink)',
  borderBottom: '1px solid var(--paper-deep)',
  verticalAlign: 'top',
};
const mono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' };
