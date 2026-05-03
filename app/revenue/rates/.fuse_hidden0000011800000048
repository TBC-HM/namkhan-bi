// app/revenue/rates/page.tsx — REPLACEMENT (audit fix 2026-05-01)
// Page now consumes ?win=. Was hardcoded today + 30d.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { getRateInventoryCalendar } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function RatesPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const cal = await getRateInventoryCalendar(period).catch(() => []);

  const byType: Record<string, { name: string; rates: number[]; min: number; max: number }> = {};
  cal.forEach((r: any) => {
    const k = String(r.room_type_id);
    if (!byType[k]) byType[k] = { name: r.room_type_name || 'Unknown', rates: [], min: Infinity, max: -Infinity };
    if (r.bar_rate) {
      byType[k].rates.push(Number(r.bar_rate));
      byType[k].min = Math.min(byType[k].min, Number(r.bar_rate));
      byType[k].max = Math.max(byType[k].max, Number(r.bar_rate));
    }
  });

  const allRates = cal.filter((r: any) => r.bar_rate).map((r: any) => Number(r.bar_rate));
  const overallMin = allRates.length ? Math.min(...allRates) : 0;
  const overallMax = allRates.length ? Math.max(...allRates) : 0;
  const overallAvg = allRates.length ? allRates.reduce((a: number, b: number) => a + b, 0) / allRates.length : 0;
  const restrictionCount = cal.filter((r: any) =>
    r.closed_to_arrival || r.closed_to_departure || r.stop_sell || (r.minimum_stay && r.minimum_stay > 1)
  ).length;

  return (
    <>
      <PanelHero
        eyebrow={`Rates · ${period.label}`}
        title="Best Available"
        emphasis="Rates"
        sub={`${period.rangeLabel} · per room type · spread · restrictions`}
        kpis={
          <>
            <KpiCard label="Min BAR" value={overallMin} kind="money" />
            <KpiCard label="Avg BAR" value={overallAvg} kind="money" />
            <KpiCard label="Max BAR" value={overallMax} kind="money" />
            <KpiCard
              label="Active restrictions"
              value={restrictionCount}
              tone={restrictionCount > 30 ? 'warn' : 'neutral'}
              hint="CTA · CTD · stop-sell · min-stay"
            />
          </>
        }
      />

      <Card title="BAR" emphasis="per room type" sub={`Min · avg · max · ${period.label}`} source="mv_rate_inventory_calendar">
        {Object.keys(byType).length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No rate data in selected window.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Room Type</th>
                <th className="num">Min</th>
                <th className="num">Avg</th>
                <th className="num">Max</th>
                <th className="num">Spread</th>
                <th className="num">Days w/ data</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(byType).map((t) => {
                const avg = t.rates.length ? t.rates.reduce((a, b) => a + b, 0) / t.rates.length : 0;
                const spread = (t.max !== -Infinity && t.min !== Infinity) ? t.max - t.min : 0;
                return (
                  <tr key={t.name}>
                    <td className="lbl"><strong>{t.name}</strong></td>
                    <td className="num">{t.min !== Infinity ? fmtMoney(t.min, 'USD') : '—'}</td>
                    <td className="num">{avg ? fmtMoney(avg, 'USD') : '—'}</td>
                    <td className="num">{t.max !== -Infinity ? fmtMoney(t.max, 'USD') : '—'}</td>
                    <td className="num text-mute">{spread ? fmtMoney(spread, 'USD') : '—'}</td>
                    <td className="num text-mute">{t.rates.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
