import { Section } from '@/components/sections/Section';
import { getRateInventoryCalendar } from '@/lib/data';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const today = new Date();
  const to = new Date(today.getTime() + 60 * 86400000);
  const cal = await getRateInventoryCalendar(
    today.toISOString().slice(0, 10),
    to.toISOString().slice(0, 10)
  ).catch(() => []);

  // Group by date
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

  return (
    <Section title="Inventory & Rate Spread · Next 60 days" tag="Per date">
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-right">Available</th>
              <th className="text-right">Min Rate</th>
              <th className="text-right">Max Rate</th>
              <th className="text-right">Spread</th>
            </tr>
          </thead>
          <tbody>
            {days.slice(0, 60).map(d => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td className="text-right tabular">{d.total_avail}</td>
                <td className="text-right tabular">{d.min_rate !== Infinity ? `$${d.min_rate.toFixed(0)}` : '—'}</td>
                <td className="text-right tabular">{d.max_rate !== -Infinity ? `$${d.max_rate.toFixed(0)}` : '—'}</td>
                <td className="text-right tabular text-muted">
                  {d.min_rate !== Infinity && d.max_rate !== -Infinity
                    ? `$${(d.max_rate - d.min_rate).toFixed(0)}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
