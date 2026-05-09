// app/revenue/pricing/page.tsx
// Revenue › Pricing — WIRED to public.rate_inventory + rate_plans + room_types.

import { resolvePeriod, type WindowKey } from '@/lib/period';
import { getRoomTypes, getRatePlans, getRateInventory } from '@/lib/pricing';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import Brief from '@/components/page/Brief';
import ArtifactActions from '@/components/page/ArtifactActions';
import TimeframeSelector from '@/components/page/TimeframeSelector';
import CompareSelector from '@/components/page/CompareSelector';
import KpiBox from '@/components/kpi/KpiBox';
import { REVENUE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface SearchParams { win?: string; gran?: string; cmp?: string }

const VALID_FWD: WindowKey[] = ['next7', 'next30', 'next90', 'next180', 'next365'];

function parseWin(raw: string | undefined): WindowKey {
  return (VALID_FWD.includes(raw as WindowKey) ? raw : 'next90') as WindowKey;
}
function parseGran(raw: string | undefined): 'day' | 'week' | 'month' {
  if (raw === 'day' || raw === 'week' || raw === 'month') return raw;
  return 'month';
}

function fmtMonth(yyyymm: string) {
  const [y, m] = yyyymm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function rateColor(rate: number, min: number, max: number): string {
  if (max <= min) return 'var(--paper-deep)';
  const t = (rate - min) / (max - min);
  const hi = { r: 0xa1, g: 0x7a, b: 0x4f };
  const lo = { r: 0xf6, g: 0xf0, b: 0xe1 };
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);
  return `rgb(${r},${g},${b})`;
}

export default async function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  const win = parseWin(searchParams.win);
  const gran = parseGran(searchParams.gran);
  const period = resolvePeriod({ win, cmp: searchParams.cmp });

  const [roomTypes, ratePlans, inventory] = await Promise.all([
    getRoomTypes(),
    getRatePlans(),
    getRateInventory(period.from, period.to),
  ]);

  type RoomAgg = { rt: string; min: number; max: number; sum: number; count: number; stops: number; minStays: number; cta: number; ctd: number };
  const byRoom = new Map<number, RoomAgg>();
  for (const r of inventory) {
    if (!byRoom.has(r.room_type_id)) {
      const rt = roomTypes.find((x) => x.room_type_id === r.room_type_id);
      byRoom.set(r.room_type_id, {
        rt: rt?.room_type_name ?? `room_${r.room_type_id}`,
        min: Number.POSITIVE_INFINITY, max: 0, sum: 0, count: 0,
        stops: 0, minStays: 0, cta: 0, ctd: 0,
      });
    }
    const a = byRoom.get(r.room_type_id)!;
    const rate = Number(r.rate) || 0;
    if (rate > 0) {
      a.min = Math.min(a.min, rate);
      a.max = Math.max(a.max, rate);
      a.sum += rate;
      a.count += 1;
    }
    if (r.stop_sell) a.stops += 1;
    if ((Number(r.minimum_stay) || 0) > 1) a.minStays += 1;
    if (r.closed_to_arrival) a.cta += 1;
    if (r.closed_to_departure) a.ctd += 1;
  }
  const roomAggs = Array.from(byRoom.entries()).map(([id, a]) => ({
    id,
    ...a,
    avg: a.count > 0 ? a.sum / a.count : 0,
    min: a.min === Number.POSITIVE_INFINITY ? 0 : a.min,
  })).sort((a, b) => b.avg - a.avg);

  function bucketKey(date: string): string {
    if (gran === 'month') return date.slice(0, 7);
    if (gran === 'week') {
      const d = new Date(date);
      const dow = d.getUTCDay();
      const diff = (dow + 6) % 7;
      const monday = new Date(d.getTime() - diff * 86400000);
      return monday.toISOString().slice(0, 10);
    }
    return date;
  }
  type Cell = { sum: number; count: number; min: number; max: number; stops: number };
  const cellRates = new Map<string, Cell>();
  for (const r of inventory) {
    const rate = Number(r.rate) || 0;
    if (rate <= 0) continue;
    const k = `${r.room_type_id}|${bucketKey(r.inventory_date)}`;
    if (!cellRates.has(k)) cellRates.set(k, { sum: 0, count: 0, min: rate, max: rate, stops: 0 });
    const c = cellRates.get(k)!;
    c.sum += rate;
    c.count += 1;
    c.min = Math.min(c.min, rate);
    c.max = Math.max(c.max, rate);
    if (r.stop_sell) c.stops += 1;
  }
  const bucketSet = new Set<string>();
  for (const k of cellRates.keys()) bucketSet.add(k.split('|')[1]);
  const buckets = Array.from(bucketSet).sort();

  const totalInv = inventory.length;
  const stopSells = inventory.filter((r) => r.stop_sell).length;
  const minStayRows = inventory.filter((r) => (Number(r.minimum_stay) || 0) > 1).length;
  // PBS 2026-05-09: filter junk rates < $10 (rate_inventory has 154 rows
  // with rate=$0..$5 from derived plans). Without this floor, "Min BAR"
  // shows $0 / $1 and the KPI looks broken.
  const RATE_MIN = 10;
  const allRates = inventory.map((r) => Number(r.rate) || 0).filter((x) => x >= RATE_MIN);
  const avgRate = allRates.length > 0 ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 0;
  const minRate = allRates.length > 0 ? Math.min(...allRates) : 0;
  const maxRate = allRates.length > 0 ? Math.max(...allRates) : 0;

  type PlanAgg = { name: string; type: string | null; count: number; sum: number; min: number; max: number };
  const byPlan = new Map<string, PlanAgg>();
  for (const r of inventory) {
    const p = ratePlans.find((x) => x.rate_id === r.rate_id);
    const key = r.rate_id;
    if (!byPlan.has(key)) {
      byPlan.set(key, { name: p?.rate_name ?? r.rate_id, type: p?.rate_type ?? null, count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: 0 });
    }
    const a = byPlan.get(key)!;
    const rate = Number(r.rate) || 0;
    if (rate > 0) {
      a.sum += rate; a.count += 1;
      a.min = Math.min(a.min, rate); a.max = Math.max(a.max, rate);
    }
  }
  const planAggs = Array.from(byPlan.values())
    .map((p) => ({ ...p, avg: p.count > 0 ? p.sum / p.count : 0, min: p.min === Number.POSITIVE_INFINITY ? 0 : p.min }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  const winLabels: Record<string, string> = {
    next7: 'Next 7d', next30: 'Next 30d', next90: 'Next 90d', next180: 'Next 180d', next365: 'Next 365d',
  };

  // Brief — narrative read of pricing surface for this window.
  const briefSignal = `${winLabels[win]} · ${totalInv.toLocaleString()} inventory cells · avg $${avgRate.toFixed(0)} · BAR floor $${minRate.toFixed(0)} · ceiling $${maxRate.toFixed(0)}`;
  const briefBody = `${roomTypes.length} room types × ${planAggs.length} rate plans across ${period.days} nights. ${stopSells} stop-sell cells, ${minStayRows} LOS-restricted.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (maxRate / Math.max(1, minRate) > 1.5) good.push(`Spread $${minRate.toFixed(0)} → $${maxRate.toFixed(0)} — yieldable.`);
  if (stopSells > 0)  bad.push(`${stopSells} stop-sell cells — review for missed demand.`);
  if (minStayRows > 0) good.push(`${minStayRows} LOS-restricted nights — protecting peak.`);
  if (totalInv === 0)  bad.push(`No inventory cells in window — check Cloudbeds sync.`);
  if (good.length === 0) good.push('No standout strengths flagged for this window.');
  if (bad.length === 0)  bad.push('No leakage signals flagged for this window.');

  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string, signal?: string) => ({ kind, title, signal, dept: 'revenue' as const });

  return (
    <Page
      eyebrow={`Revenue · Pricing · ${winLabels[win]}`}
      title={<>Pricing · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{winLabels[win]} · by {gran}</em></>}
      subPages={REVENUE_SUBPAGES}
      topRight={
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <TimeframeSelector basePath="/revenue/pricing" active={period.win} includeForward preserve={{ cmp: period.cmp, gran }} />
          <CompareSelector  basePath="/revenue/pricing" active={period.cmp}                  preserve={{ win: period.win, gran }} />
        </div>
      }
    >
      <style>{`
        .filter-btn:not(.fwd):not([href*="seg="]):not([href*="cmp="]):not([href*="cap="]) {
          opacity: 0.35; pointer-events: none;
        }
      `}</style>

      <Brief
        brief={{ signal: briefSignal, body: briefBody, good, bad }}
        actions={<ArtifactActions context={ctx('brief', `Pricing · ${winLabels[win]}`, briefSignal)} />}
      />

      {/* PBS 2026-05-09 #34: prominent CTA to the new calendar view. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <a href="/revenue/pricing/calendar" style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase',
          fontWeight: 700,
          background: '#a8854a', color: '#0a0a0a',
          border: '1px solid #2a2520', padding: '6px 12px',
          borderRadius: 4, textDecoration: 'none',
        }}>
          📅 Open calendar view (vs comp)
        </a>
        <span style={{ fontSize: 11, color: '#7d7565' }}>30-day grid · cheapest sellable rate per day · Δ vs comp avg</span>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: "var(--t-sm)", color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Granularity</span>
        {(['day', 'week', 'month'] as const).map((g) => {
          const active = g === gran;
          const params = new URLSearchParams();
          if (win !== 'next90') params.set('win', win);
          if (g !== 'month') params.set('gran', g);
          const href = `/revenue/pricing${params.toString() ? '?' + params.toString() : ''}`;
          return (
            <a key={g} href={href} style={{
              padding: '4px 12px', borderRadius: 4, border: '1px solid var(--line-soft)',
              background: active ? 'var(--ink-soft)' : 'var(--paper-warm)', color: active ? 'var(--paper-warm)' : 'var(--ink-soft)',
              fontSize: "var(--t-base)", textDecoration: 'none', textTransform: 'capitalize',
            }}>{g}</a>
          );
        })}
      </div>

      {/* PBS 2026-05-09 cut-corners audit: above-the-fold = KPI strip → "what's
          open today" alerts panel → chart. BAR ladder + rate plans tables drop
          to second fold. Calendar route at /revenue/pricing/calendar is the
          actionable ladder; this page is the strategic overview. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={totalInv} unit="count" label="Inventory cells" tooltip="Distinct (room_type × day) cells in the window. Source: rate_inventory." />
        <KpiBox value={avgRate}  unit="usd"   label="Avg rate"        tooltip="Mean rate across all inventory cells in the window." />
        <KpiBox value={minRate}  unit="usd"   label="BAR floor"       tooltip="Lowest sellable rate in the window — the floor of the rate ladder." />
        <KpiBox value={maxRate}  unit="usd"   label="Ceiling"         tooltip="Highest rate in the window — typically peak / high-demand days." />
        <KpiBox value={stopSells} unit="count" label="Stop-sell"      tooltip="Cells with stop_sell = true. Cannot be booked even if rate is set." />
        <KpiBox value={minStayRows} unit="count" label="Min-stay"     tooltip="Cells with minimum_stay > 1. Filters short stays." />
      </div>

      {/* "What's open today" — top 3 same-day rate alerts. Mirrors the Pulse
          hero pattern. Data source not yet wired (no rate-alert view in
          rate_inventory). Placeholder per PBS directive: don't fabricate. */}
      <Panel
        title="What's open today"
        eyebrow="awaiting data"
        actions={<ArtifactActions context={ctx('panel', "What's open today")} />}
      >
        <div style={{ padding: '16px 4px', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)', fontStyle: 'italic' }}>
          Will surface the top 3 same-day rate alerts (cells where today's rate ≠ yesterday's, or comp gap exceeds threshold). Awaiting a `v_rate_alerts_today` view over `rate_inventory` × `compset_rates`.
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title={`Rate calendar · room × ${gran}`} eyebrow="terracotta=high · pale=low" actions={<ArtifactActions context={ctx('table', `Rate calendar · room × ${gran}`)} />}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: "var(--t-sm)", minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--ink-mute)', fontSize: "var(--t-xs)", textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room</th>
              {buckets.map((b) => (
                <th key={b} style={{ padding: '6px 4px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: "var(--t-xs)", fontWeight: 500, minWidth: 50 }}>
                  {gran === 'month' ? fmtMonth(b) : b.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomAggs.map((a) => (
              <tr key={a.id}>
                <td style={{ padding: '4px 10px', fontWeight: 500, fontSize: "var(--t-sm)", whiteSpace: 'nowrap' }}>{a.rt}</td>
                {buckets.map((b) => {
                  const k = `${a.id}|${b}`;
                  const c = cellRates.get(k);
                  if (!c) return <td key={b} style={{ padding: '4px', textAlign: 'center', color: 'var(--ink-faint)' }}>—</td>;
                  const avg = c.sum / c.count;
                  const bg = rateColor(avg, minRate, maxRate);
                  return (
                    <td key={b} style={{
                      padding: '6px 4px', textAlign: 'center', background: bg,
                      color: avg > avgRate * 1.2 ? 'var(--paper-warm)' : 'var(--ink-soft)',
                      fontFamily: 'var(--mono)', fontSize: "var(--t-xs)", border: '1px solid #fff',
                    }} title={`${a.rt} · ${b}\navg USD ${avg.toFixed(0)}\nmin USD ${c.min.toFixed(0)} · max USD ${c.max.toFixed(0)}${c.stops > 0 ? `\n${c.stops} stop-sell` : ''}`}>
                      {avg.toFixed(0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="BAR ladder by room type" eyebrow="rate_inventory · second fold" actions={<ArtifactActions context={ctx('table', 'BAR ladder by room type')} />}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--t-base)" }}>
          <thead>
            <tr style={{ background: 'var(--paper-warm)', textAlign: 'left', color: 'var(--ink-mute)', fontSize: "var(--t-xs)", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>Room type</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Cells</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Avg</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>BAR floor</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Max</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Spread</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Stop</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Min-stay</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>CTA/CTD</th>
            </tr>
          </thead>
          <tbody>
            {roomAggs.map((a) => (
              <tr key={a.id} style={{ borderTop: '1px solid var(--paper-warm)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{a.rt}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{a.count}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>${a.avg.toFixed(0)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--moss-glow)' }}>${a.min.toFixed(0)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--brass)' }}>${a.max.toFixed(0)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>${(a.max - a.min).toFixed(0)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: a.stops > 0 ? 'var(--st-bad)' : 'var(--ink-mute)' }}>{a.stops || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: a.minStays > 0 ? 'var(--brass)' : 'var(--ink-mute)' }}>{a.minStays || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{a.cta || 0}/{a.ctd || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title={`Rate plans active in window (${planAggs.length})`} eyebrow="rate_plans" actions={<ArtifactActions context={ctx('table', 'Rate plans active in window')} />}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--t-base)" }}>
          <thead>
            <tr style={{ background: 'var(--paper-warm)', textAlign: 'left', color: 'var(--ink-mute)', fontSize: "var(--t-xs)", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>Rate plan</th>
              <th style={{ padding: '10px 12px' }}>Type</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Cells</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Avg</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Min</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Max</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>vs avg</th>
            </tr>
          </thead>
          <tbody>
            {planAggs.slice(0, 30).map((p) => {
              const deltaPct = avgRate > 0 ? ((p.avg - avgRate) / avgRate) * 100 : 0;
              const dColor = deltaPct < -10 ? 'var(--st-bad)' : deltaPct < 0 ? 'var(--brass)' : deltaPct > 10 ? 'var(--moss-glow)' : 'var(--ink-soft)';
              return (
                <tr key={p.name} style={{ borderTop: '1px solid var(--paper-warm)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink-mute)', fontSize: "var(--t-sm)" }}>{p.type ?? '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{p.count}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>${p.avg.toFixed(0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>${p.min.toFixed(0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>${p.max.toFixed(0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: dColor }}>{deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {planAggs.length > 30 && <div style={{ padding: '8px 16px', fontSize: "var(--t-sm)", color: 'var(--ink-mute)' }}>+ {planAggs.length - 30} more</div>}
      </Panel>
    </Page>
  );
}
