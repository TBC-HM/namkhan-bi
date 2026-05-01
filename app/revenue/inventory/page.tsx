// app/revenue/inventory/page.tsx — REPLACEMENT (audit fix 2026-05-01)
// Page now consumes ?win=. Was hardcoded today + 60d.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { getRateInventoryCalendar } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function InventoryPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const cal = await getRateInventoryCalendar(period).catch(() => []);

  const byDate: Record<string, { date: string; total_avail: number; min_rate: number; max_rate: number }> = {};
  cal.forEach((r: any) => {
    const d = String(r.inventory_date);
    if (!byDate[d]) byDate[d] = { date: d, total_avail: 0, min_rate: Infinity, max_rate: -Infinity };
    if (r.available_rooms != null) byDate[d].total_avail += Number(r.available_rooms);
    if (r.bar_rate != null && Number(r.bar_rate) > 0) {
      byDate[d].min_rate = Math.min(byDate[d].min_rate, Number(r.bar_rate));
      byDate[d].max_rate = Math.max(byDate[d].max_rate, Number(r.bar_rate));
    }
  });

  const days = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  const tightDays = days.filter((d) => d.total_avail <= 3).length;
  const avgAvail = days.length ? days.reduce((s, d) => s + d.total_avail, 0) / days.length : 0;
  const sellouts = days.filter((d) => d.total_avail === 0).length;

  return (
    <>
      <PanelHero
        eyebrow={`Inventory · ${period.label}`}
        title="Availability"
        emphasis="& rate spread"
        sub={`${period.rangeLabel} · per date · room-type aggregated`}
        kpis={
          <>
            <KpiCard label="Days in window" value={days.length} />
            <KpiCard label="Avg available" value={avgAvail.toFixed(1)} kind="text" />
            <KpiCard
              label="Tight days (≤3)"
              value={tightDays}
              tone={tightDays > 5 ? 'warn' : 'neutral'}
              hint="Push rate"
            />
            <KpiCard label="Sellouts" value={sellouts} tone={sellouts > 0 ? 'pos' : 'neutral'} />
          </>
        }
      />

      <Card title="Inventory" emphasis="per date" sub={`${period.rangeLabel} · sellable inventory + rate spread`} source="mv_rate_inventory_calendar">
        {days.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No inventory data in selected window.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Available</th>
                <th className="num">Min Rate</th>
                <th className="num">Max Rate</th>
                <th className="num">Spread</th>
              </tr>
            </thead>
            <tbody>
              {days.slice(0, 90).map((d) => {
                const tone = d.total_avail === 0 ? 'text-bad' : d.total_avail <= 3 ? 'text-warn' : '';
                return (
                  <tr key={d.date}>
                    <td className="lbl"><strong>{d.date}</strong></td>
                    <td className={`num ${tone}`}>{d.total_avail}</td>
                    <td className="num">{d.min_rate !== Infinity ? fmtMoney(d.min_rate, 'USD') : '—'}</td>
                    <td className="num">{d.max_rate !== -Infinity ? fmtMoney(d.max_rate, 'USD') : '—'}</td>
                    <td className="num text-mute">
                      {d.min_rate !== Infinity && d.max_rate !== -Infinity
                        ? fmtMoney(d.max_rate - d.min_rate, 'USD')
                        : '—'}
                    </td>
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
