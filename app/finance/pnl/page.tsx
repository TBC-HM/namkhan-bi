import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { MonthlyByDeptChart } from '@/components/charts/MonthlyByDeptChart';
import { getRevenueByUsali, defaultMonthRange, getKpiDaily, defaultDailyRange, aggregateDaily } from '@/lib/data';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function PnLPage() {
  const range = defaultMonthRange();
  const usali = await getRevenueByUsali(range.fromMonth, range.toMonth).catch(() => []);
  const r30 = defaultDailyRange(30);
  const d30 = await getKpiDaily(r30.from, r30.to).catch(() => []);
  const a30 = aggregateDaily(d30);

  // Aggregate latest full month
  const months = Array.from(new Set(usali.map((r: any) => r.month))).sort().reverse();
  const latestMonth = months[1] || months[0]; // last completed month
  const latestRows = usali.filter((r: any) => r.month === latestMonth);

  const byDept: Record<string, number> = {};
  latestRows.forEach((r: any) => {
    byDept[r.usali_dept] = (byDept[r.usali_dept] || 0) + Number(r.revenue || 0);
  });
  const totalRev = Object.values(byDept).reduce((s, v) => s + v, 0);

  return (
    <>
      <Section title="USALI Profit & Loss" tag={`Latest month: ${latestMonth ? String(latestMonth).slice(0, 7) : '—'} · revenue side · USD`}>
        <div className="grid grid-cols-5 gap-3 mb-3">
          <Kpi label="Total Revenue" value={totalRev} kind="money" />
          <Kpi label="Rooms" value={byDept['Rooms'] || 0} kind="money" />
          <Kpi label="F&B" value={byDept['F&B'] || 0} kind="money" />
          <Kpi label="Other Operated" value={byDept['Other Operated'] || 0} kind="money" />
          <Kpi label="Retail" value={byDept['Retail'] || 0} kind="money" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="GOP" value={null} kind="money" greyed hint="Cost data needed" />
          <Kpi label="EBITDA" value={null} kind="money" greyed hint="Cost data needed" />
          <Kpi label="Cost % Revenue" value={null} kind="pct" greyed hint="Cost data needed" />
          <Kpi label="GOPPAR" value={null} kind="money" greyed hint="Cost data needed" />
        </div>
      </Section>

      <Section title="Revenue by USALI Department · Trailing 12 months" tag="Stacked monthly">
        {usali.length > 0 ? <MonthlyByDeptChart rows={usali} />
          : <div className="text-muted text-sm py-12 text-center">No USALI data.</div>}
      </Section>

      <Section title="USALI Detail · Latest Full Month" tag={String(latestMonth || '').slice(0, 7)}>
        <table>
          <thead><tr><th>Department</th><th>Sub-dept</th><th className="text-right">Revenue</th><th className="text-right">Units</th><th className="text-right">% of Total</th></tr></thead>
          <tbody>
            {latestRows.sort((a: any, b: any) => Number(b.revenue) - Number(a.revenue)).map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.usali_dept}</td>
                <td className="text-muted">{r.usali_subdept || '—'}</td>
                <td className="text-right tabular">{fmtMoney(Number(r.revenue), 'USD')}</td>
                <td className="text-right tabular">{r.units}</td>
                <td className="text-right tabular text-muted">{totalRev ? `${((Number(r.revenue) / totalRev) * 100).toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="P&L Expense Side" tag="Awaiting cost upload" greyed greyedReason="Operator P&L expenses not yet integrated">
        <div className="text-muted text-sm">USALI expense breakdown · payroll · COGS · OpEx. Requires monthly cost upload schema or accounting system integration.</div>
      </Section>
    </>
  );
}
