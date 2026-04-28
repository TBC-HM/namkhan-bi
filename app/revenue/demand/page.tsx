import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { getPaceOtb } from '@/lib/data';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function DemandPage() {
  const pace = await getPaceOtb().catch(() => []);
  const total = pace.reduce((a: any, r: any) => ({
    otb: a.otb + Number(r.otb_roomnights || 0),
    rev: a.rev + Number(r.otb_revenue || 0),
    stly: a.stly + Number(r.stly_roomnights || 0),
    stlyRev: a.stlyRev + Number(r.stly_revenue || 0)
  }), { otb: 0, rev: 0, stly: 0, stlyRev: 0 });

  return (
    <>
      <Section title="Demand" tag="OTB · Pace vs STLY · Forward 12 months">
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="OTB Roomnights" value={total.otb} />
          <Kpi label="OTB Revenue" value={total.rev} kind="money" />
          <Kpi label="STLY Roomnights" value={total.stly} />
          <Kpi label="Pace Δ Roomnights" value={total.otb - total.stly}
               status={total.otb >= total.stly ? 'good' : 'bad'} />
        </div>
      </Section>

      <Section title="Pace by Check-In Month" tag="OTB vs STLY">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">OTB Rn</th>
              <th className="text-right">STLY Rn</th>
              <th className="text-right">Δ Rn</th>
              <th className="text-right">OTB Rev</th>
              <th className="text-right">STLY Rev</th>
              <th className="text-right">Δ Rev</th>
            </tr>
          </thead>
          <tbody>
            {pace.map((r: any) => {
              const dRn = Number(r.roomnights_delta || 0);
              const dRev = Number(r.revenue_delta || 0);
              return (
                <tr key={r.ci_month}>
                  <td>{String(r.ci_month).slice(0, 7)}</td>
                  <td className="text-right tabular">{r.otb_roomnights}</td>
                  <td className="text-right tabular text-muted">{r.stly_roomnights}</td>
                  <td className={`text-right tabular ${dRn >= 0 ? 'text-green' : 'text-red'}`}>{dRn >= 0 ? '+' : ''}{dRn}</td>
                  <td className="text-right tabular">{fmtMoney(Number(r.otb_revenue), 'USD')}</td>
                  <td className="text-right tabular text-muted">{fmtMoney(Number(r.stly_revenue), 'USD')}</td>
                  <td className={`text-right tabular ${dRev >= 0 ? 'text-green' : 'text-red'}`}>{dRev >= 0 ? '+' : ''}{fmtMoney(dRev, 'USD')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </>
  );
}
