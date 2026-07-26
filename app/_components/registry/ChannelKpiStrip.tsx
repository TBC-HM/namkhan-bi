// app/_components/registry/ChannelKpiStrip.tsx
// Brief leakage-channel-kpi-strips (goal 41, ADR-172): OTA / DMC / Direct YTD
// KPI strips on /leakage, directly below BedbankKpiStrip. One parametrized
// component (REUSE-FIRST), three mounts via PageRenderer's kpiStrip slot.
// Mirrors BedbankKpiStrip line-for-line; the *_totals channel views share its
// exact column contract except active_sources (vs active_bedbanks).
// No row for the property (e.g. Donna has zero DMC) → renders nothing.

import { KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props {
  propertyId: number;
  /** Strip heading, e.g. 'OTA KPIs · YTD' */
  label: string;
  /** public bridge view with the shared *_kpis_totals column contract */
  view: 'v_ota_kpis_totals' | 'v_dmc_kpis_totals' | 'v_direct_kpis_totals';
}

export default async function ChannelKpiStrip({ propertyId, label, view }: Props) {
  const { data, error } = await supabase
    .from(view)
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle();

  // No row (e.g. DMC on Donna) → render nothing. Never a €0 tile row.
  if (error || !data) return null;

  const ccy: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';

  const tiles: KpiTileProps[] = [
    { label: 'Active sources', value: Number(data.active_sources ?? 0), size: 'sm' },
    { label: 'Bookings YTD',   value: Number(data.total_bookings_ytd ?? 0), size: 'sm' },
    { label: 'Roomnights YTD', value: Number(data.total_roomnights_ytd ?? 0), size: 'sm' },
    { label: 'Revenue YTD',    value: Math.round(Number(data.total_revenue_ytd ?? 0)), currency: ccy, size: 'sm' },
    { label: 'ADR YTD',        value: Math.round(Number(data.avg_adr_ytd ?? 0)), currency: ccy, size: 'sm' },
    { label: 'Avg LOS',        value: `${Number(data.avg_los_ytd ?? 0).toFixed(1)}n`, size: 'sm', footnote: 'nights/stay' },
    { label: 'Booking window', value: `${Number(data.avg_booking_window_ytd ?? 0).toFixed(0)}d`, size: 'sm', footnote: 'avg lead' },
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}
