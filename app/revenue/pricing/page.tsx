// app/revenue/pricing/page.tsx
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

  // Canonical views per KB #321 revenue_v2_canonical_wiring_v1
  // /revenue-v2/pricing: QUEUE=v_decisions_queued_top, PACE=v_pace_curve, KPI=mv_kpi_daily
  const [{ data: kpiData }, { data: queueData }, { data: paceData }] =
    await Promise.all([
      supabase.from('mv_kpi_daily').select('*').order('night_date', { ascending: false }).limit(1),
      supabase.from('v_decisions_queued_top').select('*').limit(20),
      supabase.from('v_pace_curve').select('*').order('stay_date', { ascending: true }).limit(30),
    ]);

  const kpi = kpiData?.[0] ?? null;
  const queueRows = queueData ?? [];
  const paceRows = paceData ?? [];

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Pricing" title="Pricing" />

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="OCC"
          value={kpi ? `${Number(kpi.occupancy_pct).toFixed(1)}%` : '—'}
        />
        <KpiBox
          label="ADR"
          value={kpi ? `$${Number(kpi.adr).toFixed(0)}` : '—'}
        />
        <KpiBox
          label="RevPAR"
          value={kpi ? `$${Number(kpi.revpar).toFixed(0)}` : '—'}
        />
        <KpiBox
          label="Rooms Sold"
          value={kpi ? String(kpi.rooms_sold) : '—'}
        />
      </div>

      {/* BAR Guardrails info banner */}
      <div
        style={{
          background: '#fdf6e3',
          border: '1px solid #c9a84c',
          borderRadius: 6,
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 13,
          color: '#5a4010',
        }}
      >
        <strong>BAR Tier Rules (KB #284):</strong> LOS 1n = Full BAR · LOS 2–3n = standard tier ·
        LOS 4n+ = min 7% off BAR. B2B net rate: 18–22% off BAR (floor 25%). Weekends MLOS=2;
        peak compression days MLOS=3. All rates are <em>recommendations only</em> — execute in
        Cloudbeds.
      </div>

      {/* Decisions Queue */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#c9a84c',
            marginBottom: 12,
          }}
        >
          BAR Proposals — Queued Decisions
        </h2>
        <DataTable
          columns={[
            { key: 'decision_date', header: 'Date' },
            { key: 'room_type', header: 'Room Type' },
            { key: 'recommended_bar', header: 'Rec BAR' },
            { key: 'current_bar', header: 'Current BAR' },
            { key: 'delta_pct', header: 'Δ%' },
            { key: 'reasoning', header: 'Reasoning' },
            { key: 'status', header: 'Status' },
          ]}
          rows={
            queueRows.length > 0
              ? queueRows.map((r) => ({
                  ...r,
                  recommended_bar: r.recommended_bar != null ? `$${Number(r.recommended_bar).toFixed(0)}` : '—',
                  current_bar: r.current_bar != null ? `$${Number(r.current_bar).toFixed(0)}` : '—',
                  delta_pct:
                    r.delta_pct != null
                      ? `${Number(r.delta_pct) >= 0 ? '+' : ''}${Number(r.delta_pct).toFixed(1)}%`
                      : '—',
                  reasoning: r.reasoning ?? '—',
                  room_type: r.room_type ?? '—',
                  status: r.status ?? '—',
                }))
              : [
                  {
                    decision_date: '—',
                    room_type: '—',
                    recommended_bar: '—',
                    current_bar: '—',
                    delta_pct: '—',
                    reasoning: 'No queued decisions',
                    status: '—',
                  },
                ]
          }
        />
      </section>

      {/* Pace Curve — forward-looking OTB */}
      <section>
        <h2
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#c9a84c',
            marginBottom: 12,
          }}
        >
          Forward Pace (OTB 30 days)
        </h2>
        <DataTable
          columns={[
            { key: 'stay_date', header: 'Stay Date' },
            { key: 'otb_rooms', header: 'OTB Rooms' },
            { key: 'otb_adr', header: 'OTB ADR' },
            { key: 'stly_rooms', header: 'STLY Rooms' },
            { key: 'stly_adr', header: 'STLY ADR' },
            { key: 'pickup_rooms', header: 'Pickup' },
            { key: 'occ_pct', header: 'OCC%' },
          ]}
          rows={
            paceRows.length > 0
              ? paceRows.map((r) => ({
                  ...r,
                  otb_adr: r.otb_adr != null ? `$${Number(r.otb_adr).toFixed(0)}` : '—',
                  stly_adr: r.stly_adr != null ? `$${Number(r.stly_adr).toFixed(0)}` : '—',
                  otb_rooms: r.otb_rooms ?? '—',
                  stly_rooms: r.stly_rooms ?? '—',
                  pickup_rooms: r.pickup_rooms ?? '—',
                  occ_pct:
                    r.occ_pct != null ? `${Number(r.occ_pct).toFixed(1)}%` : '—',
                }))
              : [
                  {
                    stay_date: '—',
                    otb_rooms: '—',
                    otb_adr: '—',
                    stly_rooms: '—',
                    stly_adr: '—',
                    pickup_rooms: '—',
                    occ_pct: '—',
                  },
                ]
          }
        />
      </section>
    </main>
  );
}
