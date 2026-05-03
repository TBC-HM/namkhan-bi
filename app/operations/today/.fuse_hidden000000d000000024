// app/operations/today/page.tsx
// Operations · Today snapshot (body only — layout provides Banner + SubNav + FilterStrip).

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import KpiCard from '@/components/kpi/KpiCard';
import { getArrivalsDeparturesToday, getKpiToday } from '@/lib/data';
import { fmtDateShort } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function OperationsTodayPage() {
  const today = await getKpiToday().catch(() => null);
  const list = await getArrivalsDeparturesToday().catch(() => []);
  const arrivals = list.filter((r: any) => r.today_role === 'arrival');
  const departures = list.filter((r: any) => r.today_role === 'departure');
  const inhouse = list.filter((r: any) => r.today_role === 'in_house');

  const inHouseCount = today?.in_house ?? 0;
  const occupiedTonight = today?.occupied_tonight ?? 0;
  const dataMismatch = inHouseCount !== occupiedTonight;
  const available = (today?.total_rooms ?? 0) - inHouseCount;

  return (
    <>
      <PanelHero
        eyebrow="Right now · live"
        title="Today"
        emphasis="at the property"
        sub="Arrivals · departures · in-house · availability"
        kpis={
          <>
            <KpiCard label="In-House" value={inHouseCount} />
            <KpiCard label="Arrivals" value={today?.arrivals_today ?? 0} />
            <KpiCard label="Departures" value={today?.departures_today ?? 0} />
            <KpiCard label="Available" value={available} hint="Tent 7 retired" />
          </>
        }
      />

      <div className="card-grid-4">
        <KpiCard label="Total Rooms" value={today?.total_rooms ?? 0} hint="Active inventory" />
        <KpiCard
          label="Occupied Tonight"
          value={occupiedTonight}
          tone={dataMismatch ? 'warn' : 'neutral'}
          hint={dataMismatch ? `≠ in-house (${inHouseCount}) — see DQ` : undefined}
        />
        <KpiCard label="OTB Next 90d" value={today?.otb_next_90d ?? 0} />
        <KpiCard label="OOO / OOS" value={null} greyed hint="Housekeeping scope blocked" />
      </div>

      {dataMismatch && (
        <Insight tone="warn" eye="DQ note">
          <strong>In-house ({inHouseCount}) ≠ occupied tonight ({occupiedTonight}).</strong>{' '}
          Mat view <em>mv_kpi_today</em> counts <code>status = 'checked_in'</code> only.
          B1 fix queued.
        </Insight>
      )}

      <div className="card-grid-2" style={{ marginTop: 22 }}>
        <Card title="Arrivals" emphasis={`· ${arrivals.length} today`} sub="Cloudbeds · status not_checked_in / confirmed">
          {arrivals.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No arrivals today.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Source</th>
                  <th>Room Type</th>
                  <th className="num">Nights</th>
                </tr>
              </thead>
              <tbody>
                {arrivals.map((r: any) => (
                  <tr key={r.reservation_id}>
                    <td className="lbl"><strong>{r.guest_name || '—'}</strong></td>
                    <td className="lbl text-mute">{r.source_name || '—'}</td>
                    <td className="lbl">{r.room_type_name || '—'}</td>
                    <td className="num">{r.nights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Departures" emphasis={`· ${departures.length} today`} sub="Outstanding balance highlighted">
          {departures.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No departures today.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Source</th>
                  <th>Room Type</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {departures.map((r: any) => {
                  const bal = Number(r.balance || 0);
                  return (
                    <tr key={r.reservation_id}>
                      <td className="lbl"><strong>{r.guest_name || '—'}</strong></td>
                      <td className="lbl text-mute">{r.source_name || '—'}</td>
                      <td className="lbl">{r.room_type_name || '—'}</td>
                      <td className={`num ${bal > 0 ? 'text-bad' : ''}`}>
                        {bal > 0 ? `$${bal.toFixed(0)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 22 }}>
        <Card title="In-House" emphasis={`· ${inhouse.length} guests`} sub="Currently on property">
          {inhouse.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No in-house guests.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Source</th>
                  <th>Room</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {inhouse.map((r: any) => {
                  const bal = Number(r.balance || 0);
                  return (
                    <tr key={r.reservation_id}>
                      <td className="lbl"><strong>{r.guest_name || '—'}</strong></td>
                      <td className="lbl text-mute">{r.source_name || '—'}</td>
                      <td className="lbl">{r.room_type_name || '—'}</td>
                      <td className="lbl">{fmtDateShort(r.check_in_date)}</td>
                      <td className="lbl">{fmtDateShort(r.check_out_date)}</td>
                      <td className={`num ${bal > 0 ? 'text-bad' : ''}`}>
                        {bal > 0 ? `$${bal.toFixed(0)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
