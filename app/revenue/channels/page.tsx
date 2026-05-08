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
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import Insight from '@/components/sections/Insight';
import { resolvePeriod } from '@/lib/period';
import {
  getChannelEconomics, getChannelXRoomtype, pivotChannelXRoom,
  getChannelMixWeeklyTrend, getChannelNetValueForRange, getChannelVelocity28dByCat,
} from '@/lib/data-channels';
import { fmtMoney } from '@/lib/format';
import { channelMixTrendSvg, channelNetValueBarsSvg, channelVelocity3LineSvg } from '@/lib/svgCharts';

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

  return (
    <>
      <PanelHero
        eyebrow={`Channels · ${period.label}`}
        title="Channel"
        emphasis="performance"
        sub={`${period.rangeLabel} · source mix · commission · ADR · cancel rate`}
        kpis={
          <>
            <KpiCard
              label={`Commissions ${period.label}`}
              value={totalCommission}
              kind="money"
              tone={commissionPctOfRev > 12 ? 'warn' : 'neutral'}
              hint={deltaHint(totalCommission, cmpTotalCommission, `${commissionPctOfRev.toFixed(1)}% of rev`)}
            />
            <KpiCard
              label="Direct mix"
              value={directMix}
              kind="pct"
              tone={directMix < 35 ? 'warn' : 'pos'}
              hint={deltaHint(directMix, cmpDirectMix, 'Target 35%')}
            />
            <KpiCard
              label="OTA mix"
              value={otaMix}
              kind="pct"
              tone={otaMix > 60 ? 'warn' : 'neutral'}
              hint={deltaHint(otaMix, cmpOtaMix, otaMix > 70 ? 'Heavy OTA' : 'stable')}
            />
            <KpiCard
              label="Wholesale mix"
              value={wholesaleMix}
              kind="pct"
              tone={wholesaleMix > 20 ? 'warn' : 'neutral'}
              hint={wholesaleMix > 20 ? 'Risk: leakage to OTA' : '—'}
            />
            <KpiCard
              label="Avg lead time"
              value={avgLead.toFixed(0) + 'd'}
              kind="text"
              hint={`OTA: ${ota[0]?.avg_lead_days?.toFixed(0) ?? '—'}d · Direct: ${direct[0]?.avg_lead_days?.toFixed(0) ?? '—'}d`}
            />
            <KpiCard
              label="Channel cost / occ rn"
              value={channelCostPerOcc}
              kind="money"
              tone={channelCostPerOcc > 50 ? 'warn' : 'neutral'}
              hint="Avg tax per booking"
            />
          </>
        }
      />

      {/* 3 mini graphs · channel mix weekly · net $/booking · booking velocity 28d */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12, marginBottom: 14 }}>
        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-md)' }}>Channel mix · <em style={{ color: 'var(--brass)' }}>weekly trend</em></h3>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{period.label}</span>
          </div>
          {mixWeekly.length > 0
            ? <div dangerouslySetInnerHTML={{ __html: channelMixTrendSvg(mixWeekly) }} />
            : <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No mix data in window.</div>}
        </div>

        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-md)' }}>Net $/booking · <em style={{ color: 'var(--brass)' }}>cancel-adjusted</em></h3>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{period.label}</span>
          </div>
          {netValue.length > 0
            ? <div dangerouslySetInnerHTML={{ __html: channelNetValueBarsSvg(netValue) }} />
            : <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No net value data in window.</div>}
        </div>

        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-md)' }}>Booking velocity · <em style={{ color: 'var(--brass)' }}>28d</em></h3>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>by category</span>
          </div>
          {velocity.length > 0
            ? <div dangerouslySetInnerHTML={{ __html: channelVelocity3LineSvg(velocity) }} />
            : <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No velocity data in last 28 days.</div>}
        </div>
      </div>

      <Card
        title="Channel performance"
        emphasis={period.label}
        sub={`Source ranked by gross revenue · ${channels.length} active · click source to drill in`}
        source="mv_channel_economics"
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
                    <td className="lbl"><Link href={`/revenue/channels/${encodeURIComponent(c.source_name)}`} style={{ color: 'var(--brass)', textDecoration: 'none' }}><strong>{c.source_name}</strong></Link></td>
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
      </Card>

      {matRooms.length > 0 && matSources.length > 0 && (
        <Card
          title="OTA × Room Type matrix"
          emphasis={period.label}
          sub="Where each source performs · which rooms convert · hover any cell for detail"
          source="mv_channel_x_roomtype"
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl matrix">
              <thead>
                <tr>
                  <th>Room Type</th>
                  {matSources.slice(0, 6).map(s => (
                    <th key={s} className="num">{s}</th>
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
                            {strongest.src} {strongestPct.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {worstCancel.name && (
        <Insight tone={worstCancel.pct > 30 ? 'alert' : 'warn'} eye="Cancel watch">
          <strong>{worstCancel.name}</strong> showing {worstCancel.pct.toFixed(1)}% cancellation in {period.label}.
          Investigate rate plan, deposit policy, and lead-time profile.
        </Insight>
      )}

      {commissionPctOfRev > 12 && (
        <Insight tone="warn" eye="Commission load">
          OTA commissions are <strong>{commissionPctOfRev.toFixed(1)}%</strong> of total revenue
          ({fmtMoney(totalCommission, 'USD')} in {period.label}).
          Push direct mix above 35% to reduce dependency.
        </Insight>
      )}
    </>
  );
}
