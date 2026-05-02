// app/operations/activities/page.tsx
// Operations · Activities — excursions, experiences, transport.
// Body-only page (layout provides Banner + SubNav + FilterStrip).

import FilterStrip from '@/components/nav/FilterStrip';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import Insight from '@/components/sections/Insight';
import { getCaptureRates, getKpiDaily, aggregateDaily } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function ActivitiesPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const daily = await getKpiDaily(period.from, period.to).catch(() => []);
  const a30 = aggregateDaily(daily, period.capacityMode);
  const cap = await getCaptureRates().catch(() => null);

  const { data: actItems } = await supabase
    .from('mv_classified_transactions')
    .select('description, amount, transaction_date, reservation_id')
    .eq('property_id', PROPERTY_ID)
    .eq('usali_dept', 'Other Operated')
    .eq('usali_subdept', 'Activities')
    .gte('transaction_date', period.from)
    .lte('transaction_date', period.to);

  // Transport (separate sub-dept inside Other Operated)
  const { data: transportItems } = await supabase
    .from('mv_classified_transactions')
    .select('description, amount')
    .eq('property_id', PROPERTY_ID)
    .eq('usali_dept', 'Other Operated')
    .eq('usali_subdept', 'Transportation')
    .gte('transaction_date', period.from)
    .lte('transaction_date', period.to);

  const map: Record<string, { count: number; revenue: number }> = {};
  (actItems ?? []).forEach((t: any) => {
    const k = t.description || 'Unknown';
    if (!map[k]) map[k] = { count: 0, revenue: 0 };
    map[k].count += 1;
    map[k].revenue += Number(t.amount || 0);
  });
  const topAct = Object.entries(map)
    .map(([name, x]) => ({ name, ...x }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  const transportRevenue = (transportItems ?? []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
  const totalActResv = new Set((actItems ?? []).map((t: any) => t.reservation_id)).size;
  const captureRate = Number(cap?.activity_capture_pct ?? 0);
  const perOccRn = Number(cap?.activity_per_occ_room ?? 0);

  return (
    <>
      <FilterStrip showForward={false} showCompare={false} showSegment={false} liveSource="Cloudbeds · live" />
      <PanelHero
        eyebrow={`Activities · ${period.label}`}
        title="Excursions"
        emphasis="& experiences"
        sub="Bookings · capture · per-occupied-roomnight · transport"
        kpis={
          <>
            <KpiCard label="Activity Revenue" value={a30?.activity_revenue ?? 0} kind="money" />
            <KpiCard label="Bookings" value={topAct.reduce((s, t) => s + t.count, 0)} hint={`line items ${period.label}`} />
            <KpiCard label="Reservations" value={totalActResv} hint="with at least 1 activity" />
            <KpiCard label="Transport Revenue" value={transportRevenue} kind="money" hint="airport · transfers" />
          </>
        }
      />

      <div className="card-grid-3">
        <KpiCard
          label="Capture Rate"
          value={captureRate}
          kind="pct"
          tone={captureRate >= 30 ? 'pos' : captureRate >= 15 ? 'warn' : 'neg'}
          hint="benchmark 30%+"
        />
        <KpiCard
          label="Activity / Occ Rn"
          value={perOccRn}
          kind="money"
          tone={perOccRn >= 20 ? 'pos' : 'neutral'}
          hint="benchmark $20-35"
        />
        <KpiCard label="Supplier Margin" value={null} greyed hint="Supplier P&L not yet integrated" />
      </div>

      <Card title="Top activities" emphasis={period.label} sub={`${topAct.length} activities · ranked by revenue`} source="mv_classified_transactions">
        {topAct.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No activity transactions in window.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Activity</th>
                <th className="num">Sold</th>
                <th className="num">Revenue</th>
                <th className="num">Avg Ticket</th>
              </tr>
            </thead>
            <tbody>
              {topAct.map((s) => (
                <tr key={s.name}>
                  <td className="lbl"><strong>{s.name}</strong></td>
                  <td className="num">{s.count}</td>
                  <td className="num">{fmtMoney(s.revenue, 'USD')}</td>
                  <td className="num text-mute">{fmtMoney(s.revenue / s.count, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="card-grid-2" style={{ marginTop: 22 }}>
        <Card title="Supplier ledger" sub="Margin tracking · supplier P&L" source="grey">
          <div className="stub" style={{ padding: 32 }}>
            <h3>Coming soon</h3>
            <p>Supplier-level margin attribution. Activity bookings live outside Cloudbeds —
            requires a supplier ledger schema.</p>
          </div>
        </Card>
        <Card title="Booking lead time" sub="Pre-arrival vs in-stay split" source="grey">
          <div className="stub" style={{ padding: 32 }}>
            <h3>Coming soon</h3>
            <p>Lead-time analysis identifies upsell opportunities. Pre-arrival emails get higher
            attach rates than in-stay walk-up bookings.</p>
          </div>
        </Card>
      </div>

      {captureRate < 20 && captureRate > 0 && (
        <Insight tone="warn" eye="Activity capture">
          <strong>Capture rate {captureRate.toFixed(1)}%</strong> is below the 30% benchmark.
          Activity bookings off-property are likely happening (Mekong cruises, kuang si,
          elephant sanctuaries) but not posting to the room. Investigate concierge workflow:
          are bookings made via the property and posted back to the folio?
        </Insight>
      )}
    </>
  );
}
