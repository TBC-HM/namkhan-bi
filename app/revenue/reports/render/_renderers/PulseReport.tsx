// app/revenue/reports/render/_renderers/PulseReport.tsx
// Pulse report — today's snapshot: occ / ADR / RevPAR / TRevPAR + channel
// mix top 5 + top-3 tactical alerts. Server component.

import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import Brief from '@/components/page/Brief';
import { getOverviewKpis, getChannelPerf } from '@/lib/data';
import { getTacticalAlertsTop } from '@/lib/pulseData';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props { period: ResolvedPeriod }

export default async function PulseReport({ period }: Props) {
  const [kpis, channels, alerts] = await Promise.all([
    getOverviewKpis(period).catch(() => ({ current: null, compare: null } as any)),
    getChannelPerf(period).catch(() => [] as any[]),
    getTacticalAlertsTop().catch(() => [] as any[]),
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

  // Channel mix totals
  const channelTotal = channels.reduce(
    (s, c: any) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0,
  );
  const directRev = channels
    .filter((c: any) => /direct|website|booking engine|email|walk[- ]?in/i.test(String(c.source_name || '')))
    .reduce((s: number, c: any) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0);
  const directShare = channelTotal > 0 ? (directRev / channelTotal) * 100 : 0;
  const top5 = channels.slice(0, 5);

  const briefSignal =
    `${period.label} · OCC ${occ.toFixed(0)}% · ADR $${adr.toFixed(0)} · ` +
    `RevPAR $${revpar.toFixed(0)} · TRevPAR $${trevpar.toFixed(0)}`;
  const briefBody =
    `${alerts.length} tactical alert${alerts.length === 1 ? '' : 's'} live · ` +
    `Direct share ${directShare.toFixed(0)}% across the channel set.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (occ >= 70)         good.push(`Occupancy ${occ.toFixed(0)}% — strong base.`);
  if (occ < 50)          bad.push (`Occupancy ${occ.toFixed(0)}% — soft; check pricing & channel mix.`);
  if (adr >= 200)        good.push(`ADR $${adr.toFixed(0)} — premium pricing holding.`);
  if (revpar >= 150)     good.push(`RevPAR $${revpar.toFixed(0)} — top-line healthy.`);
  if (directShare >= 30) good.push(`Direct share ${directShare.toFixed(0)}% — channel mix healthy.`);
  if (alerts.length > 0) bad.push (`${alerts.length} tactical alerts open — see panel below.`);
  if (good.length === 0) good.push('No standout strengths flagged for this period.');
  if (bad.length === 0)  bad.push ('No leakage signals flagged for this period.');

  const hasAnyData = occ > 0 || adr > 0 || revpar > 0 || channels.length > 0;

  if (!hasAnyData) {
    return (
      <div data-panel style={{
        padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center',
        background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 10,
      }}>
        No pulse data for {period.label}. Cloudbeds returned no rows for this window.
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
            compare={dOcc != null ? { value: dOcc, unit: 'pp', period: cmpLabel } : undefined}
            tooltip="Occupancy % across the period." />
          <KpiBox value={adr} unit="usd" label="ADR"
            compare={dAdr != null ? { value: dAdr, unit: 'usd', period: cmpLabel } : undefined}
            tooltip="Average daily rate in USD." />
          <KpiBox value={revpar} unit="usd" label="RevPAR"
            compare={dRevpar != null ? { value: dRevpar, unit: 'usd', period: cmpLabel } : undefined}
            tooltip="Revenue per available room." />
          <KpiBox value={trevpar} unit="usd" label="TRevPAR"
            compare={dTrevpar != null ? { value: dTrevpar, unit: 'usd', period: cmpLabel } : undefined}
            tooltip="Total revenue per available room." />
          <KpiBox value={directShare} unit="pct" label="Direct share"
            tooltip="Direct revenue ÷ total channel revenue × 100." />
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Top channels" eyebrow={`${top5.length} of ${channels.length}`} hideExpander>
        {top5.length === 0 ? (
          <div style={{ padding: 20, color: '#7d7565', fontStyle: 'italic' }}>
            No channel revenue captured for this window.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Revenue</th>
                <th className="num">Bookings</th>
                <th className="num">Share %</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((c: any, i: number) => {
                const rev = Number(c.revenue_30d || c.revenue_90d || 0);
                const bookings = Number(c.bookings_30d || c.bookings_90d || 0);
                const share = channelTotal > 0 ? (rev / channelTotal) * 100 : 0;
                return (
                  <tr key={c.source_name ?? i}>
                    <td className="lbl">{c.source_name ?? '—'}</td>
                    <td className="num">{fmtTableUsd(rev)}</td>
                    <td className="num">{bookings.toLocaleString()}</td>
                    <td className="num">{share.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Live tactical alerts" eyebrow={`${alerts.length} open`} hideExpander>
        {alerts.length === 0 ? (
          <div style={{ padding: 20, color: '#7d7565', fontStyle: 'italic' }}>
            No tactical alerts at this moment.
          </div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: '#d8cca8', fontSize: 13, lineHeight: 1.7 }}>
            {alerts.slice(0, 3).map((a: any, i: number) => (
              <li key={i}>{a.title ?? a.label ?? JSON.stringify(a).slice(0, 200)}</li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
