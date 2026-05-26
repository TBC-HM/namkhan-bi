// app/_components/registry/BedbankKpiStrip.tsx
// PBS 2026-05-26 (#248): bedbank YTD numbers as a top KPI strip on /leakage
// (instead of a per-bedbank table). Mounted via PageRenderer's kpiStrip slot.

import { KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props { propertyId: number }

export default async function BedbankKpiStrip({ propertyId }: Props) {
  const { data, error } = await supabase
    .from('v_bedbank_kpis_totals')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (error || !data) return null;

  const ccy: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';

  const tiles: KpiTileProps[] = [
    { label: 'Active bedbanks', value: Number(data.active_bedbanks ?? 0), size: 'sm' },
    { label: 'Bookings YTD',    value: Number(data.total_bookings_ytd ?? 0), size: 'sm' },
    { label: 'Roomnights YTD',  value: Number(data.total_roomnights_ytd ?? 0), size: 'sm' },
    { label: 'Revenue YTD',     value: Math.round(Number(data.total_revenue_ytd ?? 0)), currency: ccy, size: 'sm' },
    { label: 'ADR YTD',         value: Math.round(Number(data.avg_adr_ytd ?? 0)), currency: ccy, size: 'sm' },
    { label: 'Avg LOS',         value: `${Number(data.avg_los_ytd ?? 0).toFixed(1)}n`, size: 'sm', footnote: 'nights/stay' },
    { label: 'Booking window',  value: `${Number(data.avg_booking_window_ytd ?? 0).toFixed(0)}d`, size: 'sm', footnote: 'avg lead' },
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        Bedbank KPIs · YTD
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}
