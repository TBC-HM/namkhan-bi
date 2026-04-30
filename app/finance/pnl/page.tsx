// app/finance/pnl/page.tsx
// Finance · USALI P&L (revenue side live, expense greyed).

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import Insight from '@/components/sections/Insight';
import { MonthlyByDeptChart } from '@/components/charts/MonthlyByDeptChart';
import { getRevenueByUsali, getKpiDaily, aggregateDaily } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PnLPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  const usali = await getRevenueByUsali(period).catch(() => []);
  const daily = await getKpiDaily(period).catch(() => []);
  const agg = aggregateDaily(daily);

  const months = Array.from(new Set(usali.map((r: any) => r.month))).sort().reverse();
  const latestMonth = months[1] || months[0];
  const latestRows = usali.filter((r: any) => r.month === latestMonth);

  const byDept: Record<string, number> = {};
  latestRows.forEach((r: any) => {
    byDept[r.usali_dept] = (byDept[r.usali_dept] || 0) + Number(r.revenue || 0);
  });
  const totalRev = Object.values(byDept).reduce((s, v) => s + v, 0);

  // Compare to month before
  const priorMonth = months[2];
  const priorRows = usali.filter((r: any) => r.month === priorMonth);
  const priorTotalRev = priorRows.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
  const monthDelta = priorTotalRev ? ((totalRev - priorTotalRev) / priorTotalRev) * 100 : 0;

  return (
    <>
      <PanelHero
        eyebrow={`USALI · ${latestMonth ? String(latestMonth).slice(0, 7) : '—'}`}
        title="Profit & Loss"
        emphasis="revenue side"
        sub="11th edition · USD · expense side awaiting cost upload"
        kpis={
          <>
            <KpiCard
              label="Total Revenue"
              value={totalRev}
              kind="money"
              delta={priorMonth ? `${monthDelta >= 0 ? '+' : ''}${monthDelta.toFixed(1)}% vs prior` : undefined}
              deltaTone={monthDelta >= 0 ? 'pos' : 'neg'}
            />
            <KpiCard label="Rooms" value={byDept['Rooms'] || 0} kind="money" />
            <KpiCard label="F&B" value={byDept['F&B'] || 0} kind="money" />
            <KpiCard
              label="Other Operated"
              value={byDept['Other Operated'] || 0}
              kind="money"
              hint="Spa · Activities · Transport"
            />
          </>
        }
      />

      <div className="card-grid-4">
        <KpiCard label="GOP" value={null} kind="money" greyed hint="Cost data needed" />
        <KpiCard label="EBITDA" value={null} kind="money" greyed hint="Cost data needed" />
        <KpiCard label="Cost % Revenue" value={null} kind="pct" greyed hint="Cost data needed" />
        <KpiCard label="GOPPAR" value={null} kind="money" greyed hint="Cost data needed" />
      </div>

      <Card
        title="Revenue by USALI dept"
        emphasis="trailing 12 months"
        sub="Stacked monthly · revenue only"
        source="mv_revenue_by_usali_dept"
      >
        {usali.length > 0 ? (
          <MonthlyByDeptChart rows={usali} />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)' }}>No USALI data.</div>
        )}
      </Card>

      <div style={{ marginTop: 22 }}>
        <Card
          title="USALI detail"
          emphasis={`· ${String(latestMonth || '').slice(0, 7)}`}
          sub="Latest full month · ranked by revenue"
          source="mv_revenue_by_usali_dept"
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Department</th>
                <th>Sub-dept</th>
                <th className="num">Revenue</th>
                <th className="num">Units</th>
                <th className="num">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {latestRows
                .sort((a: any, b: any) => Number(b.revenue) - Number(a.revenue))
                .map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="lbl"><strong>{r.usali_dept}</strong></td>
                    <td className="lbl text-mute">{r.usali_subdept || '—'}</td>
                    <td className="num">{fmtMoney(Number(r.revenue), 'USD')}</td>
                    <td className="num">{r.units}</td>
                    <td className="num text-mute">
                      {totalRev ? `${((Number(r.revenue) / totalRev) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Insight tone="warn" eye="Expense side">
        <strong>P&L expense rows pending.</strong> Cost data — payroll, COGS, OpEx — is not in
        Cloudbeds. Requires monthly cost upload schema or accounting system integration before GOP /
        EBITDA / GOPPAR can render.
      </Insight>
    </>
  );
}
