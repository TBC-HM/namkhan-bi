// app/revenue/pricing/page.tsx
// Revenue › Pricing — WIRED to public.rate_inventory + rate_plans + room_types.

import { resolvePeriod, type WindowKey } from '@/lib/period';
import { getRoomTypes, getRatePlans, getRateInventory } from '@/lib/pricing';
import { getPricingKpis } from '@/lib/pricingKpis';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import ArtifactActions from '@/components/page/ArtifactActions';
import PeriodSelectorRow from '@/components/page/PeriodSelectorRow';
import KpiBox from '@/components/kpi/KpiBox';
import { REVENUE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface SearchParams { win?: string; gran?: string; cmp?: string }

const VALID_FWD: WindowKey[] = ['next7', 'next30', 'next90', 'next180', 'next365'];

// PBS-locked capacity. v_kpi_daily.rooms_available reports 24 (active rooms);
// 30 is the contractual capacity (24/30) — used as the denominator for
// "occupancy fence" so the fence reflects total physical capacity.
const CAPACITY_FIXED_LABEL = 30;

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

  const [roomTypes, ratePlans, inventory, todayKpis] = await Promise.all([
    getRoomTypes(),
    getRatePlans(),
    getRateInventory(period.from, period.to),
    getPricingKpis(),
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

  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string, signal?: string) => ({ kind, title, signal, dept: 'revenue' as const });

  return (
    <Page
      eyebrow={`Revenue · Pricing · ${winLabels[win]}`}
      title={<>Pricing · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{winLabels[win]} · by {gran}</em></>}
      subPages={REVENUE_SUBPAGES}
    >
      <style>{`
        .filter-btn:not(.fwd):not([href*="seg="]):not([href*="cmp="]):not([href*="cap="]) {
          opacity: 0.35; pointer-events: none;
        }
      `}</style>

      {/* PBS 2026-05-09: above-the-fold KPI strip wired to today's pricing
          surface — Current BAR · Comp gap · Occupancy fence · Sellable count.
          RATE_MIN=10 floor on rate_inventory, capacity-30 lock for occ fence.
          Window aggregates (inventory cells / avg / floor / ceiling / stop /
          min-stay) drop to the secondary strip below the actionable four. */}
      {(() => {
        const k = todayKpis;
        const barDelta = (k.barToday != null && k.barYest != null) ? k.barToday - k.barYest : null;
        const compGap = (k.barToday != null && k.compMedian != null) ? k.barToday - k.compMedian : null;
        const compGapYest = (k.barYest != null && k.compMedianYest != null) ? k.barYest - k.compMedianYest : null;
        const compGapDelta = (compGap != null && compGapYest != null) ? compGap - compGapYest : null;
        const occDelta = (k.occPctToday != null && k.occPctYest != null) ? k.occPctToday - k.occPctYest : null;
        const sellDelta = (k.sellable14d != null && k.sellable14dPrev != null) ? k.sellable14d - k.sellable14dPrev : null;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
            <KpiBox
              value={k.barToday}
              unit="usd"
              label="Current BAR"
              state={k.barToday == null ? 'data-needed' : 'live'}
              needs={k.barToday == null ? 'rate_inventory · today · rate≥$10' : undefined}
              delta={barDelta != null ? { value: barDelta, unit: 'usd', period: 'DoD' } : undefined}
              tooltip="Today's lowest sellable rate (BAR) from rate_inventory · property 260955 · stop_sell=false · rate ≥ $10."
            />
            <KpiBox
              value={compGap}
              unit="usd"
              label="Comp gap"
              state={compGap == null ? 'data-needed' : 'live'}
              needs={compGap == null ? 'v_compset_competitor_rate_matrix · today' : undefined}
              delta={compGapDelta != null ? { value: compGapDelta, unit: 'usd', period: 'DoD' } : undefined}
              tooltip={`Today's BAR minus median compset rate. ${k.compRows} comp rates today · positive = priced above comp · negative = priced below comp.`}
            />
            <KpiBox
              value={k.occPctToday}
              unit="pct"
              label="Occupancy fence"
              state={k.occPctToday == null ? 'data-needed' : 'live'}
              needs={k.occPctToday == null ? 'v_kpi_daily · today' : undefined}
              valueText={k.occPctToday != null && k.roomsSold != null
                ? `${k.occPctToday.toFixed(0)}%`
                : undefined}
              delta={occDelta != null ? { value: occDelta, unit: 'pp', period: 'DoD' } : undefined}
              tooltip={`Today's rooms sold ÷ ${CAPACITY_FIXED_LABEL} capacity. ${k.roomsSold ?? 0} / ${CAPACITY_FIXED_LABEL} sold.`}
            />
            <KpiBox
              value={k.sellable14d}
              unit="count"
              label="Sellable · 14d"
              state={k.sellable14d == null ? 'data-needed' : 'live'}
              needs={k.sellable14d == null ? 'rate_inventory · next 14d · rate≥$10' : undefined}
              delta={sellDelta != null ? { value: sellDelta, unit: 'count', period: 'vs prev 14d' } : undefined}
              tooltip="Count of room-night cells with rate ≥ $10 and stop_sell=false over next 14 days. Source: rate_inventory."
            />
          </div>
        );
      })()}

      {/* Secondary strip — window aggregates (was the only KPI strip pre-2026-05-09). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={totalInv} unit="count" label="Inventory cells" tooltip="Distinct (room_type × day) cells in the window. Source: rate_inventory." />
        <KpiBox value={avgRate}  unit="usd"   label="Avg rate"        tooltip="Mean rate across all inventory cells in the window." />
        <KpiBox value={minRate}  unit="usd"   label="BAR floor"       tooltip="Lowest sellable rate in the window — the floor of the rate ladder." />
        <KpiBox value={maxRate}  unit="usd"   label="Ceiling"         tooltip="Highest rate in the window — typically peak / high-demand days." />
        <KpiBox value={stopSells} unit="count" label="Stop-sell"      tooltip="Cells with stop_sell = true. Cannot be booked even if rate is set." />
        <KpiBox value={minStayRows} unit="count" label="Min-stay"     tooltip="Cells with minimum_stay > 1. Filters short stays." />
      </div>

      {/* Canonical period chooser + dropdowns + sub-nav — under the KPI tile row. */}
      <PeriodSelectorRow
        basePath="/revenue/pricing"
        win={period.win}
        cmp={period.cmp}
        includeForward
        preserve={{ gran }}
        rightSlot={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="t-eyebrow" style={{ color: 'var(--ink-mute)' }}>GRANULARITY</span>
            {(['day', 'week', 'month'] as const).map((g) => {
              const active = g === gran;
              const params = new URLSearchParams();
              if (win !== 'next90') params.set('win', win);
              if (g !== 'month') params.set('gran', g);
              const href = `/revenue/pricing${params.toString() ? '?' + params.toString() : ''}`;
              return (
                <a key={g} href={href} style={{
                  padding: '4px 12px', borderRadius: 4, border: '1px solid var(--paper-deep)',
                  background: active ? 'var(--moss)' : 'var(--paper-warm)',
                  color: active ? 'var(--paper-warm)' : 'var(--ink-soft)',
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                  fontWeight: 600, textDecoration: 'none',
                }}>{g}</a>
              );
            })}
            <span style={{ width: 8 }} />
            {[
              { href: '/revenue/pricing',          label: 'Overview',     active: true  },
              { href: '/revenue/pricing/calendar', label: 'Calendar',     active: false },
              { href: '/revenue/parity',           label: 'Parity ↗',     active: false },
              { href: '/revenue/compset',          label: 'Compset ↗',    active: false },
            ].map((t) => (
              <a key={t.label} href={t.href} style={{
                padding: '4px 12px',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase', fontWeight: 600,
                color: t.active ? 'var(--paper-warm)' : 'var(--ink-soft)',
                background: t.active ? 'var(--brass)' : 'var(--paper-warm)',
                border: '1px solid ' + (t.active ? 'var(--brass)' : 'var(--paper-deep)'),
                borderRadius: 4, textDecoration: 'none',
              }}>{t.label}</a>
            ))}
          </div>
        }
      />

      <div style={{ height: 14 }} />

      {/* PBS 2026-05-09 #36/#46: 14-day glance of cheapest sellable rate per
          day, mirroring the screenshot the operator gave (Mon-Sun calendar
          with rate badge + comp tone per cell). Full 30/60-day grid lives at
          /revenue/pricing/calendar; this is the "see it without clicking
          through" inline preview. Reuses the same toneFor logic via simple
          inline rules so we don't dual-source. */}
      {(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const RATE_MIN = 10;
        // Group inventory by date, picking the cheapest sellable rate ≥ RATE_MIN.
        const byDate = new Map<string, { rate: number | null; flag: 'sellable' | 'stop_sold' | 'sold_out' | null }>();
        for (let d = 0; d < 14; d++) {
          const dt = new Date(today); dt.setDate(today.getDate() + d);
          byDate.set(dt.toISOString().slice(0,10), { rate: null, flag: null });
        }
        for (const r of inventory) {
          const ru = r as unknown as Record<string, unknown>;
          const k = String(ru.date ?? '').slice(0,10);
          if (!byDate.has(k)) continue;
          const rate = Number(ru.rate);
          const stopSell = Boolean(ru.stop_sell);
          if (rate >= RATE_MIN && !stopSell) {
            const cur = byDate.get(k)!;
            if (cur.rate == null || rate < cur.rate) byDate.set(k, { rate, flag: 'sellable' });
          } else if (stopSell) {
            const cur = byDate.get(k)!;
            if (cur.rate == null) byDate.set(k, { rate: null, flag: 'stop_sold' });
          }
        }
        const cells = Array.from(byDate.entries()).map(([d, v]) => ({ date: d, ...v }));
        const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        function toneFor(rate: number | null, flag: string | null) {
          if (flag === 'stop_sold' || flag === 'sold_out') return { bg: '#7a2a22', fg: '#ffb0a8', label: 'STOP' };
          if (rate == null) return { bg: '#3a3327', fg: '#d8cca8', label: 'no data' };
          if (rate >= 200) return { bg: '#2c5b3d', fg: '#c9f5d5', label: 'premium' };
          if (rate >= 130) return { bg: '#5b4a2a', fg: '#fce8b5', label: 'mid' };
          return { bg: '#7a4f1f', fg: '#ffd49a', label: 'soft' };
        }
        return (
          <Panel
            title="Two-week glance"
            eyebrow="cheapest sellable rate per day · next 14d"
            actions={<>
              <a href="/revenue/pricing/calendar" style={{
                fontSize: 'var(--t-xs)', color: 'var(--brass)', textDecoration: 'none',
                fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.10em',
                padding: '4px 10px', border: '1px solid var(--brass)', borderRadius: 4,
              }}>↗ full calendar</a>
              <ArtifactActions context={ctx('panel', 'Two-week glance')} />
            </>}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {dayLabels.map((d) => (
                <div key={d} style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: '#a8854a', textAlign: 'center', paddingBottom: 4,
                }}>{d}</div>
              ))}
              {(() => {
                // Pad first row so the first cell aligns with the right weekday.
                const first = new Date(cells[0].date);
                const lead = (first.getDay() + 6) % 7; // Mon=0
                const padded: Array<typeof cells[number] | null> = Array(lead).fill(null).concat(cells);
                while (padded.length % 7 !== 0) padded.push(null);
                return padded.map((c, i) => {
                  if (!c) return <div key={`pad-${i}`} />;
                  const tone = toneFor(c.rate, c.flag);
                  const day = new Date(c.date).getDate();
                  return (
                    <div key={c.date} style={{
                      background: tone.bg,
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 6,
                      padding: '8px 6px',
                      minHeight: 84,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }} title={`${c.date} · ${tone.label}${c.rate != null ? ` · $${c.rate.toFixed(0)}` : ''}`}>
                      <div style={{
                        background: '#fff5d8', color: '#1c160d',
                        width: 22, height: 22, borderRadius: 4, fontWeight: 700,
                        fontSize: 11, fontFamily: 'var(--mono)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{day}</div>
                      <div style={{
                        fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
                        fontSize: 18, color: '#fff5d8', fontWeight: 600, textAlign: 'right',
                      }}>{c.flag === 'stop_sold' ? 'STOP' : (c.rate != null ? `$${c.rate.toFixed(0)}` : '—')}</div>
                      <div style={{
                        fontFamily: 'var(--mono)', fontSize: 9,
                        letterSpacing: '0.10em', textTransform: 'uppercase',
                        color: tone.fg, opacity: 0.85, textAlign: 'right',
                      }}>{tone.label}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </Panel>
        );
      })()}

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
