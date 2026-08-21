// app/(cockpit)/_design/OpsOverviewKpis.tsx
// PBS 2026-08-21 · 4 KPI tiles migrated from /operations/overview to the
// Operations HoD landing (sits below the existing 3-tile "live" strip).
// Self-contained server component reading the same gold views the overview
// page used (v_overview_live), scoped by property_id.

import { KpiTile, type KpiTileProps } from './index';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface Props { propertyId: number }

interface LiveRow {
  in_house: number | null;
  arriving_today: number | null;
  departing_today: number | null;
  otb_next_90d: number | null;
}

export default async function OpsOverviewKpis({ propertyId }: Props) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_overview_live')
    .select('in_house, arriving_today, departing_today, otb_next_90d')
    .eq('property_id', propertyId)
    .maybeSingle();
  const live = (data ?? null) as LiveRow | null;

  const tiles: KpiTileProps[] = [
    { label: 'In-house',        value: Number(live?.in_house ?? 0),         size: 'sm' },
    { label: 'Arriving today',  value: Number(live?.arriving_today ?? 0),   size: 'sm' },
    { label: 'Departing today', value: Number(live?.departing_today ?? 0),  size: 'sm' },
    { label: 'OTB · next 90d',  value: Number(live?.otb_next_90d ?? 0),     size: 'sm', footnote: 'room-nights' },
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
      {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
    </div>
  );
}
