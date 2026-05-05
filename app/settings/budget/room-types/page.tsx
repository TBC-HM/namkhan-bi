// app/settings/budget/room-types/page.tsx
// Admin form for entering per-room-type monthly Budget occupancy (%).
// Writes through public.f_set_room_type_budget(year, month, room_type_id, occupancy_pct)
// which upserts into plan.drivers under the active 'budget' scenario for the
// fiscal year. Pulse "Occupancy by room type" chart picks up these rows
// automatically — third Budget bar appears when present.

import PageHeader from '@/components/layout/PageHeader';
import { supabase } from '@/lib/supabase';
import BudgetForm from './BudgetForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RoomType {
  room_type_id: number;
  room_type_name: string;
}

interface BudgetRow {
  room_type_id: number;
  room_type_name: string;
  budget_occupancy_pct: number;
}

export default async function BudgetRoomTypesPage({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const today = new Date();
  const year = Number(searchParams.year) || today.getUTCFullYear();
  const month = Number(searchParams.month) || (today.getUTCMonth() + 1);

  // Fetch all room types + existing budget rows for selected month
  const [{ data: roomTypesRaw }, { data: existingRaw }] = await Promise.all([
    supabase.from('room_types').select('room_type_id, room_type_name').order('room_type_name'),
    supabase.rpc('f_room_type_budget_occupancy', { p_year: year, p_month: month }),
  ]);

  const roomTypes: RoomType[] = (roomTypesRaw ?? []).map((r: any) => ({
    room_type_id: Number(r.room_type_id),
    room_type_name: String(r.room_type_name ?? ''),
  }));
  const existing: BudgetRow[] = (existingRaw ?? []).map((r: any) => ({
    room_type_id: Number(r.room_type_id),
    room_type_name: String(r.room_type_name ?? ''),
    budget_occupancy_pct: Number(r.budget_occupancy_pct ?? 0),
  }));
  const existingById = new Map(existing.map((e) => [e.room_type_id, e.budget_occupancy_pct]));

  return (
    <>
      <PageHeader
        pillar="Settings"
        tab="Budget · Room types"
        title={<>Per-room-type budget · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>occupancy %</em></>}
        lede={<>
          Enter the budgeted occupancy % per room type per month. Pulse "Occupancy by room type" chart adds a Budget series when rows exist for the active month.
          Writes go to <code>plan.drivers</code> under the active <code>scenario_type=&apos;budget&apos;</code> scenario for the fiscal year.
        </>}
      />

      <BudgetForm
        year={year}
        month={month}
        roomTypes={roomTypes}
        existing={Object.fromEntries(existingById.entries())}
      />

      <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: 'var(--t-sm)' }}>
        <strong>{existing.length}</strong> room type{existing.length === 1 ? '' : 's'} have a budget for {year}-{String(month).padStart(2, '0')}.
        {existing.length === 0 && ' No Budget series will render on Pulse until at least one row is entered.'}
      </div>
    </>
  );
}
