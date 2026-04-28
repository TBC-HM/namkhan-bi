import { Section } from '@/components/sections/Section';
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

  // Per room type, average daily BAR
  const byType: Record<string, { name: string; rates: number[]; avail: number[]; min: number; max: number }> = {};
  cal.forEach((r: any) => {
    const k = String(r.room_type_id);
    if (!byType[k]) byType[k] = {
      name: r.room_type_name || 'Unknown',
      rates: [], avail: [],
      min: Infinity, max: -Infinity
    };
    if (r.bar_rate) {
      byType[k].rates.push(Number(r.bar_rate));
      byType[k].min = Math.min(byType[k].min, Number(r.bar_rate));
      byType[k].max = Math.max(byType[k].max, Number(r.bar_rate));
    }
    if (r.available_rooms != null) byType[k].avail.push(Number(r.available_rooms));
  });

  return (
    <>
      <Section title="Rates · Next 30 Days" tag="Avg BAR per room type">
        <table>
          <thead>
            <tr><th>Room Type</th><th className="text-right">Min</th><th className="text-right">Avg</th><th className="text-right">Max</th><th className="text-right">Days w/ data</th></tr>
          </thead>
          <tbody>
            {Object.values(byType).map(t => {
              const avg = t.rates.length ? t.rates.reduce((a, b) => a + b, 0) / t.rates.length : 0;
              return (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td className="text-right tabular">{t.min !== Infinity ? fmtMoney(t.min, 'USD') : '—'}</td>
                  <td className="text-right tabular">{avg ? fmtMoney(avg, 'USD') : '—'}</td>
                  <td className="text-right tabular">{t.max !== -Infinity ? fmtMoney(t.max, 'USD') : '—'}</td>
                  <td className="text-right tabular text-muted">{t.rates.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Active Restrictions" tag="CTA / CTD / Stop-Sell · next 30d">
        <RestrictionsList cal={cal} />
      </Section>
    </>
  );
}

function RestrictionsList({ cal }: { cal: any[] }) {
  const flagged = cal.filter((r: any) =>
    r.closed_to_arrival || r.closed_to_departure || r.stop_sell || (r.minimum_stay && r.minimum_stay > 1)
  );
  if (!flagged.length) return <div className="text-muted text-sm py-6 text-center">No restrictions in the next 30 days.</div>;
  return (
    <table>
      <thead><tr><th>Date</th><th>Room Type</th><th>Rate Plan</th><th>CTA</th><th>CTD</th><th>Stop-Sell</th><th className="text-right">MinStay</th></tr></thead>
      <tbody>
        {flagged.slice(0, 80).map((r: any, i: number) => (
          <tr key={i}>
            <td>{fmtDateShort(r.inventory_date)}</td>
            <td>{r.room_type_name}</td>
            <td className="text-muted">{r.rate_name}</td>
            <td>{r.closed_to_arrival ? '✓' : '·'}</td>
            <td>{r.closed_to_departure ? '✓' : '·'}</td>
            <td>{r.stop_sell ? '✓' : '·'}</td>
            <td className="text-right tabular">{r.minimum_stay > 1 ? r.minimum_stay : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
