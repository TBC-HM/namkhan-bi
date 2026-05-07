// app/revenue-v2/pace/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // OTB pace curve — forward-looking 90 days
  const { data: paceData } = await supabase
    .from('v_pace_curve')
    .select('*')
    .order('stay_date', { ascending: true })
    .limit(90);

  // Pickup velocity — rolling 28-day window
  const { data: pickupData } = await supabase
    .from('v_pickup_velocity_28d')
    .select('*')
    .order('pickup_date', { ascending: false })
    .limit(28);

  const pace = paceData ?? [];
  const pickup = pickupData ?? [];

  // Summary KPIs derived from pace curve
  const d30 = pace.find((r) => r.days_out <= 30);
  const d60 = pace.find((r) => r.days_out <= 60);
  const d90 = pace.find((r) => r.days_out <= 90);

  const fmtPct = (v: number | null | undefined) =>
    v != null ? `${(v * 100).toFixed(1)}%` : '—';
  const fmtNum = (v: number | null | undefined) =>
    v != null ? v.toFixed(0) : '—';

  return (
    <main className="p-6 space-y-6">
      <PageHeader pillar="Revenue" tab="Pace" title="Pace & Pickup" />

      {/* KPI tiles — D-30 / D-60 / D-90 pace targets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KpiBox
          label="OTB D-30 Occ"
          value={fmtPct(d30?.occupancy_pct)}
          subLabel="Target 65-75%"
        />
        <KpiBox
          label="OTB D-60 Occ"
          value={fmtPct(d60?.occupancy_pct)}
          subLabel="Target 45-55%"
        />
        <KpiBox
          label="OTB D-90 Occ"
          value={fmtPct(d90?.occupancy_pct)}
          subLabel="Target 25-35%"
        />
        <KpiBox
          label="28d Avg Pickup"
          value={fmtNum(
            pickup.length > 0
              ? pickup.reduce((s: number, r: { rooms_picked_up?: number }) => s + (r.rooms_picked_up ?? 0), 0) / pickup.length
              : null
          )}
          subLabel="Rooms / day"
        />
      </div>

      {/* Pace curve table */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          OTB Pace Curve — Next 90 Days
        </h2>
        <DataTable
          columns={[
            { key: 'stay_date',      header: 'Stay Date' },
            { key: 'days_out',       header: 'Days Out' },
            { key: 'rooms_otb',      header: 'Rooms OTB' },
            { key: 'occupancy_pct',  header: 'Occ %' },
            { key: 'adr',            header: 'ADR ($)' },
            { key: 'revpar',         header: 'RevPAR ($)' },
            { key: 'rooms_stly',     header: 'STLY Rooms' },
            { key: 'occ_stly',       header: 'STLY Occ %' },
            { key: 'pace_index',     header: 'Pace Index' },
          ]}
          rows={pace.map((r) => ({
            ...r,
            occupancy_pct: fmtPct(r.occupancy_pct),
            occ_stly:      fmtPct(r.occ_stly),
            adr:           r.adr     != null ? `$${Number(r.adr).toFixed(2)}`    : '—',
            revpar:        r.revpar  != null ? `$${Number(r.revpar).toFixed(2)}`  : '—',
            pace_index:    r.pace_index != null ? Number(r.pace_index).toFixed(2) : '—',
            rooms_otb:     r.rooms_otb  ?? '—',
            rooms_stly:    r.rooms_stly ?? '—',
            days_out:      r.days_out   ?? '—',
          }))}
        />
      </section>

      {/* Pickup velocity table */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Pickup Velocity — Last 28 Days
        </h2>
        <DataTable
          columns={[
            { key: 'pickup_date',      header: 'Pickup Date' },
            { key: 'rooms_picked_up',  header: 'Rooms Picked Up' },
            { key: 'cancellations',    header: 'Cancellations' },
            { key: 'net_pickup',       header: 'Net Pickup' },
            { key: 'adr_pickup',       header: 'ADR Pickup ($)' },
          ]}
          rows={pickup.map((r) => ({
            ...r,
            rooms_picked_up: r.rooms_picked_up ?? '—',
            cancellations:   r.cancellations   ?? '—',
            net_pickup:      r.net_pickup       ?? '—',
            adr_pickup:      r.adr_pickup != null ? `$${Number(r.adr_pickup).toFixed(2)}` : '—',
          }))}
        />
      </section>
    </main>
  );
}
