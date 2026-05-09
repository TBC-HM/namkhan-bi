// app/operations/events/_data.ts
// Server-side fetcher for the operations Events calendar.
// Source of truth: marketing.calendar_events JOIN marketing.calendar_event_types.
//
// We surface 5 categories (lunar · national · property · religious · seasonal)
// and derive a "country" label from `source_markets` (ISO-2 array). The filter
// bar in EventsCalendar uses these arrays directly — no client-side fetch.

import { supabase } from '@/lib/supabase';

export interface CalendarEvent {
  id: string;
  type_code: string;
  display_name: string;
  date_start: string; // YYYY-MM-DD
  date_end: string;   // YYYY-MM-DD
  category: string;   // lunar | national | property | religious | seasonal
  category_display: string;
  is_confirmed: boolean;
  source_markets: string[];
  notes: string | null;
}

export interface EventTypeOption {
  type_code: string;
  display_name: string;
  category: string;
}

const CATEGORY_DISPLAY: Record<string, string> = {
  lunar:     'Lunar',
  national:  'National',
  property:  'Property',
  religious: 'Religious',
  seasonal:  'Seasonal',
};

export async function getEvents(rangeStart: string, rangeEnd: string): Promise<CalendarEvent[]> {
  // Pull events overlapping the requested range, plus the type metadata for category.
  const [{ data: rawEvents }, { data: rawTypes }] = await Promise.all([
    supabase
      .schema('marketing')
      .from('calendar_events')
      .select('event_id, type_code, display_name, date_start, date_end, is_confirmed, source_markets, notes')
      .lte('date_start', rangeEnd)
      .gte('date_end',   rangeStart)
      .order('date_start', { ascending: true }),
    supabase
      .schema('marketing')
      .from('calendar_event_types')
      .select('type_code, category, display_name'),
  ]);

  const typeMap = new Map<string, { category: string; display_name: string }>();
  for (const t of (rawTypes ?? []) as Array<{ type_code: string; category: string; display_name: string }>) {
    typeMap.set(t.type_code, { category: t.category, display_name: t.display_name });
  }

  return ((rawEvents ?? []) as Array<{
    event_id: string; type_code: string; display_name: string;
    date_start: string; date_end: string;
    is_confirmed: boolean | null; source_markets: string[] | null; notes: string | null;
  }>).map(r => {
    const meta = typeMap.get(r.type_code);
    const cat  = meta?.category ?? 'national';
    return {
      id:               r.event_id,
      type_code:        r.type_code,
      display_name:     r.display_name,
      date_start:       r.date_start,
      date_end:         r.date_end,
      category:         cat,
      category_display: CATEGORY_DISPLAY[cat] ?? cat,
      is_confirmed:     !!r.is_confirmed,
      source_markets:   r.source_markets ?? [],
      notes:            r.notes,
    };
  });
}

export async function getEventTypes(): Promise<EventTypeOption[]> {
  const { data } = await supabase
    .schema('marketing')
    .from('calendar_event_types')
    .select('type_code, display_name, category')
    .order('display_name', { ascending: true });
  return (data ?? []) as EventTypeOption[];
}

// Derive the unique country list from a set of events. ISO-2 codes mostly,
// plus a few synthetic codes (UNESCO_audience). We surface them as-is.
export function uniqueCountries(events: CalendarEvent[]): string[] {
  const seen = new Set<string>();
  for (const e of events) for (const m of e.source_markets) seen.add(m);
  return Array.from(seen).sort();
}

export function uniqueCategories(events: CalendarEvent[]): string[] {
  const seen = new Set<string>();
  for (const e of events) seen.add(e.category);
  return Array.from(seen).sort();
}
