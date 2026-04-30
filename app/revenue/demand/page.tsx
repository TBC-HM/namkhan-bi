// app/revenue/demand/page.tsx
// Revenue · Demand — OTB vs STLY pace by check-in month.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import Insight from '@/components/sections/Insight';
import { getPaceOtb } from '@/lib/data';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function DemandPage() {
  const pace = await getPaceOtb().catch(() => []);
  const total = pace.reduce(
    (a: any, r: any) => ({
      otb: a.otb + Number(r.otb_roomnights || 0),
      rev: a.rev + Number(r.otb_revenue || 0),
      stly: a.stly + Number(r.stly_roomnights || 0),
      stlyRev: a.stlyRev + Number(r.stly_revenue || 0),
    }),
    { otb: 0, rev: 0, stly: 0, stlyRev: 0 }
  );

  const paceΔ = total.otb - total.stly;
  const paceΔRev = total.rev - total.stlyRev;
  const paceΔPct = total.stly ? (paceΔ / total.stly) * 100 : 0;

  // Find biggest single-month gap, positive or negative
  let biggest = { month: '', delta: 0, dir: 'pos' as 'pos' | 'neg' };
  pace.forEach((r: any) => {
    const d = Number(r.roomnights_delta || 0);
    if (Math.abs(d) > Math.abs(biggest.delta)) {
      biggest = { month: String(r.ci_month).slice(0, 7), delta: d, dir: d >= 0 ? 'pos' : 'neg' };
    }
  });

  return (
    <>
      <PanelHero
        eyebrow="Demand · pace"
        title="On the books"
        emphasis="vs STLY"
        sub="Forward 12 months · check-in-date based"
        kpis={
          <>
            <KpiCard label="OTB Roomnights" value={total.otb} />
            <KpiCard label="OTB Revenue" value={total.rev} kind="money" />
            <KpiCard label="STLY Roomnights" value={total.stly} />
            <KpiCard
              label="Pace Δ Roomnights"
              value={paceΔ}
              tone={paceΔ >= 0 ? 'pos' : 'neg'}
              delta={`${paceΔPct >= 0 ? '+' : ''}${paceΔPct.toFixed(1)}%`}
              deltaTone={paceΔ >= 0 ? 'pos' : 'neg'}
            />
          </>
        }
      />

      <Card title="Pace" emphasis="by check-in month" sub="OTB vs same time last year" source="mv_pace_otb">
        <table className="tbl">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">OTB Rn</th>
              <th className="num">STLY Rn</th>
              <th className="num">Δ Rn</th>
              <th className="num">OTB Rev</th>
              <th className="num">STLY Rev</th>
              <th className="num">Δ Rev</th>
            </tr>
          </thead>
          <tbody>
            {pace.map((r: any) => {
              const dRn = Number(r.roomnights_delta || 0);
              const dRev = Number(r.revenue_delta || 0);
              return (
                <tr key={r.ci_month}>
                  <td className="lbl"><strong>{String(r.ci_month).slice(0, 7)}</strong></td>
                  <td className="num">{r.otb_roomnights}</td>
                  <td className="num text-mute">{r.stly_roomnights}</td>
                  <td className={`num ${dRn >= 0 ? 'text-good' : 'text-bad'}`}>
                    {dRn >= 0 ? '+' : ''}{dRn}
                  </td>
                  <td className="num">{fmtMoney(Number(r.otb_revenue), 'USD')}</td>
                  <td className="num text-mute">{fmtMoney(Number(r.stly_revenue), 'USD')}</td>
                  <td className={`num ${dRev >= 0 ? 'text-good' : 'text-bad'}`}>
                    {dRev >= 0 ? '+' : ''}{fmtMoney(dRev, 'USD')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {biggest.month && Math.abs(biggest.delta) >= 5 && (
        <Insight tone={biggest.dir === 'pos' ? 'info' : 'alert'} eye="Pace signal">
          <strong>{biggest.month}</strong> is{' '}
          {biggest.dir === 'pos' ? 'ahead' : 'behind'} STLY by{' '}
          <strong>{Math.abs(biggest.delta)} roomnights</strong>.{' '}
          {biggest.dir === 'pos'
            ? 'Consider tightening rates or restrictions to capture additional yield.'
            : 'Investigate channel mix and rate competitiveness; promo or restriction loosening may apply.'}
        </Insight>
      )}
    </>
  );
}
