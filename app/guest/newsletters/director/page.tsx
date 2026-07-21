// app/guest/newsletters/director/page.tsx
// PBS 2026-07-22 (Newsletter Engine v2): AI Editorial Director.
// Server component that loads goals + existing calendar slots and mounts
// the DirectorClient (goal editor · generate/regenerate · month grid · slot drawer).

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../_subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import NewslettersSubStrip from '../_components/NewslettersSubStrip';
import DirectorClient, { type GoalRow, type SlotRow } from './_components/DirectorClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DirectorPage() {
  const pid = PROPERTY_ID;

  const [{ data: goalRows }, { data: slotRows }] = await Promise.all([
    supabase.from('v_director_goals').select('*').eq('property_id', pid).order('weight', { ascending: false }),
    supabase.from('v_director_calendar').select('*').eq('property_id', pid).order('slot_date', { ascending: true }),
  ]);

  const goals: GoalRow[] = (goalRows as GoalRow[]) ?? [];
  const slots: SlotRow[] = (slotRows as SlotRow[]) ?? [];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  const subtitle = slots.length
    ? `${slots.length} slot${slots.length===1?'':'s'} · ${goals.length} editorial goals`
    : 'No plan yet — set goals below and generate a 12-month plan.';

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Contacts · AI Editorial Director" subtitle={subtitle} tabs={tabs}>
        <NewslettersSubStrip active="director" />
        <div style={{ gridColumn:'1 / -1' }}>
          <DirectorClient propertyId={pid} initialGoals={goals} initialSlots={slots} />
        </div>
      </DashboardPage>
    </div>
  );
}
