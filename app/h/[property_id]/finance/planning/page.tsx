// app/h/[property_id]/finance/planning/page.tsx
// FP&C Module v1 — Financial Planning & Control (brief module-financial-planning-control-v1).
//
// Budget → forecast → actual → variance on the QB P&L BY CLASS structure
// (ADR-159 fixed point), plus 13-week cash forward. GL layer = USD (ADR-173).
//
// Every figure traces to a view (metric truth law — zero hand-typed numbers):
//   variance table  → public.v_budget_vs_actual_monthly
//   cash strip      → public.v_cash_forward_13w (every line names its source view)
//   narratives      → cockpit_tickets (intent='variance_narrative', awaits_user only)
//
// Namkhan-first (Donna deferred per brief §7); the page itself is property-scoped.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import BudgetUpload from './BudgetUpload';
import NarrativeButton from './NarrativeButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

interface VarianceRow {
  property_id: number;
  year_month: string;
  gl_class: string;
  class_name: string | null;
  budget_usd: number | null;
  budget_version: number | null;
  forecast_usd: number | null;
  actual_usd: number | null;
  is_final: boolean | null;
  var_abs: number | null;
  var_pct: number | null;
  currency_layer: string;
}

interface CashRow {
  property_id: number;
  week_start: string;
  week_idx: number;
  iso_week: string;
  line_order: number;
  line_key: string;
  line_label: string;
  source_view: string;
  amount_usd: number;
  currency_layer: string;
}

interface NarrativeTicket {
  id: number;
  created_at: string;
  email_subject: string | null;
  email_body: string | null;
  parsed_summary: string | null;
}

const usd = (n: number | null | undefined, dp = 0): string =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })}`;

function statusFor(varPct: number | null): 'green' | 'amber' | 'red' | 'grey' {
  if (varPct == null) return 'grey';
  const a = Math.abs(varPct);
  if (a <= 5) return 'green';
  if (a <= 10) return 'amber';
  return 'red';
}

export default async function FinancePlanningPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: { mo?: string };
}) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  const propertyLabel = KNOWN_LABEL[propertyId];

  const sb = getSupabaseAdmin();

  const [{ data: allVarRaw, error: varErr }, { data: cashRaw, error: cashErr }] = await Promise.all([
    sb.from('v_budget_vs_actual_monthly')
      .select('*')
      .eq('property_id', propertyId)
      .order('year_month', { ascending: true }),
    sb.from('v_cash_forward_13w')
      .select('*')
      .eq('property_id', propertyId)
      .order('week_idx', { ascending: true })
      .order('line_order', { ascending: true }),
  ]);
  if (varErr) throw new Error(`v_budget_vs_actual_monthly: ${varErr.message}`);
  if (cashErr) throw new Error(`v_cash_forward_13w: ${cashErr.message}`);

  const allVar = (allVarRaw ?? []) as VarianceRow[];
  const cash = (cashRaw ?? []) as CashRow[];

  const monthsWithActuals = Array.from(new Set(allVar.filter((r) => r.actual_usd != null).map((r) => r.year_month))).sort();
  const allMonths = Array.from(new Set(allVar.map((r) => r.year_month))).sort();
  const latestActualMonth = monthsWithActuals.length > 0 ? monthsWithActuals[monthsWithActuals.length - 1] : null;
  const selMonth =
    searchParams?.mo && allMonths.includes(searchParams.mo) ? searchParams.mo : latestActualMonth ?? allMonths[allMonths.length - 1] ?? null;

  const monthRows = allVar
    .filter((r) => r.year_month === selMonth)
    .sort((a, b) => (b.actual_usd ?? 0) - (a.actual_usd ?? 0));

  const budgetVersion = allVar.reduce<number | null>((mx, r) => (r.budget_version != null && (mx == null || r.budget_version > mx) ? r.budget_version : mx), null);

  // Narrative drafts (queue-only, awaits_user — never auto-published).
  const { data: ticketsRaw } = await sb
    .from('cockpit_tickets')
    .select('id, created_at, email_subject, email_body, parsed_summary')
    .eq('intent', 'variance_narrative')
    .eq('status', 'awaits_user')
    .contains('metadata', { property_id: propertyId })
    .order('created_at', { ascending: false })
    .limit(5);
  const tickets = (ticketsRaw ?? []) as NarrativeTicket[];

  // ── KPI tiles ──────────────────────────────────────────────────────────────
  const mBudget = monthRows.reduce((s, r) => s + (r.budget_usd ?? 0), 0);
  const mActual = monthRows.reduce((s, r) => s + (r.actual_usd ?? 0), 0);
  const hasBudget = monthRows.some((r) => r.budget_usd != null);
  const mVarPct = hasBudget && mBudget !== 0 ? ((mActual - mBudget) / Math.abs(mBudget)) * 100 : null;

  const opening = cash.find((c) => c.line_key === 'opening_balance');
  const closings = cash.filter((c) => c.line_key === 'closing_balance');
  const minClosing = closings.length > 0 ? closings.reduce((m, c) => (c.amount_usd < m.amount_usd ? c : m)) : null;

  const tiles: KpiTileProps[] = [
    {
      label: `Budget · ${selMonth ?? '—'}`,
      value: hasBudget ? usd(mBudget) : '—',
      size: 'sm',
      status: hasBudget ? 'green' : 'grey',
      footnote: hasBudget ? `v${budgetVersion} · finance.budget_monthly` : 'no budget loaded',
    },
    {
      label: `Actual · ${selMonth ?? '—'}`,
      value: monthRows.some((r) => r.actual_usd != null) ? usd(mActual) : '—',
      size: 'sm',
      status: monthRows.some((r) => r.actual_usd != null) ? 'green' : 'grey',
      footnote: 'QB P&L by class (ADR-159)',
    },
    {
      label: 'Variance vs budget',
      value: mVarPct == null ? '—' : `${mVarPct >= 0 ? '+' : ''}${mVarPct.toFixed(1)}%`,
      size: 'sm',
      status: statusFor(mVarPct),
      footnote: 'all classes, GL layer USD',
    },
    {
      label: 'Opening cash',
      value: opening ? usd(opening.amount_usd) : '—',
      size: 'sm',
      status: opening ? (opening.amount_usd > 0 ? 'green' : 'red') : 'grey',
      footnote: opening?.line_label ?? 'public.v_bank_account_balance',
    },
    {
      label: 'Lowest projected cash · 13w',
      value: minClosing ? usd(minClosing.amount_usd) : '—',
      size: 'sm',
      status: minClosing ? (minClosing.amount_usd > 0 ? 'green' : 'red') : 'grey',
      footnote: minClosing ? `week of ${minClosing.week_start}` : 'public.v_cash_forward_13w',
    },
  ];

  // ── Variance table ─────────────────────────────────────────────────────────
  const varianceRows = monthRows.map((r) => ({
    class: r.class_name ?? r.gl_class,
    budget: usd(r.budget_usd),
    forecast: usd(r.forecast_usd),
    actual: usd(r.actual_usd),
    var_abs: r.var_abs == null ? '—' : `${r.var_abs >= 0 ? '+' : '−'}${usd(Math.abs(r.var_abs))}`,
    var_pct: r.var_pct == null ? '—' : `${r.var_pct >= 0 ? '+' : ''}${r.var_pct.toFixed(1)}%`,
    status: r.var_pct == null ? '·' : Math.abs(r.var_pct) > 10 ? '●' : Math.abs(r.var_pct) > 5 ? '◐' : '○',
  }));
  const varianceCols: ChartSeries[] = [
    { key: 'budget', label: 'Budget USD' },
    { key: 'forecast', label: 'Forecast USD' },
    { key: 'actual', label: 'Actual USD' },
    { key: 'var_abs', label: 'Δ abs' },
    { key: 'var_pct', label: 'Δ %' },
    { key: 'status', label: '>10% = ●' },
  ];

  // ── Cash strip pivot (rows = lines, cols = weeks) ──────────────────────────
  const weeks = Array.from(new Set(cash.map((c) => c.week_idx))).sort((a, b) => a - b);
  const weekStarts = new Map(cash.map((c) => [c.week_idx, c.week_start.slice(5)]));
  const lineOrder = Array.from(new Map(cash.map((c) => [c.line_key, { order: c.line_order, label: c.line_label, source: c.source_view }])).entries())
    .sort((a, b) => a[1].order - b[1].order);
  const cashRows = lineOrder.map(([key, meta]) => {
    const row: Record<string, string> = { line: meta.label, source: meta.source };
    for (const w of weeks) {
      const cell = cash.find((c) => c.line_key === key && c.week_idx === w);
      row[`w${w}`] = cell ? usd(cell.amount_usd) : key === 'opening_balance' ? '' : '—';
    }
    return row;
  });
  const cashCols: ChartSeries[] = [
    ...weeks.map((w) => ({ key: `w${w}`, label: `W${w} · ${weekStarts.get(w) ?? ''}` })),
    { key: 'source', label: 'Source view' },
  ];

  const closingSeries = closings.map((c) => ({ week: `W${c.week_idx}`, closing: Math.round(c.amount_usd) }));

  return (
    <DashboardPage
      title={`Finance · Planning & Control · ${propertyLabel}`}
      subtitle={`budget vs actual by QB class (ADR-159) · 13-week cash forward · GL layer USD (ADR-173)${cash[0] ? '' : ' · no cash data'}`}
    >
      <Container title="Planning headline" subtitle={selMonth ?? 'no month available'} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container
        title={`Variance by class · ${selMonth ?? '—'}`}
        subtitle="budget = latest version · actual = QB P&L by class · forecast = Module 2 rooms revenue (other classes pending)"
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
          {allMonths.map((m) => (
            <Link
              key={m}
              href={`/h/${propertyId}/finance/planning?mo=${m}`}
              style={{
                padding: '2px 10px', borderRadius: 12, textDecoration: 'none',
                border: '1px solid var(--hairline)',
                background: m === selMonth ? 'var(--primary)' : 'var(--paper)',
                color: m === selMonth ? 'var(--paper)' : 'var(--ink)',
              }}
            >
              {m}{monthsWithActuals.includes(m) ? '' : ' (fc)'}
            </Link>
          ))}
        </div>
        <Chart
          variant="table"
          data={varianceRows}
          xKey="class"
          series={varianceCols}
          empty={{ title: 'No budget or actuals for this month', hint: 'Import a budget below to activate the variance loop' }}
        />
      </Container>

      <Container
        title="13-week cash forward"
        subtitle={`${opening?.line_label ?? 'opening from public.v_bank_account_balance'} · settlement layer, USD-equivalent (ADR-173)`}
      >
        {closingSeries.length > 0 && (
          <Chart
            variant="line"
            data={closingSeries}
            xKey="week"
            yKey="closing"
            series={[{ key: 'closing', label: 'Projected closing balance USD' }]}
            height={200}
            formatY={(v) => usd(v)}
          />
        )}
        <Chart
          variant="table"
          data={cashRows}
          xKey="line"
          series={cashCols}
          empty={{ title: 'No cash-forward data', hint: 'public.v_cash_forward_13w returned no rows' }}
        />
      </Container>

      <Container
        title="Monthly variance narrative"
        subtitle="drafted by the variance_narrative skill · lands as awaits_user ticket · never auto-published (§0.6)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <NarrativeButton propertyId={propertyId} yearMonth={selMonth} />
          {tickets.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No narrative drafts awaiting review.</div>
          ) : (
            tickets.map((t) => (
              <div key={t.id} style={{ border: '1px solid var(--hairline)', borderRadius: 8, padding: 16, background: 'var(--paper)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {t.email_subject ?? `Draft #${t.id}`}
                  <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> · ticket #{t.id} · awaiting review</span>
                </div>
                <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', color: 'var(--ink)' }}>
                  {t.email_body ?? t.parsed_summary ?? ''}
                </pre>
              </div>
            ))
          )}
        </div>
      </Container>

      <Container title="Budget import" subtitle="xlsx → public.fn_budget_import · versioned append-forward · validates against finance.gl_classes">
        <BudgetUpload propertyId={propertyId} latestVersion={budgetVersion} latestVersionAt={null} />
      </Container>
    </DashboardPage>
  );
}
