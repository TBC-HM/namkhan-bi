// app/operations/page.tsx
// PBS 2026-06-09 #138 — Operations HoD lands on shared HodLanding primitive,
// but replaces the 4 hardcoded placeholder tiles (OCC TODAY / F&B COVERS / SPA /
// INV ALERTS — none wired) with 3 LIVE tiles fetched server-side:
//   • Rooms occupied today (with occ%)
//   • Check-ins today
//   • Check-outs today
import HodLanding from '@/app/_components/HodLanding';
import type { KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const NAMKHAN_CAPACITY = 30;

export default async function OperationsPage() {
  const pid = PROPERTY_ID;
  const todayIso = new Date().toISOString().slice(0, 10);

  const [occResp, ciResp, coResp] = await Promise.all([
    supabase.from('v_otb_pace')
      .select('confirmed_rooms')
      .eq('property_id', pid)
      .eq('night_date', todayIso)
      .maybeSingle(),
    supabase.from('v_reservations_unified')
      .select('reservation_id', { count: 'exact', head: true })
      .eq('property_id', pid)
      .eq('is_cancelled', false)
      .eq('check_in_date', todayIso),
    supabase.from('v_reservations_unified')
      .select('reservation_id', { count: 'exact', head: true })
      .eq('property_id', pid)
      .eq('is_cancelled', false)
      .eq('check_out_date', todayIso),
  ]);

  const occToday  = Number((occResp.data as { confirmed_rooms?: number } | null)?.confirmed_rooms ?? 0);
  const checkIns  = ciResp.count ?? 0;
  const checkOuts = coResp.count ?? 0;
  const cap       = NAMKHAN_CAPACITY;
  const occPct    = cap > 0 ? Math.round((occToday / cap) * 100) : 0;

  const liveTiles: KpiTileProps[] = [
    { label: 'Rooms occupied today', value: `${occToday}/${cap}`, footnote: `${occPct}% occupancy · cap ${cap}`,
      status: (occPct >= 80 ? 'green' : occPct >= 50 ? 'amber' : 'grey') as 'green'|'amber'|'grey', size: 'sm' },
    { label: 'Check-ins today',  value: checkIns,  footnote: `${todayIso}`, status: checkIns  > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Check-outs today', value: checkOuts, footnote: `${todayIso}`, status: checkOuts > 0 ? 'green' : 'grey', size: 'sm' },
  ];

  return <HodLanding slug="operations" liveTiles={liveTiles} />;
}
