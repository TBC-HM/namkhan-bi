// app/revenue/parity/page.tsx
//
// Parity Watchdog — Lighthouse-style date × OTA grid.
// Rewrite 2026-05-09 against the reference screenshot at
// `Desktop/Namkhan Bi repair.rtfd/Screenshot 2026-05-09 at 12.25.00.png`.
//
// Layout:
//   1. PageHeader (eyebrow + italic Fraunces title + sub-pages strip)
//   2. ParityFilterBar — Lighthouse filter row (member rate · lowest ·
//      device · LOS · guests · room · meal · refresh)
//   3. ParityGrid — date rows × OTA columns
//   4. (kept below) ParityCompactHeader — agent state + run button
//   5. (kept below) Open breaches table — actionable alert list
//
// Data: `public.v_parity_grid` (created 2026-05-09 via migration
// `create_v_parity_grid_2026_05_09`) plus the existing parity views.

import Page from '@/components/page/Page';
import { REVENUE_SUBPAGES } from '../_subpages';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { supabase } from '@/lib/supabase';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';

import ParityCompactHeader from './_components/ParityCompactHeader';
import ParityFilterBar from './_components/ParityFilterBar';
import ParityGrid, { type ParityGridRow } from './_components/ParityGrid';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

// ─── types ─────────────────────────────────────────────────────────────

type SeverityRow = {
  severity: string;
  open_critical: number;
  open_high: number;
  open_medium: number;
  open_low: number;
  open_total: number;
  detected_7d: number;
  detected_30d: number;
  last_detected_at: string | null;
};

type BreachRow = {
  breach_id: string;
  detected_at: string;
  shop_date: string;
  stay_date: string;
  severity: string;
  rule_code: string;
  rule_description: string | null;
  channel_a: string | null;
  channel_b: string | null;
  rate_a_usd: number | null;
  rate_b_usd: number | null;
  delta_usd: number | null;
  delta_pct: number | null;
  raw_room_type: string | null;
  raw_label_a: string | null;
  raw_label_b: string | null;
};

type AgentRow = {
  agent_id: string;
  code: string;
  name: string;
  status: string;
  schedule_human: string | null;
  monthly_budget_usd: number | null;
  month_to_date_cost_usd: number | null;
  last_run_at: string | null;
  runtime_settings: Record<string, unknown> | null;
};

type RunRow = {
  run_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  output: Record<string, unknown> | null;
};

const SEVERITY_TONE: Record<string, StatusTone> = {
  critical: 'expired',
  high:     'expired',
  medium:   'pending',
  low:      'inactive',
  info:     'inactive',
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 1, high: 2, medium: 3, low: 4, info: 5,
};

// ─── data load ─────────────────────────────────────────────────────────

async function loadAll() {
  const agentP = supabase
    .schema('governance')
    .from('agents')
    .select('agent_id, code, name, status, schedule_human, monthly_budget_usd, month_to_date_cost_usd, last_run_at, runtime_settings')
    .eq('code', 'parity_agent')
    .maybeSingle();

  const summaryP  = supabase.from('v_parity_summary').select('*');
  const breachesP = supabase.from('v_parity_open_breaches').select('*').limit(50);
  const gridP     = supabase
    .from('v_parity_grid')
    .select('*')
    .order('stay_date', { ascending: true });

  const agentR = await agentP;

  const runsP = supabase
    .schema('governance')
    .from('agent_runs')
    .select('run_id, status, started_at, finished_at, duration_ms, output')
    .eq('agent_id', agentR.data?.agent_id ?? '00000000-0000-0000-0000-000000000000')
    .order('started_at', { ascending: false })
    .limit(10);

  const [summaryR, breachesR, runsR, gridR] = await Promise.all([
    summaryP, breachesP, runsP, gridP,
  ]);

  return {
    agent:    (agentR.data ?? null) as AgentRow | null,
    summary:  ((summaryR.data ?? []) as SeverityRow[])[0] ?? null,
    breaches: (breachesR.data ?? []) as BreachRow[],
    runs:     (runsR.data ?? []) as RunRow[],
    grid:     (gridR.data ?? []) as ParityGridRow[],
  };
}

// ─── page ──────────────────────────────────────────────────────────────

export default async function ParityPage() {
  const data = await loadAll();
  const agent   = data.agent;
  const summary = data.summary;
  const lastRun = data.runs[0] ?? null;

  // Most recent shop date observed across the grid.
  const lastShopIso = data.grid
    .map((r) => r.last_shop_date)
    .filter((d): d is string => !!d)
    .sort()
    .pop() ?? null;
  const lastShopLabel = lastShopIso ? fmtIsoDate(lastShopIso) : EMPTY;

  return (
    <Page
      eyebrow="Revenue · Parity"
      title={<>Watch the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>price line</em>, close the leaks.</>}
      subPages={REVENUE_SUBPAGES}
    >
      {/* 1 · Filter bar — Lighthouse-style controls */}
      <div style={{ marginTop: 14 }}>
        <ParityFilterBar lastShopLabel={lastShopLabel} />
      </div>

      {/* 2 · Date × OTA grid (the screenshot) */}
      <div style={cardStyle}>
        <ParityGrid rows={data.grid} />
      </div>

      {/* 3 · Compact agent header — kept below the grid as ops detail */}
      <ParityCompactHeader
        agent={agent}
        lastRun={lastRun}
        summary={summary}
        settingsLinks={[
          { href: '/revenue/parity/scoring-settings', label: 'Scoring' },
          { href: '/revenue/parity/agent-settings',   label: 'Agent' },
        ]}
      />

      {/* 4 · Open breaches — actionable list */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div className="t-eyebrow">OPEN BREACHES</div>
          <div style={cardTitleStyle}>What needs your attention</div>
          <div style={legendStyle}>
            CRITICAL = non-refundable priced ABOVE refundable for the same room.
            MEDIUM/LOW = day-over-day rate moved &gt;{(agent?.runtime_settings as { rate_jump_warn_pct?: number } | null)?.rate_jump_warn_pct ?? 10}% vs prior shop.
          </div>
        </div>
        {data.breaches.length === 0 ? (
          <div style={emptyStyle}>
            <div style={emptyHeadline}>No open breaches.</div>
            <div style={emptySub}>Parity holds across all checks. Watchdog runs daily at 06:15 ICT.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={breachTableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Rule</th>
                  <th style={thStyle}>Stay</th>
                  <th style={thStyle}>Room</th>
                  <th style={thStyle}>Channel</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Rate A</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Rate B</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Δ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Δ%</th>
                  <th style={thStyle}>Detected</th>
                </tr>
              </thead>
              <tbody>
                {data.breaches
                  .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
                  .map((b) => (
                    <tr key={b.breach_id}>
                      <td style={tdStyle}>
                        <StatusPill tone={SEVERITY_TONE[b.severity] ?? 'inactive'}>
                          {b.severity.toUpperCase()}
                        </StatusPill>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink)' }}>
                          {b.rule_code}
                        </div>
                        {b.rule_description && (
                          <div style={ruleDescStyle}>{b.rule_description}</div>
                        )}
                        <div style={ruleLabelStyle}>
                          {b.raw_label_a ?? ''}{b.raw_label_b ? ' vs ' + b.raw_label_b : ''}
                        </div>
                      </td>
                      <td style={tdStyle}>{fmtIsoDate(b.stay_date)}</td>
                      <td style={tdStyle}>{b.raw_room_type ?? EMPTY}</td>
                      <td style={tdStyle}>
                        {(b.channel_a ?? EMPTY).toUpperCase()}
                        {b.channel_b && b.channel_b !== b.channel_a ? ' / ' + b.channel_b.toUpperCase() : ''}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtTableUsd(b.rate_a_usd)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtTableUsd(b.rate_b_usd)}
                      </td>
                      <td style={{
                        ...tdStyle,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: (b.delta_usd ?? 0) >= 0 ? 'var(--st-bad)' : 'var(--moss)',
                        fontWeight: 600,
                      }}>
                        {b.delta_usd != null
                          ? (b.delta_usd >= 0 ? '+' : '−') + fmtTableUsd(Math.abs(b.delta_usd))
                          : EMPTY}
                      </td>
                      <td style={{
                        ...tdStyle,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: (b.delta_pct ?? 0) >= 0 ? 'var(--st-bad)' : 'var(--moss)',
                      }}>
                        {b.delta_pct != null
                          ? (b.delta_pct >= 0 ? '+' : '−') + Math.abs(b.delta_pct).toFixed(1) + '%'
                          : EMPTY}
                      </td>
                      <td style={detectedStyle}>{fmtRelative(b.detected_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const t = new Date(iso);
  const ms = Date.now() - t.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  marginTop: 14,
  overflow: 'hidden',
};
const cardHeaderStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--paper-deep)',
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-xl)',
  fontWeight: 500,
  marginTop: 6,
  color: 'var(--ink)',
};
const legendStyle: React.CSSProperties = {
  marginTop: 8,
  color: 'var(--ink-faint)',
  fontSize: 'var(--t-xs)',
  fontFamily: 'var(--mono)',
  letterSpacing: 'var(--ls-loose)',
  lineHeight: 1.6,
};
const breachTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};
const thStyle: React.CSSProperties = {
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
const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 'var(--t-sm)',
  color: 'var(--ink)',
  borderBottom: '1px solid var(--paper-deep)',
  verticalAlign: 'top',
};
const ruleDescStyle: React.CSSProperties = {
  color: 'var(--ink-soft)',
  fontSize: 'var(--t-xs)',
  marginTop: 4,
  lineHeight: 1.4,
  maxWidth: 460,
};
const ruleLabelStyle: React.CSSProperties = {
  color: 'var(--ink-mute)',
  fontSize: 'var(--t-xs)',
  marginTop: 4,
  fontFamily: 'var(--mono)',
};
const detectedStyle: React.CSSProperties = {
  ...tdStyle,
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  color: 'var(--ink-mute)',
};
const emptyStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: 'var(--ink-mute)',
};
const emptyHeadline: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-xl)',
  color: 'var(--moss)',
};
const emptySub: React.CSSProperties = {
  marginTop: 6,
  fontSize: 'var(--t-sm)',
};
