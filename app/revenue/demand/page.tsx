// app/revenue/demand/page.tsx
// 2026-05-20: primitives-based demand. Shared body for /revenue/demand
// (Namkhan default) and /h/[id]/revenue/demand (delegates with propertyId).
// Legacy preserved at /revenue/demand/legacy.

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getPaceOtb } from '@/lib/data';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface DemandRow {
  ci_month: string;
  otb_roomnights: number;
  stly_roomnights: number;
  roomnights_delta: number;
  otb_revenue: number;
  stly_revenue: number;
  revenue_delta: number;
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Math.round(Number(n)).toLocaleString('en-US');
}
function fmtUSD(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return '$' + Math.round(Number(n)).toLocaleString('en-US');
}
function fmtSigned(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

interface Props {
  searchParams?: Record<string, string | string[] | undefined>;
  propertyId?: number;
}

export default async function DemandPage({ searchParams, propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/demand'),
  }));

  const period = resolvePeriod(searchParams ?? {});
  const pace = await getPaceOtb(period).catch(() => [] as Record<string, unknown>[]);
  const rows: DemandRow[] = (pace as Array<Record<string, unknown>>).map((r) => ({
    ci_month:         String(r.ci_month),
    otb_roomnights:   Number(r.otb_roomnights || 0),
    stly_roomnights:  Number(r.stly_roomnights || 0),
    roomnights_delta: Number(r.roomnights_delta || 0),
    otb_revenue:      Number(r.otb_revenue || 0),
    stly_revenue:     Number(r.stly_revenue || 0),
    revenue_delta:    Number(r.revenue_delta || 0),
  }));

  const total = rows.reduce(
    (a, r) => ({
      otb: a.otb + r.otb_roomnights, rev: a.rev + r.otb_revenue,
      stly: a.stly + r.stly_roomnights, stlyRev: a.stlyRev + r.stly_revenue,
    }),
    { otb: 0, rev: 0, stly: 0, stlyRev: 0 },
  );
  const paceDeltaRn = total.otb - total.stly;
  const paceDeltaRnPct = total.stly ? (paceDeltaRn / total.stly) * 100 : 0;
  const revDelta = total.rev - total.stlyRev;
  const revDeltaPct = total.stlyRev ? (revDelta / total.stlyRev) * 100 : 0;
  const monthsAhead  = rows.filter((r) => r.roomnights_delta > 0).length;
  const monthsBehind = rows.filter((r) => r.roomnights_delta < 0).length;
  const worst = rows.length > 0 ? [...rows].sort((a, b) => a.roomnights_delta - b.roomnights_delta)[0] : null;
  const best  = rows.length > 0 ? [...rows].sort((a, b) => b.roomnights_delta - a.roomnights_delta)[0] : null;

  const tiles: KpiTileProps[] = [
    { label: 'OTB Roomnights', value: fmtInt(total.otb), size: 'sm',
      delta: total.stly > 0 ? { value: paceDeltaRnPct, period: 'STLY',
        direction: paceDeltaRn >= 0 ? 'up' : 'down' } : undefined,
      footnote: `forward · ${period.label}`,
      status: paceDeltaRn >= 0 ? 'green' : 'red' },
    { label: 'OTB Revenue', value: Math.round(total.rev), currency: 'USD', size: 'sm',
      delta: total.stlyRev > 0 ? { value: revDeltaPct, period: 'STLY',
        direction: revDelta >= 0 ? 'up' : 'down' } : undefined,
      footnote: `forward · ${period.label}`,
      status: revDelta >= 0 ? 'green' : 'red' },
    { label: 'Pace Δ · RN', value: fmtSigned(paceDeltaRn), size: 'sm',
      footnote: 'room-nights vs STLY · absolute',
      status: paceDeltaRn >= 0 ? 'green' : 'red' },
    { label: 'Pace Δ · Rev', value: fmtSigned(revDelta) + ' $', size: 'sm',
      footnote: 'revenue vs STLY · absolute',
      status: revDelta >= 0 ? 'green' : 'red' },
  ];
  const signals: KpiTileProps[] = [
    { label: 'Months ahead of pace', value: monthsAhead, size: 'sm', footnote: 'Δ RN > 0', status: monthsAhead > 0 ? 'green' : 'grey' },
    { label: 'Months behind', value: monthsBehind, size: 'sm', footnote: 'Δ RN < 0', status: monthsBehind === 0 ? 'green' : 'amber' },
    { label: 'Strongest month', value: best ? best.ci_month : '—', size: 'sm',
      footnote: best ? `${fmtSigned(best.roomnights_delta)} RN vs STLY` : 'no data',
      status: best ? 'green' : 'grey' },
    { label: 'Softest month', value: worst ? worst.ci_month : '—', size: 'sm',
      footnote: worst ? `${fmtSigned(worst.roomnights_delta)} RN vs STLY` : 'no data',
      status: worst ? (worst.roomnights_delta < 0 ? 'amber' : 'green') : 'grey' },
  ];

  const trendData = rows.map((r) => ({ ci_month: r.ci_month, otb_rn: r.otb_roomnights, stly_rn: r.stly_roomnights }));
  const revData = rows.map((r) => ({ ci_month: r.ci_month, otb_rev: Math.round(r.otb_revenue), stly_rev: Math.round(r.stly_revenue) }));
  const deltaData = rows.map((r) => ({ ci_month: r.ci_month, rn_delta: r.roomnights_delta }));
  const trendSeries: ChartSeries[] = [
    { key: 'otb_rn',  label: 'OTB room-nights', color: '#1F3A2E' },
    { key: 'stly_rn', label: 'STLY room-nights', color: '#5A5A5A' },
  ];
  const revSeries: ChartSeries[] = [
    { key: 'otb_rev',  label: 'OTB revenue', color: '#1F3A2E' },
    { key: 'stly_rev', label: 'STLY revenue', color: '#B8542A' },
  ];

  const tableRows = rows.map((r) => ({
    ci_month:  r.ci_month,
    otb_rn:    fmtInt(r.otb_roomnights),
    stly_rn:   fmtInt(r.stly_roomnights),
    rn_delta:  fmtSigned(r.roomnights_delta),
    otb_rev:   fmtUSD(r.otb_revenue),
    stly_rev:  fmtUSD(r.stly_revenue),
    rev_delta: fmtSigned(r.revenue_delta) + ' $',
  }));
  const tableCols: ChartSeries[] = [
    { key: 'otb_rn',    label: 'OTB RN' },
    { key: 'stly_rn',   label: 'STLY RN' },
    { key: 'rn_delta',  label: 'Δ RN' },
    { key: 'otb_rev',   label: 'OTB Rev' },
    { key: 'stly_rev',  label: 'STLY Rev' },
    { key: 'rev_delta', label: 'Δ Rev' },
  ];

  const basePath = pid !== PROPERTY_ID ? `/h/${pid}/revenue/demand` : '/revenue/demand';
  const winOptions: Array<{ k: WindowKey; label: string }> = [
    { k: 'next7', label: '+7d' }, { k: 'next30', label: '+30d' },
    { k: 'next90', label: '+90d' }, { k: 'next180', label: '+180d' }, { k: 'next365', label: '+365d' },
  ];
  const hrefFor = (newWin: WindowKey) => {
    const p = new URLSearchParams();
    if (newWin !== 'next90') p.set('win', newWin);
    if (period.cmp && period.cmp !== 'none') p.set('cmp', period.cmp);
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };

  return (
    <DashboardPage
      title="Revenue · Demand"
      subtitle={`Find the gap before the calendar gets soft · ${period.label} · ${rows.length} month${rows.length === 1 ? '' : 's'} on the books`}
      tabs={tabs}
      action={
        <a href="/revenue/demand/legacy" style={{
          fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
          padding: '6px 14px', borderRadius: 4,
          background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
          border: '1px solid var(--hairline, #E6DFCC)', textDecoration: 'none',
        }}>↗ Legacy archive</a>
      }
    >
      <Container title="OTB headline" subtitle={`forward window · ${period.label}`} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Pace signals" subtitle="month-level distribution" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {signals.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Window" subtitle="forward demand horizon" density="compact">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {winOptions.map((o) => {
            const active = o.k === period.win;
            return (
              <a key={o.k} href={hrefFor(o.k)} style={{
                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: 99,
                border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
                background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
                color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
                fontWeight: active ? 600 : 500, textDecoration: 'none',
              }}>{o.label}</a>
            );
          })}
        </div>
      </Container>

      <Container title="Room-nights · OTB vs STLY" subtitle="by check-in month">
        <Chart variant="line" data={trendData} xKey="ci_month" series={trendSeries} height={240}
          empty={{ title: 'No demand rows', hint: 'mv_pace_otb returned 0 rows' }} />
      </Container>

      <Container title="Revenue · OTB vs STLY" subtitle="by check-in month · USD">
        <Chart variant="line" data={revData} xKey="ci_month" series={revSeries} height={240}
          empty={{ title: 'No revenue rows' }} />
      </Container>

      <Container title="Delta heat · room-nights" subtitle="positive = ahead of STLY">
        <Chart variant="bar" data={deltaData} xKey="ci_month"
          series={[{ key: 'rn_delta', label: 'Δ RN vs STLY', color: '#1F3A2E' }]}
          height={220} empty={{ title: 'No delta rows' }} />
      </Container>

      <Container title={`Pace by check-in month · ${rows.length} month${rows.length === 1 ? '' : 's'}`} subtitle="OTB vs STLY · mv_pace_otb">
        <Chart variant="table" data={tableRows} xKey="ci_month" series={tableCols}
          empty={{ title: 'No pace rows' }} />
      </Container>
    </DashboardPage>
  );
}
