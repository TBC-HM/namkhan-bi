import { Section } from '@/components/sections/Section';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function RatePlansPage() {
  const { data: plans } = await supabase
    .from('rate_plans')
    .select('rate_id, rate_name, rate_type, is_active')
    .eq('property_id', PROPERTY_ID)
    .order('rate_name');

  // Pick reservations grouped by rate_plan
  const { data: usage } = await supabase
    .from('reservations')
    .select('rate_plan, total_amount, nights, status')
    .eq('property_id', PROPERTY_ID)
    .gte('check_in_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));

  const usageMap: Record<string, { bookings: number; revenue: number; nights: number }> = {};
  (usage ?? []).forEach((r: any) => {
    if (!r.rate_plan || r.status === 'canceled') return;
    if (!usageMap[r.rate_plan]) usageMap[r.rate_plan] = { bookings: 0, revenue: 0, nights: 0 };
    usageMap[r.rate_plan].bookings += 1;
    usageMap[r.rate_plan].revenue += Number(r.total_amount || 0);
    usageMap[r.rate_plan].nights += Number(r.nights || 0);
  });

  // Sort plans by 90-day revenue descending
  const ranked = Object.entries(usageMap)
    .map(([name, u]) => ({ name, ...u, adr: u.nights ? u.revenue / u.nights : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <>
      <Section title="Rate Plans · 90 Day Performance" tag={`${plans?.length ?? 0} plans configured`}>
        {ranked.length === 0 ? (
          <div className="text-muted text-sm py-6 text-center">No rate plan usage in last 90 days.</div>
        ) : (
          <table>
            <thead><tr><th>Rate Plan</th><th className="text-right">Bookings</th><th className="text-right">Roomnights</th><th className="text-right">Revenue</th><th className="text-right">ADR</th></tr></thead>
            <tbody>
              {ranked.slice(0, 30).map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="text-right tabular">{r.bookings}</td>
                  <td className="text-right tabular">{r.nights}</td>
                  <td className="text-right tabular">${r.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="text-right tabular">${r.adr.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
