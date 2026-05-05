// app/revenue/parity/page.tsx
//
// Parity Watchdog — detects rate-parity breaches across channels for The Namkhan.
// v1 (2026-05-04): internal-BDC parity only (refundable vs non-refundable consistency
// + day-over-day rate jumps). OTA-vs-OTA + OTA-vs-direct ship in Phase 2 once
// Expedia/Trip/Direct parsers exist.
//
// Layout mirrors /revenue/compset:
//   1. PageHeader
//   2. TopStrip — agent status, last check, open breaches, criticals
//   3. Util bar — settings + manual run
//   4. Open breaches table (the actionable list)
//   5. 30-day trend strip
//   6. Agent run history
//   7. Roadmap / what's measured today

import PageHeader from '@/components/layout/PageHeader';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { supabase } from '@/lib/supabase';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import ParityCompactHeader from './_components/ParityCompactHeader';
import ParityGraphs from './_components/ParityGraphs';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

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
  property_name: string;
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

type TrendRow = { day: string; severity: string; n: number };

type MatrixRow = {
  stay_date: string;
  namkhan_usd: number | null;
  namkhan_shop_date: string | null;
  comp_median_usd: number | null;
  comp_lowest_usd: number | null;
  comp_highest_usd: number | null;
  comps_with_price: number | null;
  comps_sold_out: number | null;
  comps_undercutting: string[] | null;
  num_comps_undercutting: number | null;
  pct_vs_cheapest_comp: number | null;
};

const SEVERITY_TONE: Record<string, StatusTone> = {
  critical: 'expired',
  high: 'expired',
  medium: 'pending',
  low: 'inactive',
  info: 'inactive',
};

const SEVERITY_ORDER: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };

async function loadAll() {
  const agentP = supabase
    .schema('governance')
    .from('agents')
    .select('agent_id, code, name, status, schedule_human, monthly_budget_usd, month_to_date_cost_usd, last_run_at, runtime_settings')
    .eq('code', 'parity_agent')
    .maybeSingle();

  const summaryP = supabase.from('v_parity_summary').select('*');
  const breachesP = supabase
    .from('v_parity_open_breaches')
    .select('*')
    .limit(50);
  const trendP = supabase
    .from('v_parity_breaches_30d')
    .select('*');
  const matrixP = supabase
    .from('v_parity_matrix')
    .select('*')
    .order('stay_date', { ascending: true });

  const runsP = supabase
    .schema('governance')
    .from('agent_runs')
    .select('run_id, status, started_at, finished_at, duration_ms, output')
    .eq('agent_id', (await agentP).data?.agent_id ?? '00000000-0000-0000-0000-000000000000')
    .order('started_at', { ascending: false })
    .limit(10);

  const [summaryR, breachesR, trendR, runsR, agentR, matrixR] = await Promise.all([
    summaryP, breachesP, trendP, runsP, agentP, matrixP,
  ]);

  return {
    agent: (agentR.data ?? null) as AgentRow | null,
    summary: ((summaryR.data ?? []) as SeverityRow[])[0] ?? null,
    breaches: (breachesR.data ?? []) as BreachRow[],
    trend: (trendR.data ?? []) as TrendRow[],
    runs: (runsR.data ?? []) as RunRow[],
    matrix: (matrixR.data ?? []) as MatrixRow[],
  };
}

export default async function ParityPage() {
  const data = await loadAll();
  const agent = data.agent;
  const summary = data.summary;
  const lastRun = data.runs[0] ?? null;

  return (
    <>
      <PageHeader
        pillar="Revenue"
        tab="Parity"
        title={
          <>
            Watch the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>price line</em>,
            close the leaks.
          </>
        }
        lede="Detect rate-parity breaches across channels — refundable vs non-refundable, OTA vs direct, day-over-day jumps."
      />

      {/* COMPACT AGENT HEADER (replaces 5-cell TopStrip) */}
      <ParityCompactHeader
        agent={agent}
        lastRun={lastRun}
        summary={summary}
        settingsLinks={[
          { href: '/revenue/parity/scoring-settings', label: 'Scoring' },
          { href: '/revenue/parity/agent-settings', label: 'Agent' },
        ]}
      />

      {/* 3-GRAPH ROW (mirrors compset/staff pattern) */}
      <ParityGraphs trend={data.trend} breaches={data.breaches} matrix={data.matrix} />

      {/* RATE PARITY MATRIX — Lighthouse-style date × channel grid */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div className="t-eyebrow">RATE PARITY MATRIX</div>
          <div style={cardTitleStyle}>Per stay date · all 11 comps on Booking.com</div>
          <div style={legendStyle}>
            Namkhan BDC vs comp-set BDC. Channels not yet scraped (Brand.com / Expedia / Trip / Agoda) shown as —.
            "Comps undercutting" lists hotels selling cheaper than you for that stay date.
          </div>
        </div>
        {data.matrix.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)' }}>No matrix data yet — agent has not run.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tblStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>STAY DATE</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>BRAND.COM</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>BOOKING.COM</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>EXPEDIA</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>AGODA</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>TRIP</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>COMP CHEAPEST</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>COMP MEDIAN</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Δ VS CHEAPEST</th>
                  <th style={thStyle}>COMPS UNDERCUTTING</th>
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((m) => {
                  const pct = m.pct_vs_cheapest_comp != null ? Number(m.pct_vs_cheapest_comp) : null;
                  const tone = pct == null ? 'var(--ink-mute)' : pct > 5 ? 'var(--st-bad)' : pct < -5 ? 'var(--moss)' : 'var(--ink-mute)';
                  return (
                    <tr key={m.stay_date}>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'var(--mono)' }}>{fmtIsoDate(m.stay_date)}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--ink-faint)' }}>—</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {fmtTableUsd(m.namkhan_usd)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--ink-faint)' }}>—</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--ink-faint)' }}>—</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--ink-faint)' }}>—</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--moss)' }}>
                        {fmtTableUsd(m.comp_lowest_usd)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtTableUsd(m.comp_median_usd)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: tone, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {pct == null ? EMPTY : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
                        {m.comps_undercutting && m.comps_undercutting.length > 0 ? (
                          <>
                            <span style={{ color: 'var(--st-bad)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                              {m.num_comps_undercutting}×
                            </span>{' '}
                            {m.comps_undercutting.slice(0, 3).join(' · ')}
                            {m.comps_undercutting.length > 3 && ` · +${m.comps_undercutting.length - 3} more`}
                          </>
                        ) : m.namkhan_usd != null ? (
                          <span style={{ color: 'var(--moss)', fontFamily: 'var(--mono)' }}>none — you're competitive</span>
                        ) : (
                          <span style={{ color: 'var(--ink-faint)' }}>not shopped</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OPEN BREACHES TABLE */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div className="t-eyebrow">OPEN BREACHES</div>
          <div style={cardTitleStyle}>What needs your attention</div>
          <div style={legendStyle}>
            CRITICAL = non-refundable priced ABOVE refundable for same room (config error).
            MEDIUM/LOW = rate moved &gt;{(agent?.runtime_settings as any)?.rate_jump_warn_pct ?? 10}% vs prior shop_date.
          </div>
        </div>
        {data.breaches.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', color: 'var(--moss)' }}>
              No open breaches.
            </div>
            <div style={{ marginTop: 6, fontSize: 'var(--t-sm)' }}>
              Parity holds across all checks. Watchdog runs daily at 06:15 ICT.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tblStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>SEVERITY</th>
                  <th style={thStyle}>RULE</th>
                  <th style={thStyle}>STAY</th>
                  <th style={thStyle}>ROOM</th>
                  <th style={thStyle}>CHANNEL</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>RATE A</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>RATE B</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Δ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Δ%</th>
                  <th style={thStyle}>DETECTED</th>
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
                          <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-xs)', marginTop: 4, lineHeight: 1.4, maxWidth: 460 }}>
                            {b.rule_description}
                          </div>
                        )}
                        <div style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)', marginTop: 4, fontFamily: 'var(--mono)' }}>
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
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (b.delta_usd ?? 0) >= 0 ? 'var(--st-bad)' : 'var(--moss)', fontWeight: 600 }}>
                        {b.delta_usd != null ? (b.delta_usd >= 0 ? '+' : '−') + fmtTableUsd(Math.abs(b.delta_usd)) : EMPTY}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (b.delta_pct ?? 0) >= 0 ? 'var(--st-bad)' : 'var(--moss)' }}>
                        {b.delta_pct != null ? (b.delta_pct >= 0 ? '+' : '−') + Math.abs(b.delta_pct).toFixed(1) + '%' : EMPTY}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                        {fmtRelative(b.detected_at)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AGENT RUN HISTORY */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div className="t-eyebrow">AGENT RUN HISTORY</div>
          <div style={cardTitleStyle}>Last 10 runs</div>
        </div>
        {data.runs.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)' }}>No runs yet.</div>
        ) : (
          <table style={tblStyle}>
            <thead>
              <tr>
                <th style={thStyle}>STARTED</th>
                <th style={thStyle}>STATUS</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>DURATION</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>BREACHES INSERTED</th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((r) => {
                const out = (r.output ?? {}) as Record<string, unknown>;
                return (
                  <tr key={r.run_id}>
                    <td style={tdStyle}>{fmtIsoDate(r.started_at?.slice(0, 10))} <span style={{ color: 'var(--ink-mute)' }}>{r.started_at?.slice(11, 16)}</span></td>
                    <td style={tdStyle}>
                      <StatusPill tone={r.status === 'success' ? 'active' : 'expired'}>
                        {(r.status ?? '').toUpperCase()}
                      </StatusPill>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : EMPTY}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {(out.breaches_inserted as number | undefined) ?? EMPTY}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ROADMAP */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div className="t-eyebrow">RULES</div>
          <div style={cardTitleStyle}>What's measured</div>
        </div>
        <div style={{ padding: '16px 22px', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)', lineHeight: 1.55 }}>
          <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: 20 }}>
            <li>
              <strong>Internal-BDC parity.</strong> For every captured BDC rate plan, checks that
              non-refundable is priced BELOW refundable for the same room/stay date.
              Fires <strong>CRITICAL</strong> when violated.
            </li>
            <li>
              <strong>Day-over-day rate jumps.</strong> Compares each plan's rate today vs prior shop_date.
              {' '}{(agent?.runtime_settings as any)?.rate_jump_warn_pct ?? 10}%+ → <strong>LOW</strong>;
              {' '}{(agent?.runtime_settings as any)?.rate_jump_alert_pct ?? 25}%+ → <strong>MEDIUM</strong>.
            </li>
          </ul>
        </div>
      </div>
    </>
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

const cardStyle: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  marginTop: 18,
  overflow: 'hidden',
};
const cardHeaderStyle: React.CSSProperties = {
  padding: '18px 22px',
  borderBottom: '1px solid var(--paper-deep)',
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-xl)',
  fontWeight: 500,
  marginTop: 6,
};
const legendStyle: React.CSSProperties = {
  marginTop: 8,
  color: 'var(--ink-faint)',
  fontSize: 'var(--t-xs)',
  fontFamily: 'var(--mono)',
  letterSpacing: 'var(--ls-loose)',
  lineHeight: 1.6,
};
const tblStyle: React.CSSProperties = {
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
