// app/holding/finance/pl/_components/OverviewTab.tsx
// Brief holding-pl-v1 v2 · Overview: EBITDA, revenue, cost, collected +
// monthly bars from payload.by_month.
//
// Draft revenue is NOT in EBITDA and is never added into the revenue tile —
// it gets its own "not yet invoiced" tile. Every figure is payload.*; the
// only arithmetic here is revenue - EBITDA style presentation of values the
// RPC already computed, never a re-aggregation.

import { Container, MetricRow, Chart, type KpiTileProps } from '@/app/(cockpit)/_design';
import type { HoldingPlPayload } from '../_lib/types';
import { money, count, monthLabel, num } from '../_lib/format';
import { EmptyLine, LayerNote, FOREST, INK_M, HAIR } from './ui';

export default function OverviewTab({ p }: { p: HoldingPlPayload }) {
  const cur = p.reporting_currency;
  const t = p.totals;

  const tiles: KpiTileProps[] = [
    {
      label: 'EBITDA',
      value: money(t.ebitda_eur, cur),
      size: 'sm',
      footnote: `${cur} reporting layer · excludes draft revenue`,
    },
    {
      label: 'Revenue (invoiced)',
      value: money(t.revenue_eur, cur),
      size: 'sm',
      footnote: `${cur} reporting layer · ${p.basis} basis`,
    },
    {
      label: 'Not yet invoiced',
      value: money(t.revenue_draft_eur, cur),
      size: 'sm',
      status: 'amber',
      footnote: 'Draft revenue — excluded from EBITDA and from revenue above',
    },
    {
      label: 'Direct cost',
      value: money(t.direct_cost_eur, cur),
      size: 'sm',
      footnote: `${cur} reporting layer`,
    },
    {
      label: 'Overhead',
      value: money(t.overhead_eur, cur),
      size: 'sm',
      footnote: 'Never allocated to departments',
    },
    {
      // SCOPE WARNING: fn_holding_pl_payload reads v_holding_cash_collected
      // WITHOUT applying the period bounds, so this figure is entity-to-date
      // even when a period is selected. Saying so beats showing a number whose
      // scope silently differs from every other tile on the row.
      label: 'Cash collected (all time)',
      value: money(p.collected.total_eur, cur),
      size: 'sm',
      status: 'grey',
      footnote: `${count(p.collected.invoice_count)} invoice(s) · NOT period-scoped · cash IN only, not a cash-basis P&L`,
    },
  ];

  const chartData = p.by_month.map((m) => ({
    month: monthLabel(m.period_yyyymm),
    revenue: num(m.revenue_eur) ?? 0,
    direct_cost: num(m.direct_cost_eur) ?? 0,
    overhead: num(m.overhead_eur) ?? 0,
  }));

  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow tiles={tiles} size="sm" />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Monthly revenue and cost"
          subtitle={`${p.entity} · ${p.basis} basis · ${cur} reporting layer`}
          density="compact"
        >
          {chartData.length === 0 ? (
            <EmptyLine what="No month falls inside the selected period. Widen the period or clear it to use the full range the RPC resolves." />
          ) : (
            <Chart
              variant="bar"
              data={chartData}
              xKey="month"
              series={[
                { key: 'revenue',     label: 'Revenue',     type: 'bar' },
                { key: 'direct_cost', label: 'Direct cost', type: 'bar' },
                { key: 'overhead',    label: 'Overhead',    type: 'bar' },
              ]}
              height={280}
              legend="top"
              valueSuffix={` ${cur}`}
              empty={{ title: 'No monthly rows in this period' }}
            />
          )}
          <LayerNote currency={cur} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="How EBITDA is built"
          subtitle="Each line is a field on the payload — none is recomputed here."
          density="compact"
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 520 }}>
            <tbody>
              {[
                { k: 'Revenue (invoiced)', v: t.revenue_eur, strong: false },
                { k: 'Direct cost',        v: t.direct_cost_eur, strong: false, neg: true },
                { k: 'Overhead',           v: t.overhead_eur, strong: false, neg: true },
                { k: 'EBITDA',             v: t.ebitda_eur, strong: true },
              ].map((r) => (
                <tr key={r.k}>
                  <td style={{
                    padding: '7px 8px 7px 0', fontSize: 12,
                    fontWeight: r.strong ? 700 : 400,
                    color: r.strong ? FOREST : 'inherit',
                    borderTop: r.strong ? `1px solid ${HAIR}` : undefined,
                  }}>{r.k}</td>
                  <td style={{
                    padding: '7px 0', fontSize: 12, textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: r.strong ? 700 : 400,
                    color: r.strong ? FOREST : 'inherit',
                    borderTop: r.strong ? `1px solid ${HAIR}` : undefined,
                  }}>{r.neg ? `(${money(r.v, cur)})` : money(r.v, cur)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '7px 8px 0 0', fontSize: 12, color: INK_M }}>
                  Not yet invoiced (excluded)
                </td>
                <td style={{
                  padding: '7px 0 0', fontSize: 12, textAlign: 'right',
                  color: INK_M, fontVariantNumeric: 'tabular-nums',
                }}>{money(t.revenue_draft_eur, cur)}</td>
              </tr>
            </tbody>
          </table>
          <LayerNote currency={cur} />
        </Container>
      </div>
    </>
  );
}
