// app/revenue/reports/[type]/page.tsx
// PBS 2026-05-09 #23: "In the reports section in revenue on the entry page in
// the box there is a default report but when I press it I dont get a report
// I get a link to the pace page - we need a report which can be send and
// printed and pops up on the screen".
//
// This route renders a printable, sendable, screen-friendly summary for one
// of the revenue report types. Currently supports `pace`; other types render
// a coming-soon panel that still prints clean.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import Brief from '@/components/page/Brief';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { getOverviewKpis, getKpiDaily, aggregateDaily, getChannelPerf } from '@/lib/data';
import { getPaceCurve, getDailyRevenueForRange, getTacticalAlertsTop } from '@/lib/pulseData';
import PrintControls from './PrintControls';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const TITLE_BY_TYPE: Record<string, string> = {
  pulse:    'Pulse report',
  pace:     'Pace report',
  channels: 'Channels report',
  pricing:  'Pricing report',
  comp_set: 'Comp set report',
  forecast: 'Forecast report',
  all:      'Revenue report',
};

interface Props {
  params: { type: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function RevenueReport({ params, searchParams }: Props) {
  const type = params.type ?? 'pace';
  const title = TITLE_BY_TYPE[type] ?? 'Revenue report';
  const period = resolvePeriod(searchParams);

  const [kpis, daily, paceCurve, rangeRev, channels, alerts] = await Promise.all([
    getOverviewKpis(period).catch(() => ({ current: null, compare: null } as any)),
    getKpiDaily(period.from, period.to).catch(() => [] as any[]),
    getPaceCurve(30, 30).catch(() => []),
    getDailyRevenueForRange(period.from, period.to).catch(() => []),
    getChannelPerf().catch(() => [] as any[]),
    getTacticalAlertsTop().catch(() => []),
  ]);

  const cur = kpis.current;
  const cmp = kpis.compare; // null when cmp=none/budget or data layer didn't return compare row
  const occ = Number(cur?.occupancy_pct ?? 0);
  const adr = Number(cur?.adr_usd ?? 0);
  const revpar = Number(cur?.revpar_usd ?? 0);
  const trevpar = Number(cur?.trevpar_usd ?? 0);

  // PBS 2026-05-09: compare deltas wired (mirrors /revenue/pulse).
  const cmpLabel = period.cmpLabel ? period.cmpLabel.replace(/^vs\s+/i, '') : '';
  const cmpOcc     = cmp ? Number(cur?.occupancy_pct ?? 0) - Number(cmp?.occupancy_pct ?? 0) : null;
  const cmpAdr     = cmp ? Number(cur?.adr_usd        ?? 0) - Number(cmp?.adr_usd        ?? 0) : null;
  const cmpRevpar  = cmp ? Number(cur?.revpar_usd     ?? 0) - Number(cmp?.revpar_usd     ?? 0) : null;
  const cmpTrevpar = cmp ? Number(cur?.trevpar_usd    ?? 0) - Number(cmp?.trevpar_usd    ?? 0) : null;

  const a30 = aggregateDaily(daily, period.capacityMode);
  const totalRevWindow = (rangeRev as any[]).reduce(
    (s: number, r: any) => s + Number(r.revenue_actual_usd ?? 0),
    0,
  );
  const directShare = (() => {
    const total = channels.reduce((s: number, c: any) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0);
    if (total <= 0) return 0;
    const direct = channels
      .filter((c: any) => /direct|website|booking engine|email|walk[- ]?in/i.test(String(c.source_name || '')))
      .reduce((s: number, c: any) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0);
    return (direct / total) * 100;
  })();

  const briefSignal = `${period.label} · OCC ${occ.toFixed(0)}% · ADR $${adr.toFixed(0)} · RevPAR $${revpar.toFixed(0)} · TRevPAR $${trevpar.toFixed(0)}`;
  const briefBody = `${alerts.length} tactical alert${alerts.length === 1 ? '' : 's'} live. Direct share ${directShare.toFixed(0)}% across the channel set.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (occ >= 70)        good.push(`Occupancy ${occ.toFixed(0)}% — strong base.`);
  if (occ < 50)         bad.push(`Occupancy ${occ.toFixed(0)}% — soft; check pricing & channel mix.`);
  if (adr >= 200)       good.push(`ADR $${adr.toFixed(0)} — premium pricing holding.`);
  if (revpar >= 150)    good.push(`RevPAR $${revpar.toFixed(0)} — top-line healthy.`);
  if (directShare >= 30) good.push(`Direct share ${directShare.toFixed(0)}% — channel mix healthy.`);
  if (alerts.length > 0) bad.push(`${alerts.length} tactical alerts open — review the alerts panel.`);
  if (good.length === 0) good.push('No standout strengths flagged for this period.');
  if (bad.length === 0)  bad.push('No leakage signals flagged for this period.');

  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <Page
      eyebrow={`Revenue · Reports · ${period.label}`}
      title={<>{title.split(' ')[0]} <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>report</em></>}
      topRight={<PrintControls reportType={type} />}
      footer={false}
    >
      <style>{`
        @media print {
          body, html { background: #fff !important; color: #000 !important; }
          [data-panel] { break-inside: avoid; box-shadow: none !important; }
          [data-panel] [aria-label="Open department menu"],
          [aria-label="Open department menu"],
          .no-print { display: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
        .report-meta { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; color: #9b907a; letter-spacing: 0.10em; text-transform: uppercase; }
      `}</style>

      <div className="report-meta" style={{ marginBottom: 14 }}>
        Generated {stamp} · Source · Cloudbeds · QB · Property 260955
      </div>

      <Brief
        brief={{ signal: briefSignal, body: briefBody, good, bad }}
        actions={null}
      />

      <Panel title="Headline KPIs" eyebrow="this period" hideExpander>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiBox value={occ}     unit="pct" label="Occupancy"
            compare={cmpOcc != null ? { value: cmpOcc, unit: 'pp', period: cmpLabel } : undefined}
            tooltip="Occupancy % across the period." />
          <KpiBox value={adr}     unit="usd" label="ADR"
            compare={cmpAdr != null ? { value: cmpAdr, unit: 'usd', period: cmpLabel } : undefined}
            tooltip="Average daily rate in USD." />
          <KpiBox value={revpar}  unit="usd" label="RevPAR"
            compare={cmpRevpar != null ? { value: cmpRevpar, unit: 'usd', period: cmpLabel } : undefined}
            tooltip="Revenue per available room." />
          <KpiBox value={trevpar} unit="usd" label="TRevPAR"
            compare={cmpTrevpar != null ? { value: cmpTrevpar, unit: 'usd', period: cmpLabel } : undefined}
            tooltip="Total revenue per available room." />
          <KpiBox value={totalRevWindow} unit="usd" label="Total rev (window)" tooltip="Sum of revenue_actual_usd across the window. Source: getDailyRevenueForRange." />
          <KpiBox value={directShare}    unit="pct" label="Direct share" tooltip="Direct revenue ÷ total channel revenue × 100. Direct includes website, email, walk-in." />
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title={`Pace curve · −30d → +30d`} eyebrow="actual / OTB / STLY / budget" hideExpander>
        {paceCurve.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>
            No pace data for this period.
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
                    <td className="num">{r.actual != null ? Math.round(Number(r.actual)).toLocaleString() : '—'}</td>
                    <td className="num">{r.otb    != null ? Math.round(Number(r.otb)).toLocaleString()    : '—'}</td>
                    <td className="num">{r.stly   != null ? Math.round(Number(r.stly)).toLocaleString()   : '—'}</td>
                    <td className="num">{r.budget != null ? Math.round(Number(r.budget)).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Live tactical alerts" eyebrow={`${alerts.length} open`} hideExpander>
        {alerts.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>
            No tactical alerts at this moment.
          </div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--line-soft)', fontSize: 13, lineHeight: 1.7 }}>
            {alerts.map((a: any, i: number) => (
              <li key={i}>{a.title ?? a.label ?? JSON.stringify(a).slice(0, 200)}</li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="no-print" style={{ marginTop: 24, fontSize: 11, color: '#7d7565' }}>
        <Link href="/revenue/pulse" style={{ color: '#a8854a', marginRight: 12 }}>↗ Open live Pulse</Link>
        <Link href="/revenue/pace" style={{ color: '#a8854a', marginRight: 12 }}>↗ Open live Pace</Link>
        <Link href="/revenue" style={{ color: '#a8854a' }}>↗ Revenue index</Link>
      </div>
    </Page>
  );
}
