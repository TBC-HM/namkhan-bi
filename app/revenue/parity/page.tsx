// app/revenue/parity/page.tsx
// 2026-05-19 refactor onto @/app/(cockpit)/_design primitives.
// Lighthouse-style filter bar (member rate/device/LOS/etc.) removed —
// reinstate via primitives v6 if needed. Date×OTA grid → Chart variant=heatmap.
// Breach list → Chart variant=table with pre-formatted cells.

import {
  DashboardPage, Container, KpiTile, Chart,
  type DashboardTab, type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number }

interface SeverityRow {
  open_critical: number; open_high: number; open_medium: number; open_low: number; open_total: number;
  detected_7d: number; detected_30d: number; last_detected_at: string | null;
}
interface BreachRow {
  breach_id: string; detected_at: string; shop_date: string; stay_date: string;
  severity: string; rule_code: string; rule_description: string | null;
  channel_a: string | null; channel_b: string | null;
  rate_a_usd: number | null; rate_b_usd: number | null;
  delta_usd: number | null; delta_pct: number | null;
  raw_room_type: string | null;
}
interface AgentRow {
  agent_id: string; status: string; schedule_human: string | null;
  monthly_budget_usd: number | null; month_to_date_cost_usd: number | null;
  last_run_at: string | null;
}
interface GridRow {
  stay_date: string; channel: string;
  our_rate_usd: number | null; their_rate_usd: number | null;
  gap_pct: number | null; severity: string | null;
  last_shop_date: string | null;
}

async function loadAll(): Promise<{ agent: AgentRow | null; summary: SeverityRow | null; breaches: BreachRow[]; grid: GridRow[] }> {
  const agentP = supabase.schema('governance').from('agents')
    .select('agent_id, status, schedule_human, monthly_budget_usd, month_to_date_cost_usd, last_run_at')
    .eq('code', 'parity_agent')
    .maybeSingle();

  const [agentR, summaryR, breachesR, gridR] = await Promise.all([
    agentP,
    supabase.from('v_parity_summary').select('*'),
    supabase.from('v_parity_open_breaches').select('*').limit(50),
    supabase.from('v_parity_grid').select('*').order('stay_date', { ascending: true }),
  ]);

  return {
    agent:    (agentR.data ?? null) as AgentRow | null,
    summary:  ((summaryR.data ?? []) as SeverityRow[])[0] ?? null,
    breaches: (breachesR.data ?? []) as BreachRow[],
    grid:     (gridR.data ?? []) as GridRow[],
  };
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
  return `${Math.floor(hrs / 24)}d ago`;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };

export default async function ParityPage({ propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/parity') }));

  const data = await loadAll();
  const summary = data.summary;
  const agent = data.agent;
  const grid = data.grid;
  const lastShopIso = grid.map((r) => r.last_shop_date).filter((d): d is string => !!d).sort().pop() ?? null;

  // KPI tiles
  const tiles: KpiTileProps[] = [
    { label: 'Open breaches · total', value: summary?.open_total ?? 0, size: 'sm',
      footnote: lastShopIso ? `shopped ${fmtIsoDate(lastShopIso)}` : 'no shop yet',
      status: (summary?.open_total ?? 0) === 0 ? 'green' : (summary?.open_total ?? 0) >= 5 ? 'red' : 'amber' },
    { label: 'Critical · open', value: summary?.open_critical ?? 0, size: 'sm',
      footnote: 'non-refundable above refundable',
      status: (summary?.open_critical ?? 0) === 0 ? 'green' : 'red' },
    { label: 'High · open', value: summary?.open_high ?? 0, size: 'sm',
      status: (summary?.open_high ?? 0) === 0 ? 'green' : 'amber' },
    { label: 'Detected · last 7d', value: summary?.detected_7d ?? 0, size: 'sm',
      status: 'grey' },
    { label: 'Detected · last 30d', value: summary?.detected_30d ?? 0, size: 'sm',
      status: 'grey' },
    { label: 'Agent status', value: agent?.status ?? '—', size: 'sm',
      footnote: agent?.last_run_at ? `last run ${fmtRelative(agent.last_run_at)}` : 'never run',
      status: agent?.status === 'active' ? 'green' : 'grey' },
  ];

  // Date×OTA heatmap data (gap_pct as cell value, signed)
  const heatmapData = grid.map((r) => ({
    stay_date: r.stay_date,
    channel:   r.channel,
    gap:       Number(r.gap_pct ?? 0),
  }));

  // Breach table rows (pre-formatted)
  const breachRows = data.breaches
    .slice()
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .map((b) => ({
      severity: b.severity.toUpperCase(),
      rule:     b.rule_code,
      stay:     fmtIsoDate(b.stay_date),
      room:     b.raw_room_type ?? EMPTY,
      channel:  `${(b.channel_a ?? EMPTY).toUpperCase()}${b.channel_b && b.channel_b !== b.channel_a ? ` / ${b.channel_b.toUpperCase()}` : ''}`,
      rate_a:   fmtTableUsd(b.rate_a_usd),
      rate_b:   fmtTableUsd(b.rate_b_usd),
      delta:    b.delta_usd != null
        ? (b.delta_usd >= 0 ? '+' : '−') + fmtTableUsd(Math.abs(b.delta_usd))
        : EMPTY,
      delta_pct: b.delta_pct != null
        ? (b.delta_pct >= 0 ? '+' : '−') + Math.abs(b.delta_pct).toFixed(1) + '%'
        : EMPTY,
      detected: fmtRelative(b.detected_at),
    }));

  const breachCols: ChartSeries[] = [
    { key: 'rule',      label: 'Rule' },
    { key: 'stay',      label: 'Stay' },
    { key: 'room',      label: 'Room' },
    { key: 'channel',   label: 'Channel' },
    { key: 'rate_a',    label: 'Rate A' },
    { key: 'rate_b',    label: 'Rate B' },
    { key: 'delta',     label: 'Δ' },
    { key: 'delta_pct', label: 'Δ %' },
    { key: 'detected',  label: 'Detected' },
  ];

  return (
    <DashboardPage
      title="Revenue · Parity"
      subtitle="Watch the price line, close the leaks."
      tabs={tabs}
    >
      <Container title="Parity headline" subtitle={lastShopIso ? `last shop ${fmtIsoDate(lastShopIso)}` : 'awaiting first shop'} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Date × OTA · gap heatmap" subtitle="positive % = we're priced ABOVE channel">
        <Chart variant="heatmap" data={heatmapData} xKey="channel" yKey="stay_date"
          series={[{ key: 'gap', label: 'Gap %' }]}
          height={Math.max(220, Math.min(560, new Set(grid.map((r) => r.stay_date)).size * 22))}
          empty={{ title: 'No parity grid data', hint: 'v_parity_grid returned 0 rows' }}
        />
      </Container>

      <Container title={`Open breaches · ${data.breaches.length}`} subtitle="actionable list">
        <Chart variant="table" data={breachRows} xKey="severity"
          series={breachCols}
          empty={{ title: 'No open breaches', hint: 'parity holds across all checks' }}
        />
      </Container>
    </DashboardPage>
  );
}
