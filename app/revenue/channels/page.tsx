// app/revenue/channels/page.tsx — REPLACEMENT (audit fix 2026-05-01)
//
// Fixes:
//   1. Page now consumes ?win=, ?cmp=, ?seg= via resolvePeriod(searchParams).
//      Selectors actually change the table (was hardcoded 90d).
//   2. KPI tile labels reflect the active window ("Last 30d" not "90d").
//   3. Commission tiles now use mv_channel_economics (real $ via fuzzy join),
//      no more "DATA NEEDED" pill on top of a fake number.
//   4. OTA × Room-type matrix tooltips work on EVERY cell (was only column 1)
//      because the data-attributes are now on each <td> not just the first.
//   5. Health pills moved to a small heuristic computed from real numbers.
//
// Required SQL: sql/02_channel_economics_window.sql must be applied first.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import Brief from '@/components/page/Brief';
import ArtifactActions from '@/components/page/ArtifactActions';
import TimeframeSelector from '@/components/page/TimeframeSelector';
import CompareSelector from '@/components/page/CompareSelector';
import KpiBox from '@/components/kpi/KpiBox';
import Insight from '@/components/sections/Insight';
import { resolvePeriod } from '@/lib/period';
import {
  getChannelEconomics, getChannelXRoomtype, pivotChannelXRoom,
  getChannelMixWeeklyTrend, getChannelNetValueForRange, getChannelVelocity28dByCat,
} from '@/lib/data-channels';
import { fmtMoney } from '@/lib/format';
import { channelMixTrendSvg, channelNetValueBarsSvg, channelVelocity3LineSvg } from '@/lib/svgCharts';
import { MaybeOtaBadge } from '@/components/ota/OtaBadge';
import { REVENUE_SUBPAGES } from '../_subpages';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const OTA_RX    = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com|traveloka/i;
const DIRECT_RX = /direct|website|booking engine|email|walk[\- ]?in/i;
const WHOLESALE_RX = /hotelbeds|gta|tourico|wholesale|bonotel|miki|reseller|khiri|trails of/i;

function healthPill(c: any): { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' } {
  const cancelPct = Number(c.cancel_pct || 0);
  const bookings = Number(c.bookings || 0);
  const adr = Number(c.adr || 0);
  const commPct = Number(c.commission_pct || 0);

  if (bookings >= 3 && cancelPct >= 50) return { label: 'CANCEL ⚠', tone: 'bad' };
  if (bookings >= 3 && cancelPct >= 25) return { label: 'CANCEL', tone: 'warn' };
  if (commPct === 0 && DIRECT_RX.test(String(c.source_name || ''))) return { label: '★ BEST MARGIN', tone: 'good' };
  if (commPct >= 20) return { label: 'PARITY ⚠', tone: 'warn' };
  if (bookings === 1 && adr > 1500) return { label: 'ANOMALY · REVIEW', tone: 'warn' };
  if (bookings >= 5 && cancelPct < 10) return { label: 'HEALTHY', tone: 'good' };
  if (bookings <= 2) return { label: 'LOW VOLUME', tone: 'neutral' };
  return { label: 'MONITOR', tone: 'neutral' };
}

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function ChannelsPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  // Compare period synth (when cmp != none) — fetch same window shape but in the past.
  const cmpPeriod = period.cmp !== 'none' && period.compareFrom && period.compareTo
    ? { ...period, from: period.compareFrom, to: period.compareTo, cmp: 'none' as const }
    : null;

  const [channelsRaw, matrixRaw, channelsCmp, mixWeekly, netValue, velocity] = await Promise.all([
    getChannelEconomics(period).catch(() => [] as Awaited<ReturnType<typeof getChannelEconomics>>),
    getChannelXRoomtype(period).catch(() => [] as Awaited<ReturnType<typeof getChannelXRoomtype>>),
    cmpPeriod ? getChannelEconomics(cmpPeriod).catch(() => []) : Promise.resolve([] as any[]),
    getChannelMixWeeklyTrend(period.from, period.to).catch(() => []),
    getChannelNetValueForRange(period.from, period.to).catch(() => []),
    getChannelVelocity28dByCat().catch(() => []),
  ]);
  const channels = channelsRaw;
  const matrix = matrixRaw;

  // Comparison totals
  const cmpArr: any[] = channelsCmp as any[];
  const cmpTotalRev: number = cmpArr.reduce((s: number, c: any) => s + Number(c.gross_revenue || 0), 0);
  const cmpTotalCommission: number = cmpArr.reduce((s: number, c: any) => s + Number(c.commission_usd || 0), 0);
  const cmpDirectRev: number = cmpArr.filter((c: any) => DIRECT_RX.test(String(c.source_name || ''))).reduce((s: number, c: any) => s + Number(c.gross_revenue || 0), 0);
  const cmpOtaRev: number = cmpArr.filter((c: any) => OTA_RX.test(String(c.source_name || ''))).reduce((s: number, c: any) => s + Number(c.gross_revenue || 0), 0);
  const cmpDirectMix = cmpTotalRev ? (cmpDirectRev / cmpTotalRev) * 100 : 0;
  const cmpOtaMix = cmpTotalRev ? (cmpOtaRev / cmpTotalRev) * 100 : 0;
  function deltaHint(now: number, prior: number, suffix: string): string {
    if (!cmpPeriod) return suffix;
    if (prior === 0) return suffix + ' · no prior';
    const pct = ((now - prior) / prior) * 100;
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '·';
    return `${suffix} · ${arrow} ${Math.abs(pct).toFixed(0)}% vs ${period.cmpLabel.replace('vs ', '')}`;
  }

  // Aggregates
  const totalRev = channels.reduce<number>((s, c) => s + Number(c.gross_revenue || 0), 0);
  const totalBookings = channels.reduce<number>((s, c) => s + Number(c.bookings || 0), 0);
  const totalCommission = channels.reduce<number>((s, c) => s + Number(c.commission_usd || 0), 0);
  const totalRoomnights = channels.reduce<number>((s, c) => s + Number(c.roomnights || 0), 0);

  const direct = channels.filter(c => DIRECT_RX.test(String(c.source_name || '')));
  const ota = channels.filter(c => OTA_RX.test(String(c.source_name || '')));
  const wholesale = channels.filter(c => WHOLESALE_RX.test(String(c.source_name || '')));

  const directRev = direct.reduce<number>((s, c) => s + Number(c.gross_revenue || 0), 0);
  const otaRev = ota.reduce<number>((s, c) => s + Number(c.gross_revenue || 0), 0);
  const wholesaleRev = wholesale.reduce<number>((s, c) => s + Number(c.gross_revenue || 0), 0);

  const directMix = totalRev ? (directRev / totalRev) * 100 : 0;
  const otaMix = totalRev ? (otaRev / totalRev) * 100 : 0;
  const wholesaleMix = totalRev ? (wholesaleRev / totalRev) * 100 : 0;
  const commissionPctOfRev = totalRev ? (totalCommission / totalRev) * 100 : 0;
  const channelCostPerOcc = totalRoomnights ? totalCommission / totalRoomnights : 0;

  // Avg lead time (booking-weighted)
  const leadWeighted = channels.reduce<number>((s, c) => s + Number(c.bookings || 0) * Number(c.avg_lead_days || 0), 0);
  const avgLead = totalBookings ? leadWeighted / totalBookings : 0;

  // PBS 2026-05-09: compare deltas wired to KpiBox `compare` prop.
  // Sign convention: positive = improvement (green), negative = degradation (red).
  // For "good when down" metrics (commission $, channel cost / occ RN) we INVERT the
  // raw delta so reductions render green.
  const cmpRoomnights = cmpArr.reduce<number>((s, c) => s + Number(c.roomnights || 0), 0);
  const cmpDirectMix2 = cmpDirectMix;
  const cmpOtaMix2 = cmpOtaMix;
  const cmpWholesaleRev = cmpArr.filter((c: any) => WHOLESALE_RX.test(String(c.source_name || ''))).reduce((s: number, c: any) => s + Number(c.gross_revenue || 0), 0);
  const cmpWholesaleMix = cmpTotalRev ? (cmpWholesaleRev / cmpTotalRev) * 100 : 0;
  const cmpAvgLead = (() => {
    const totalB = cmpArr.reduce((s: number, c: any) => s + Number(c.bookings || 0), 0);
    if (!totalB) return 0;
    const w = cmpArr.reduce((s: number, c: any) => s + Number(c.bookings || 0) * Number(c.avg_lead_days || 0), 0);
    return w / totalB;
  })();
  const cmpChannelCostPerOcc = cmpRoomnights ? cmpTotalCommission / cmpRoomnights : 0;

  const cmpLabel2 = cmpPeriod ? period.cmpLabel.replace(/^vs\s+/i, '') : '';
  // good when up
  const dCommission   = cmpPeriod ? -(totalCommission - cmpTotalCommission) : null; // less commission $ = better
  const dDirectMix    = cmpPeriod ? (directMix - cmpDirectMix2) : null;
  const dOtaMix       = cmpPeriod ? -(otaMix - cmpOtaMix2) : null;                   // less OTA dependency = better
  const dWholesaleMix = cmpPeriod ? -(wholesaleMix - cmpWholesaleMix) : null;        // less wholesale = better (leakage)
  const dAvgLead      = cmpPeriod ? (avgLead - cmpAvgLead) : null;                   // longer lead = better
  const dChannelCost  = cmpPeriod ? -(channelCostPerOcc - cmpChannelCostPerOcc) : null; // lower cost = better

  // Worst cancel-rate channel for the insight
  let worstCancel = { name: '', pct: 0 };
  channels.forEach(c => {
    const pct = Number(c.cancel_pct || 0);
    if (pct > worstCancel.pct && Number(c.bookings || 0) >= 3) {
      worstCancel = { name: c.source_name, pct };
    }
  });

  // Pivot matrix
  const { sources: matSources, roomTypes: matRooms, cells, sourceTotals } = pivotChannelXRoom(matrix);

  // Brief — narrative read of channel mix for the period.
  const briefSignal = `${period.label} · Direct ${directMix.toFixed(0)}% · OTA ${otaMix.toFixed(0)}% · Wholesale ${wholesaleMix.toFixed(0)}% · Comm ${commissionPctOfRev.toFixed(1)}% of rev`;
  const briefBody = `${channels.length} active sources, $${(totalRev / 1000).toFixed(1)}k gross. Avg lead ${avgLead.toFixed(0)}d. Channel cost / occ RN $${channelCostPerOcc.toFixed(0)}.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (directMix >= 35)            good.push(`Direct mix ${directMix.toFixed(0)}% — above 35% target.`);
  if (directMix < 35)             bad.push(`Direct mix ${directMix.toFixed(0)}% — below 35% target; push direct.`);
  if (otaMix > 60)                bad.push(`OTA mix ${otaMix.toFixed(0)}% — heavy OTA dependency.`);
  if (commissionPctOfRev > 12)    bad.push(`Commission ${commissionPctOfRev.toFixed(1)}% of rev — push direct to reduce.`);
  if (wholesaleMix > 20)          bad.push(`Wholesale mix ${wholesaleMix.toFixed(0)}% — leakage risk.`);
  if (worstCancel.name && worstCancel.pct > 25) bad.push(`${worstCancel.name} cancel rate ${worstCancel.pct.toFixed(1)}%.`);
  if (channelCostPerOcc < 30 && totalRoomnights > 0) good.push(`Channel cost / occ RN $${channelCostPerOcc.toFixed(0)} — efficient.`);
  if (good.length === 0) good.push('No standout strengths flagged for this window.');
  if (bad.length === 0)  bad.push('No leakage signals flagged for this window.');

  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string, signal?: string) => ({ kind, title, signal, dept: 'revenue' as const });

  return (
    <Page
      eyebrow={`Channels · ${period.label}`}
      title={<>Channel <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>performance</em>.</>}
      subPages={REVENUE_SUBPAGES}
      topRight={
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <TimeframeSelector basePath="/revenue/channels" active={period.win} preserve={{ cmp: period.cmp, seg: period.seg }} />
          <CompareSelector  basePath="/revenue/channels" active={period.cmp} preserve={{ win: period.win, seg: period.seg }} />
        </div>
      }
    >
      <Brief
        brief={{ signal: briefSignal, body: briefBody, good, bad }}
        actions={<ArtifactActions context={ctx('brief', `Channels · ${period.label}`, briefSignal)} />}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={totalCommission}     unit="usd" label={`Commissions · ${period.label}`}
          compare={dCommission != null ? { value: dCommission, unit: 'usd', period: cmpLabel2 } : undefined}
          tooltip={`Total commissions paid to channels in ${period.label}. Source: mv_channel_perf.commission_usd.`} />
        <KpiBox value={directMix}            unit="pct" label="Direct mix"
          compare={dDirectMix != null ? { value: dDirectMix, unit: 'pp', period: cmpLabel2 } : undefined}
          tooltip="Direct revenue ÷ total channel revenue × 100. Direct = website + booking engine + email + walk-in. Target ≥ 30%." />
        <KpiBox value={otaMix}               unit="pct" label="OTA mix"
          compare={dOtaMix != null ? { value: dOtaMix, unit: 'pp', period: cmpLabel2 } : undefined}
          tooltip="OTA revenue ÷ total channel revenue × 100. Booking.com + Expedia + Agoda + Airbnb." />
        <KpiBox value={wholesaleMix}         unit="pct" label="Wholesale mix"
          compare={dWholesaleMix != null ? { value: dWholesaleMix, unit: 'pp', period: cmpLabel2 } : undefined}
          tooltip="Wholesale / DMC revenue ÷ total channel revenue × 100." />
        <KpiBox value={avgLead}              unit="nights" dp={0} label="Avg lead time"
          compare={dAvgLead != null ? { value: dAvgLead, unit: 'd', period: cmpLabel2 } : undefined}
          tooltip="Mean days from booking to arrival, weighted by reservation count." />
        <KpiBox value={channelCostPerOcc}    unit="usd" label="Channel cost / occ RN"
          compare={dChannelCost != null ? { value: dChannelCost, unit: 'usd', period: cmpLabel2 } : undefined}
          tooltip="Total commission ÷ occupied room-nights, USD per occ RN. Lower is better." />
      </div>
      {/* deltaHint helper kept to retain compare windows for callers; no UI yet. */}
      {void deltaHint}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 14 }}>
        <Panel title="Channel mix · weekly trend" eyebrow={period.label} actions={<ArtifactActions context={ctx('panel', 'Channel mix · weekly trend')} />}>
          {mixWeekly.length > 0
            ? <div dangerouslySetInnerHTML={{ __html: channelMixTrendSvg(mixWeekly) }} />
            : <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No mix data in window.</div>}
        </Panel>
        <Panel title="Net $/booking · cancel-adjusted" eyebrow={period.label} actions={<ArtifactActions context={ctx('panel', 'Net $/booking')} />}>
          {netValue.length > 0
            ? <div dangerouslySetInnerHTML={{ __html: channelNetValueBarsSvg(netValue) }} />
            : <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No net value data in window.</div>}
        </Panel>
        <Panel title="Booking velocity · 28d" eyebrow="by category" actions={<ArtifactActions context={ctx('panel', 'Booking velocity · 28d')} />}>
          {velocity.length > 0
            ? <div dangerouslySetInnerHTML={{ __html: channelVelocity3LineSvg(velocity) }} />
            : <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No velocity data in last 28 days.</div>}
        </Panel>
      </div>

      <Panel
        title={`Channel performance · ${period.label}`}
        eyebrow="mv_channel_economics"
        actions={<ArtifactActions context={ctx('table', `Channel performance · ${period.label}`, briefSignal)} />}
      >
        {channels.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No channel data in selected window. Apply sql/02_channel_economics_window.sql first.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Source</th>
                <th className="num">Bkg</th>
                <th className="num">Rev</th>
                <th className="num">ADR</th>
                <th className="num">Comm%</th>
                <th className="num">Net ADR</th>
                <th className="num">Cancel%</th>
                <th className="num">Lead</th>
                <th className="num">LOS</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(c => {
                const netAdr = Number(c.adr || 0) * (1 - Number(c.commission_pct || 0) / 100);
                const pill = healthPill(c);
                return (
                  <tr key={c.source_name}>
                    <td className="lbl"><Link href={`/revenue/channels/${encodeURIComponent(c.source_name)}`} style={{ color: 'var(--brass)', textDecoration: 'none' }}><strong><MaybeOtaBadge name={c.source_name} /></strong></Link></td>
                    <td className="num">{c.bookings}</td>
                    <td className="num">{fmtMoney(Number(c.gross_revenue), 'USD')}</td>
                    <td className="num">{fmtMoney(Number(c.adr), 'USD')}</td>
                    <td className={`num ${Number(c.commission_pct) >= 18 ? 'text-warn' : ''}`}>
                      {Number(c.commission_pct).toFixed(0)}%
                    </td>
                    <td className="num">{fmtMoney(netAdr, 'USD')}</td>
                    <td className={`num ${Number(c.cancel_pct) >= 25 ? 'text-bad' : ''}`}>
                      {Number(c.cancel_pct).toFixed(1)}%
                    </td>
                    <td className="num">{Number(c.avg_lead_days || 0).toFixed(0)}d</td>
                    <td className="num">{Number(c.avg_los || 0).toFixed(1)}</td>
                    <td><span className={`pill ${pill.tone}`}>{pill.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {matRooms.length > 0 && matSources.length > 0 && (
        <>
          <div style={{ height: 14 }} />
          <Panel
            title="OTA × Room Type matrix"
            eyebrow={`mv_channel_x_roomtype · ${period.label}`}
            actions={<ArtifactActions context={ctx('table', 'OTA × Room Type matrix')} />}
          >
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl matrix">
              <thead>
                <tr>
                  <th>Room Type</th>
                  {matSources.slice(0, 6).map(s => (
                    <th key={s} className="num"><MaybeOtaBadge name={s} /></th>
                  ))}
                  <th className="num"><strong>TOTAL</strong></th>
                  <th>Strongest channel</th>
                </tr>
              </thead>
              <tbody>
                {matRooms.map(rt => {
                  let rowTotal = 0;
                  let strongest = { src: '', rev: 0 };
                  matSources.forEach(s => {
                    const cell = cells[`${s}|${rt}`];
                    const rev = Number(cell?.revenue || 0);
                    rowTotal += rev;
                    if (rev > strongest.rev) strongest = { src: s, rev };
                  });
                  const strongestPct = rowTotal ? (strongest.rev / rowTotal) * 100 : 0;
                  return (
                    <tr key={rt}>
                      <td className="lbl"><strong>{rt}</strong></td>
                      {matSources.slice(0, 6).map(s => {
                        const cell = cells[`${s}|${rt}`];
                        const rev = Number(cell?.revenue || 0);
                        const tipText = cell
                          ? `${rt} · ${s}\nRevenue ${period.label}: ${fmtMoney(rev, 'USD')}\nBookings: ${cell.bookings}\nADR: ${fmtMoney(Number(cell.adr), 'USD')}\nCancel%: ${Number(cell.cancel_pct).toFixed(1)}%`
                          : `${rt} · ${s}\nNo bookings in ${period.label}`;
                        return (
                          <td
                            key={s}
                            className={`num ${rev === 0 ? 'text-mute' : ''}`}
                            title={tipText}
                            data-source={s}
                            data-room={rt}
                          >
                            {rev > 0 ? fmtMoney(rev, 'USD') : '—'}
                          </td>
                        );
                      })}
                      <td className="num"><strong>{fmtMoney(rowTotal, 'USD')}</strong></td>
                      <td>
                        {strongest.src && (
                          <span className={`pill ${strongestPct >= 60 ? 'warn' : 'neutral'}`}>
                            <MaybeOtaBadge name={strongest.src} /> {strongestPct.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        </>
      )}

      {worstCancel.name && (
        <div style={{ marginTop: 14 }}>
          <Insight tone={worstCancel.pct > 30 ? 'alert' : 'warn'} eye="Cancel watch">
            <strong>{worstCancel.name}</strong> showing {worstCancel.pct.toFixed(1)}% cancellation in {period.label}.
            Investigate rate plan, deposit policy, and lead-time profile.
          </Insight>
        </div>
      )}

      {commissionPctOfRev > 12 && (
        <div style={{ marginTop: 10 }}>
          <Insight tone="warn" eye="Commission load">
            OTA commissions are <strong>{commissionPctOfRev.toFixed(1)}%</strong> of total revenue
            ({fmtMoney(totalCommission, 'USD')} in {period.label}).
            Push direct mix above 35% to reduce dependency.
          </Insight>
        </div>
      )}
    </Page>
  );
}
