// /revenue/parity/scoring-settings — read-only view of the parity rule thresholds.
// Lives in governance.agents.runtime_settings on parity_agent.

import PageHeader from '@/components/layout/PageHeader';
import { supabase } from '@/lib/supabase';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

type AgentRow = {
  agent_id: string;
  code: string;
  name: string;
  runtime_settings: Record<string, unknown> | null;
};

async function loadAgent(): Promise<AgentRow | null> {
  const { data } = await supabase
    .schema('governance')
    .from('agents')
    .select('agent_id, code, name, runtime_settings')
    .eq('code', 'parity_agent')
    .maybeSingle();
  return (data as AgentRow | null) ?? null;
}

export default async function ParityScoringSettings() {
  const agent = await loadAgent();
  const rs = (agent?.runtime_settings ?? {}) as Record<string, unknown>;
  const rows: { key: string; label: string; value: unknown; hint: string }[] = [
    {
      key: 'rate_jump_warn_pct',
      label: 'Rate-jump warning threshold',
      value: rs.rate_jump_warn_pct ?? 10,
      hint: 'Day-over-day rate change above this fires a LOW breach.',
    },
    {
      key: 'rate_jump_alert_pct',
      label: 'Rate-jump alert threshold',
      value: rs.rate_jump_alert_pct ?? 25,
      hint: 'Day-over-day rate change above this fires a MEDIUM breach.',
    },
    {
      key: 'critical_only_above',
      label: 'Critical floor (USD)',
      value: rs.critical_only_above ?? 0,
      hint: 'Suppress non-refund>refund breaches when delta is below this $ amount.',
    },
    {
      key: 'pp_undercut_pct',
      label: 'OTA-vs-direct undercut threshold (Phase 2)',
      value: rs.pp_undercut_pct ?? 5,
      hint: 'OTA priced below direct by this % fires a CRITICAL breach. Not yet active.',
    },
  ];

  return (
    <>
      <PageHeader
        pillar="Revenue"
        tab="Parity · Scoring"
        title="Rule thresholds"
        lede="What counts as a breach. Edit thresholds via SQL on governance.agents.runtime_settings until UI is built."
      />
      <div style={card}>
        <div style={cardHeader}>
          <div className="t-eyebrow">RULE THRESHOLDS</div>
          <div style={cardTitle}>Configured on parity_agent</div>
        </div>
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>SETTING</th>
              <th style={{ ...th, textAlign: 'right' }}>VALUE</th>
              <th style={th}>WHAT IT DOES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td style={td}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' }}>{r.label}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>
                    {r.key}
                  </div>
                </td>
                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', fontWeight: 600 }}>
                  {String(r.value)}
                </td>
                <td style={{ ...td, fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', maxWidth: 460, lineHeight: 1.5 }}>
                  {r.hint}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const card: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  marginTop: 14,
  overflow: 'hidden',
};
const cardHeader: React.CSSProperties = {
  padding: '18px 22px',
  borderBottom: '1px solid var(--paper-deep)',
};
const cardTitle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-xl)',
  fontWeight: 500,
  marginTop: 6,
};
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  borderBottom: '1px solid var(--paper-deep)',
  fontWeight: 600,
  background: 'var(--paper-deep)',
};
const td: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 'var(--t-sm)',
  color: 'var(--ink)',
  borderBottom: '1px solid var(--paper-deep)',
  verticalAlign: 'top',
};
