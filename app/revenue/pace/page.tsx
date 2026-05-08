// app/revenue/pace/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PaceCurveRow {
  stay_date: string;
  otb_rooms: number | null;
  otb_revenue: number | null;
  otb_adr: number | null;
  stly_rooms: number | null;
  stly_revenue: number | null;
  pickup_7d: number | null;
  pickup_28d: number | null;
  occupancy_pct: number | null;
}

interface PickupRow {
  stay_date: string;
  pickup_rooms: number | null;
  pickup_revenue: number | null;
  window_days: number | null;
}

interface RoomTypePulseRow {
  room_type: string;
  otb_rooms: number | null;
  capacity: number | null;
  occupancy_pct: number | null;
  adr: number | null;
}

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString()}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtCcy(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: v_pace_curve — OTB vs STLY for next 90 days
  const { data: paceData } = await supabase
    .from('v_pace_curve')
    .select('*')
    .order('stay_date', { ascending: true })
    .limit(90);
  const pace: PaceCurveRow[] = (paceData ?? []) as PaceCurveRow[];

  // Secondary: v_pickup_velocity_28d — recent pickup by date
  const { data: pickupData } = await supabase
    .from('v_pickup_velocity_28d')
    .select('*')
    .order('stay_date', { ascending: true })
    .limit(28);
  const pickup: PickupRow[] = (pickupData ?? []) as PickupRow[];

  // Tertiary: v_room_type_pulse — current OTB by room type
  const { data: rtData } = await supabase
    .from('v_room_type_pulse')
    .select('*')
    .order('room_type', { ascending: true })
    .limit(20);
  const roomTypes: RoomTypePulseRow[] = (rtData ?? []) as RoomTypePulseRow[];

  // Aggregate KPIs from pace curve (next 30d window)
  const next30 = pace.slice(0, 30);
  const totalOtbRooms = next30.reduce((s, r) => s + (r.otb_rooms ?? 0), 0);
  const totalOtbRevenue = next30.reduce((s, r) => s + (r.otb_revenue ?? 0), 0);
  const totalStlyRooms = next30.reduce((s, r) => s + (r.stly_rooms ?? 0), 0);
  const avgOccPct = next30.length > 0
    ? next30.reduce((s, r) => s + (r.occupancy_pct ?? 0), 0) / next30.length
    : null;
  const avgAdr = totalOtbRooms > 0 ? totalOtbRevenue / totalOtbRooms : null;
  const vsStlyRooms = totalStlyRooms > 0
    ? ((totalOtbRooms - totalStlyRooms) / totalStlyRooms) * 100
    : null;

  // Total pickup (28d window)
  const totalPickupRooms = pickup.reduce((s, r) => s + (r.pickup_rooms ?? 0), 0);

  return (
    <main style={{ padding: '24px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="Revenue" tab="Pace" title="Pace &amp; Pickup" />

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="OTB Rooms (Next 30d)" value={fmt(totalOtbRooms)} />
        <KpiBox label="OTB Revenue (Next 30d)" value={fmtCcy(totalOtbRevenue)} />
        <KpiBox label="Avg ADR (Next 30d)" value={fmtCcy(avgAdr)} />
        <KpiBox label="Avg OCC % (Next 30d)" value={fmtPct(avgOccPct != null ? avgOccPct : null)} />
        <KpiBox
          label="vs STLY Rooms"
          value={vsStlyRooms != null ? `${vsStlyRooms >= 0 ? '+' : ''}${vsStlyRooms.toFixed(1)}%` : '—'}
        />
        <KpiBox label="Pickup (28d)" value={fmt(totalPickupRooms)} />
      </div>

      {/* Pace curve table */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          OTB Curve — Next 90 Days
        </h2>
        {pace.length === 0 ? (
          <p style={{ color: '#888' }}>No pace data available (v_pace_curve returned 0 rows).</p>
        ) : (
          <DataTable
            columns={[
              { key: 'stay_date', header: 'Stay Date' },
              { key: 'otb_rooms', header: 'OTB Rooms' },
              { key: 'otb_adr', header: 'ADR' },
              { key: 'otb_revenue', header: 'Revenue' },
              { key: 'stly_rooms', header: 'STLY Rooms' },
              { key: 'pickup_7d', header: 'Pickup 7d' },
              { key: 'pickup_28d', header: 'Pickup 28d' },
              { key: 'occupancy_pct', header: 'OCC %' },
            ]}
            rows={pace.map((r) => ({
              stay_date: r.stay_date ?? '—',
              otb_rooms: fmt(r.otb_rooms),
              otb_adr: fmtCcy(r.otb_adr),
              otb_revenue: fmtCcy(r.otb_revenue),
              stly_rooms: fmt(r.stly_rooms),
              pickup_7d: fmt(r.pickup_7d),
              pickup_28d: fmt(r.pickup_28d),
              occupancy_pct: fmtPct(r.occupancy_pct),
            }))}
          />
        )}
      </section>

      {/* Room type pulse */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Room Type Pulse
        </h2>
        {roomTypes.length === 0 ? (
          <p style={{ color: '#888' }}>No room-type data available (v_room_type_pulse returned 0 rows).</p>
        ) : (
          <DataTable
            columns={[
              { key: 'room_type', header: 'Room Type' },
              { key: 'otb_rooms', header: 'OTB' },
              { key: 'capacity', header: 'Capacity' },
              { key: 'occupancy_pct', header: 'OCC %' },
              { key: 'adr', header: 'ADR' },
            ]}
            rows={roomTypes.map((r) => ({
              room_type: r.room_type ?? '—',
              otb_rooms: fmt(r.otb_rooms),
              capacity: fmt(r.capacity),
              occupancy_pct: fmtPct(r.occupancy_pct),
              adr: fmtCcy(r.adr),
            }))}
          />
        )}
      </section>

      {/* Pickup velocity table */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Pickup Velocity — Last 28 Days
        </h2>
        {pickup.length === 0 ? (
          <p style={{ color: '#888' }}>No pickup data available (v_pickup_velocity_28d returned 0 rows).</p>
        ) : (
          <DataTable
            columns={[
              { key: 'stay_date', header: 'Stay Date' },
              { key: 'pickup_rooms', header: 'Pickup Rooms' },
              { key: 'pickup_revenue', header: 'Pickup Revenue' },
              { key: 'window_days', header: 'Window (d)' },
            ]}
            rows={pickup.map((r) => ({
              stay_date: r.stay_date ?? '—',
              pickup_rooms: fmt(r.pickup_rooms),
              pickup_revenue: fmtCcy(r.pickup_revenue),
              window_days: fmt(r.window_days),
            }))}
          />
        )}
      </section>
    </main>
  );
}
