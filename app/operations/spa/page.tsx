// app/operations/spa/page.tsx
// Operations · Spa — wellness only.
// Body-only page (layout provides Banner + SubNav + FilterStrip).

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

export default async function SpaPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const daily = await getKpiDaily(period.from, period.to).catch(() => []);
  const a30 = aggregateDaily(daily, period.capacityMode);
  const cap = await getCaptureRates().catch(() => null);

  const { data: spaItems } = await supabase
    .from('mv_classified_transactions')
    .select('description, amount, transaction_date, reservation_id')
    .eq('property_id', PROPERTY_ID)
    .eq('usali_dept', 'Other Operated')
    .eq('usali_subdept', 'Spa')
    .gte('transaction_date', period.from)
    .lte('transaction_date', period.to);

  // Top treatments
  const map: Record<string, { count: number; revenue: number }> = {};
  (spaItems ?? []).forEach((t: any) => {
    const k = t.description || 'Unknown';
    if (!map[k]) map[k] = { count: 0, revenue: 0 };
    map[k].count += 1;
    map[k].revenue += Number(t.amount || 0);
  });
  const topSpa = Object.entries(map)
    .map(([name, x]) => ({ name, ...x }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  const totalSpaResv = new Set((spaItems ?? []).map((t: any) => t.reservation_id)).size;
  const captureRate = Number(cap?.spa_capture_pct ?? 0);
  const perOccRn = Number(cap?.spa_per_occ_room ?? 0);

  return (
    <>
      <PanelHero
        eyebrow={`Spa · ${period.label}`}
        title="Wellness"
        emphasis="treatments"
        sub="Therapy · attached treatments · capture rate · per-occupied-roomnight"
        kpis={
          <>
            <KpiCard label="Spa Revenue" value={a30?.spa_revenue ?? 0} kind="money" />
            <KpiCard label="Treatments" value={topSpa.reduce((s, t) => s + t.count, 0)} hint={`line items ${period.label}`} />
            <KpiCard label="Reservations" value={totalSpaResv} hint="with at least 1 spa charge" />
            <KpiCard
              label="Spa / Occ Rn"
              value={perOccRn}
              kind="money"
              tone={perOccRn >= 25 ? 'pos' : 'neutral'}
              hint="benchmark $25-40"
            />
          </>
        }
      />

      <div className="card-grid-3">
        <KpiCard
          label="Capture Rate"
          value={captureRate}
          kind="pct"
          tone={captureRate >= 35 ? 'pos' : captureRate >= 20 ? 'warn' : 'neg'}
          hint="benchmark 35%+"
        />
        <KpiCard label="Therapist Util" value={null} greyed hint="External scheduler" />
        <KpiCard label="Avg Treatment $" value={null} greyed hint="Spa scheduler not synced" />
      </div>

      <Card title="Top spa treatments" emphasis={period.label} sub={`${topSpa.length} treatments · ranked by revenue`} source="mv_classified_transactions">
        {topSpa.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No spa transactions in window.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Treatment</th>
                <th className="num">Sold</th>
                <th className="num">Revenue</th>
                <th className="num">Avg Ticket</th>
              </tr>
            </thead>
            <tbody>
              {topSpa.map((s) => (
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
        <Card title="Wellness packages" sub="Package attach rate" source="grey">
          <div className="stub" style={{ padding: 32 }}>
            <h3>Coming soon</h3>
            <p>Multi-treatment package definitions, attach rate per stay, average package value.
            Pending external scheduler integration.</p>
          </div>
        </Card>
        <Card title="Therapist load" sub="Slot utilization · therapist productivity" source="grey">
          <div className="stub" style={{ padding: 32 }}>
            <h3>Coming soon</h3>
            <p>Therapist hours booked vs available. Pending external scheduler integration.</p>
          </div>
        </Card>
      </div>

      {captureRate < 25 && captureRate > 0 && (
        <Insight tone="warn" eye="Spa capture">
          <strong>Capture rate {captureRate.toFixed(1)}%</strong> is well below the 35% benchmark
          for boutique luxury. Investigate: pre-arrival upsell email, spa menu visibility in room,
          welcome-amenity treatment voucher.
        </Insight>
      )}
    </>
  );
}
