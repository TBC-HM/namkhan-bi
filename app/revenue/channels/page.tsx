import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { getChannelPerf } from '@/lib/data';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function ChannelsPage() {
  const channels = await getChannelPerf().catch(() => []);
  const total90Rev = channels.reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);
  const total90 = channels.reduce((s: number, c: any) => s + Number(c.bookings_90d || 0), 0);
  const direct = channels.find((c: any) =>
    /direct|website|booking engine|email|walk[\- ]?in/i.test(String(c.source_name || '')));
  const ota = channels.filter((c: any) =>
    /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com/i.test(String(c.source_name || '')));
  const otaRev = ota.reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);

  return (
    <>
      <Section title="Channels" tag="Last 90 days">
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="Total Bookings 90d" value={total90} />
          <Kpi label="Total Revenue 90d" value={total90Rev} kind="money" />
          <Kpi label="OTA Revenue Mix" value={total90Rev ? (otaRev / total90Rev) * 100 : 0} kind="pct" />
          <Kpi label="Direct Mix" value={total90Rev && direct ? (Number(direct.revenue_90d) / total90Rev) * 100 : 0} kind="pct" />
        </div>
      </Section>

      <Section title="Channel Performance · 90d" tag="Sorted by revenue">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th className="text-right">Bookings</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">ADR</th>
              <th className="text-right">Avg Lead</th>
              <th className="text-right">Avg LOS</th>
              <th className="text-right">Cancel%</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c: any) => {
              const cancelPct = c.bookings_30d ? (Number(c.canceled_30d) / Number(c.bookings_30d)) * 100 : 0;
              return (
                <tr key={c.source_name}>
                  <td>{c.source_name}</td>
                  <td className="text-right tabular">{c.bookings_90d}</td>
                  <td className="text-right tabular">{fmtMoney(Number(c.revenue_90d), 'USD')}</td>
                  <td className="text-right tabular">{c.adr_90d ? fmtMoney(Number(c.adr_90d), 'USD') : '—'}</td>
                  <td className="text-right tabular">{c.avg_lead_time_90d ? `${Number(c.avg_lead_time_90d).toFixed(0)}d` : '—'}</td>
                  <td className="text-right tabular">{c.avg_los_90d ? Number(c.avg_los_90d).toFixed(1) : '—'}</td>
                  <td className={`text-right tabular ${cancelPct > 20 ? 'text-red' : ''}`}>{cancelPct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </>
  );
}
