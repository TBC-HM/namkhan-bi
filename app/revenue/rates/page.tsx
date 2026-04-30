// app/revenue/rates/page.tsx
// Revenue · Rates — BAR per room type + restrictions calendar.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { getRateInventoryCalendar } from '@/lib/data';
import { fmtMoney, fmtDateShort } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function RatesPage() {
  const today = new Date();
  const to = new Date(today.getTime() + 30 * 86400000);
  const cal = await getRateInventoryCalendar(
    today.toISOString().slice(0, 10),
    to.toISOString().slice(0, 10)
  ).catch(() => []);

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
        eyebrow="Rates · next 30d"
        title="Best Available"
        emphasis="Rates"
        sub="Per room type · spread · restrictions"
        kpis={
          <>
            <KpiCard label="Min BAR" value={overallMin} kind="money" />
            <KpiCard label="Avg BAR" value={overallAvg} kind="money" />
            <KpiCard label="Max BAR" value={overallMax} kind="money" />
            <KpiCard
              label="Active Restrictions"
              value={restrictionCount}
              tone={restrictionCount > 30 ? 'warn' : 'neutral'}
              hint="CTA · CTD · stop-sell · min-stay"
            />
          </>
        }
      />

      <Card title="BAR" emphasis="per room type" sub="Min · avg · max over next 30 days" source="mv_rate_inventory_calendar">
        <table className="tbl">
          <thead>
            <tr>
              <th>Room Type</th>
              <th className="num">Min</th>
              <th className="num">Avg</th>
              <th className="num">Max</th>
              <th className="num">Days w/ data</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(byType).map((t) => {
              const avg = t.rates.length ? t.rates.reduce((a, b) => a + b, 0) / t.rates.length : 0;
              return (
                <tr key={t.name}>
                  <td className="lbl"><strong>{t.name}</strong></td>
                  <td className="num">{t.min !== Infinity ? fmtMoney(t.min, 'USD') : '—'}</td>
                  <td className="num">{avg ? fmtMoney(avg, 'USD') : '—'}</td>
                  <td className="num">{t.max !== -Infinity ? fmtMoney(t.max, 'USD') : '—'}</td>
                  <td className="num text-mute">{t.rates.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card
        title="Active restrictions"
        emphasis="next 30d"
        sub="CTA / CTD / stop-sell / min-stay"
        source="mv_rate_inventory_calendar"
        className="mt-22"
      >
        <RestrictionsList cal={cal} />
      </Card>
    </>
  );
}

function RestrictionsList({ cal }: { cal: any[] }) {
  const flagged = cal.filter((r: any) =>
    r.closed_to_arrival || r.closed_to_departure || r.stop_sell || (r.minimum_stay && r.minimum_stay > 1)
  );
  if (!flagged.length) {
    return (
      <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        No restrictions in the next 30 days.
      </div>
    );
  }
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Date</th>
          <th>Room Type</th>
          <th>Rate Plan</th>
          <th>CTA</th>
          <th>CTD</th>
          <th>Stop-Sell</th>
          <th className="num">Min-Stay</th>
        </tr>
      </thead>
      <tbody>
        {flagged.slice(0, 80).map((r: any, i: number) => (
          <tr key={i}>
            <td className="lbl"><strong>{fmtDateShort(r.inventory_date)}</strong></td>
            <td className="lbl">{r.room_type_name}</td>
            <td className="lbl text-mute">{r.rate_name}</td>
            <td className="lbl">{r.closed_to_arrival ? <span className="pill warn">CTA</span> : '—'}</td>
            <td className="lbl">{r.closed_to_departure ? <span className="pill warn">CTD</span> : '—'}</td>
            <td className="lbl">{r.stop_sell ? <span className="pill bad">STOP</span> : '—'}</td>
            <td className="num">{r.minimum_stay > 1 ? r.minimum_stay : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
