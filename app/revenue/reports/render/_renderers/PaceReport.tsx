// app/revenue/reports/render/_renderers/PaceReport.tsx
// Pace report — booking pace vs STLY + budget across −30d→+30d, plus
// the headline KPIs for context. Server component.

import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import Brief from '@/components/page/Brief';
import { getOverviewKpis, getChannelPerf } from '@/lib/data';
import { getPaceCurve, getDailyRevenueForRange } from '@/lib/pulseData';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props { period: ResolvedPeriod }

export default async function PaceReport({ period }: Props) {
  const [kpis, paceCurve, rangeRev, channels] = await Promise.all([
    getOverviewKpis(period).catch(() => ({ current: null, compare: null } as any)),
    getPaceCurve(30, 30).catch(() => []),
    getDailyRevenueForRange(period.from, period.to).catch(() => []),
    getChannelPerf(period).catch(() => [] as any[]),
  ]);

  const cur = kpis.current;
  const cmp = kpis.compare;
  const occ = Number(cur?.occupancy_pct ?? 0);
  const adr = Number(cur?.adr_usd ?? 0);
  const revpar = Number(cur?.revpar_usd ?? 0);
  const trevpar = Number(cur?.trevpar_usd ?? 0);

  const cmpLabel = period.cmpLabel ? period.cmpLabel.replace(/^vs\s+/i, '') : '';
  const dOcc     = cmp ? occ     - Number(cmp?.occupancy_pct ?? 0) : null;
  const dAdr     = cmp ? adr     - Number(cmp?.adr_usd        ?? 0) : null;
  const dRevpar  = cmp ? revpar  - Number(cmp?.revpar_usd     ?? 0) : null;
  const dTrevpar = cmp ? trevpar - Number(cmp?.trevpar_usd    ?? 0) : null;

  const totalRevWindow = (rangeRev as any[]).reduce(
    (s: number, r: any) => s + Number(r.revenue_actual_usd ?? 0), 0,
  );

  // Pace deltas — sum past 30d actual vs STLY and OTB next 30d vs STLY.
  const past = paceCurve.filter((r: any) => Number(r.day_offset) < 0);
  const fwd  = paceCurve.filter((r: any) => Number(r.day_offset) >= 0);
  const sumActualPast = past.reduce((s: number, r: any) => s + Number(r.actual ?? 0), 0);
  const sumStlyPast   = past.reduce((s: number, r: any) => s + Number(r.stly   ?? 0), 0);
  const sumOtbFwd     = fwd .reduce((s: number, r: any) => s + Number(r.otb    ?? 0), 0);
  const sumStlyFwd    = fwd .reduce((s: number, r: any) => s + Number(r.stly   ?? 0), 0);
  const pacePastPct = sumStlyPast > 0 ? ((sumActualPast - sumStlyPast) / sumStlyPast) * 100 : 0;
  const paceFwdPct  = sumStlyFwd  > 0 ? ((sumOtbFwd     - sumStlyFwd ) / sumStlyFwd ) * 100 : 0;

  const briefSignal =
    `${period.label} · pace fwd ${paceFwdPct >= 0 ? '+' : ''}${paceFwdPct.toFixed(0)}% vs STLY · ` +
    `past ${pacePastPct >= 0 ? '+' : ''}${pacePastPct.toFixed(0)}% vs STLY`;
  const briefBody =
    `Window revenue $${totalRevWindow.toLocaleString(undefined, { maximumFractionDigits: 0 })} · ` +
    `OCC ${occ.toFixed(0)}% · ADR $${adr.toFixed(0)} · RevPAR $${revpar.toFixed(0)}.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (paceFwdPct >= 5)  good.push(`Forward pace +${paceFwdPct.toFixed(0)}% vs STLY — protect rate.`);
  if (paceFwdPct <= -5) bad.push(`Forward pace ${paceFwdPct.toFixed(0)}% vs STLY — pickup risk; check pricing & channel mix.`);
  if (pacePastPct >= 5) good.push(`Past pace +${pacePastPct.toFixed(0)}% vs STLY — strong base.`);
  if (pacePastPct <= -5) bad.push(`Past pace ${pacePastPct.toFixed(0)}% vs STLY — softness in the rear-view.`);
  if (good.length === 0) good.push('Pace flat / mixed against STLY.');
  if (bad.length === 0)  bad.push ('No structural pace risk flagged.');

  if (paceCurve.length === 0 && channels.length === 0) {
    return (
      <div data-panel style={{
        padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center',
        background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 10,
      }}>
        No pace data for this window. Pace curve view returned 0 rows.
      </div>
    );
  }

  return (
    <>
      <Brief brief={{ signal: briefSignal, body: briefBody, good, bad }} actions={null} />

      <div style={{ height: 14 }} />

      <Panel title="Headline KPIs" eyebrow="this period" hideExpander>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiBox value={occ} unit="pct" label="Occupancy"
            compare={dOcc != null ? { value: dOcc, unit: 'pp', period: cmpLabel } : undefined} />
          <KpiBox value={adr} unit="usd" label="ADR"
            compare={dAdr != null ? { value: dAdr, unit: 'usd', period: cmpLabel } : undefined} />
          <KpiBox value={revpar} unit="usd" label="RevPAR"
            compare={dRevpar != null ? { value: dRevpar, unit: 'usd', period: cmpLabel } : undefined} />
          <KpiBox value={trevpar} unit="usd" label="TRevPAR"
            compare={dTrevpar != null ? { value: dTrevpar, unit: 'usd', period: cmpLabel } : undefined} />
          <KpiBox value={totalRevWindow} unit="usd" label="Total rev (window)" />
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Pace curve · −30d → +30d" eyebrow="actual / OTB / STLY / budget" hideExpander>
        {paceCurve.length === 0 ? (
          <div style={{ padding: 20, color: '#7d7565', fontStyle: 'italic' }}>
            No pace data for this window.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="num">Actual</th>
                  <th className="num">OTB</th>
                  <th className="num">STLY</th>
                  <th className="num">Budget</th>
                </tr>
              </thead>
              <tbody>
                {paceCurve.map((r: any) => (
                  <tr key={r.day_offset ?? r.day}>
                    <td className="lbl">{r.day_offset != null ? `${r.day_offset > 0 ? '+' : ''}${r.day_offset}d` : r.day}</td>
                    <td className="num">{r.actual != null ? fmtTableUsd(Number(r.actual)) : '—'}</td>
                    <td className="num">{r.otb    != null ? fmtTableUsd(Number(r.otb))    : '—'}</td>
                    <td className="num">{r.stly   != null ? fmtTableUsd(Number(r.stly))   : '—'}</td>
                    <td className="num">{r.budget != null ? fmtTableUsd(Number(r.budget)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
