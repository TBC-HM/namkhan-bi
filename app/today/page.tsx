import { Section, GreyPlaceholder } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { getArrivalsDeparturesToday, getKpiToday } from '@/lib/data';
import { fmtDateShort } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const today = await getKpiToday().catch(() => null);
  const list = await getArrivalsDeparturesToday().catch(() => []);
  const arrivals = list.filter((r: any) => r.today_role === 'arrival');
  const departures = list.filter((r: any) => r.today_role === 'departure');
  const inhouse = list.filter((r: any) => r.today_role === 'in_house');

  return (
    <div className="pt-6">
      <Section title="Today's Snapshot" tag="Operations · Live">
        <div className="grid grid-cols-5 gap-3">
          <Kpi label="In-House" value={today?.in_house ?? 0} />
          <Kpi label="Arrivals" value={today?.arrivals_today ?? 0} />
          <Kpi label="Departures" value={today?.departures_today ?? 0} />
          <Kpi label="Available Tonight" value={(today?.total_rooms ?? 0) - (today?.in_house ?? 0)} hint="Tent 7 retired" />
          <Kpi label="OOO / OOS" value={null} greyed hint="Housekeeping scope blocked" />
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Arrivals" tag={`${arrivals.length} today`}>
          {arrivals.length === 0 ? (
            <div className="text-muted text-sm py-6 text-center">No arrivals today.</div>
          ) : (
            <table>
              <thead><tr><th>Guest</th><th>Source</th><th>Room Type</th><th className="text-right">Nights</th></tr></thead>
              <tbody>
                {arrivals.map((r: any) => (
                  <tr key={r.reservation_id}>
                    <td>{r.guest_name}</td>
                    <td className="text-muted">{r.source_name}</td>
                    <td>{r.room_type_name}</td>
                    <td className="text-right tabular">{r.nights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Departures" tag={`${departures.length} today`}>
          {departures.length === 0 ? (
            <div className="text-muted text-sm py-6 text-center">No departures today.</div>
          ) : (
            <table>
              <thead><tr><th>Guest</th><th>Source</th><th>Room Type</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {departures.map((r: any) => (
                  <tr key={r.reservation_id}>
                    <td>{r.guest_name}</td>
                    <td className="text-muted">{r.source_name}</td>
                    <td>{r.room_type_name}</td>
                    <td className="text-right tabular">{r.balance && Number(r.balance) > 0 ? `$${Number(r.balance).toFixed(0)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section title="In-House" tag={`${inhouse.length} guests`}>
        {inhouse.length === 0 ? (
          <div className="text-muted text-sm py-6 text-center">No in-house guests.</div>
        ) : (
          <table>
            <thead><tr><th>Guest</th><th>Source</th><th>Room</th><th>Check-in</th><th>Check-out</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {inhouse.map((r: any) => (
                <tr key={r.reservation_id}>
                  <td>{r.guest_name}</td>
                  <td className="text-muted">{r.source_name}</td>
                  <td>{r.room_type_name}</td>
                  <td>{fmtDateShort(r.check_in_date)}</td>
                  <td>{fmtDateShort(r.check_out_date)}</td>
                  <td className="text-right tabular">{r.balance && Number(r.balance) > 0 ? `$${Number(r.balance).toFixed(0)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <div className="grid grid-cols-3 gap-6">
        <Section title="F&B Today" greyed greyedReason="POS schedule integration not in scope yet">
          <div className="text-muted text-xs">Reservations · Covers · Top tables.</div>
        </Section>
        <Section title="Spa Today" greyed greyedReason="Spa scheduler is external">
          <div className="text-muted text-xs">Appointments · Therapist load.</div>
        </Section>
        <Section title="Activities Today" greyed greyedReason="Activity bookings live outside Cloudbeds">
          <div className="text-muted text-xs">Bookings · Suppliers.</div>
        </Section>
      </div>
    </div>
  );
}
