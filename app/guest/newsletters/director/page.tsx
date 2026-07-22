// app/guest/newsletters/director/page.tsx
// PBS 2026-07-21 pm (Newsletter Calendar v2 · per-group): loads subscriber_groups
// and passes them to DirectorClient so the calendar can colour by group and
// filter/plan per group.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../_subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import NewslettersSubStrip from '../_components/NewslettersSubStrip';
import DirectorClient, { type GoalRow, type SlotRow, type GroupRow } from './_components/DirectorClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DirectorPage() {
  const pid = PROPERTY_ID;

  const [{ data: goalRows }, { data: slotRows }, { data: groupRows }] = await Promise.all([
    supabase.from('v_director_goals').select('*').eq('property_id', pid).order('weight', { ascending: false }),
    supabase.from('v_director_calendar').select('*').eq('property_id', pid).order('slot_date', { ascending: true }),
    supabase.from('v_subscriber_groups').select('slug,name,color,sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false }).order('name', { ascending: true }),
  ]);

  const goals: GoalRow[] = (goalRows as GoalRow[]) ?? [];
  const slots: SlotRow[] = (slotRows as SlotRow[]) ?? [];
  const groups: GroupRow[] = (groupRows as GroupRow[]) ?? [];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  const subtitle = slots.length
    ? `${slots.length} slot${slots.length===1?'':'s'} · ${goals.length} editorial goals · ${groups.length} audience groups`
    : 'No plan yet — pick a group below, set date range + cadence, and generate.';

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Contacts · AI Editorial Director" subtitle={subtitle} tabs={tabs}>
        <NewslettersSubStrip active="director" />
        <div style={{ gridColumn:'1 / -1' }}>
          <DirectorClient propertyId={pid} initialGoals={goals} initialSlots={slots} groups={groups} />
        </div>
      </DashboardPage>
    </div>
  );
}
