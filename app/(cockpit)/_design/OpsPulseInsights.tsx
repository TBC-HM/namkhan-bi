// app/(cockpit)/_design/OpsPulseInsights.tsx
// PBS 2026-08-21 · 3 containers migrated from Revenue Pulse → Operations HoD.
// Renders:
//   - Upcoming events · next 30 days (MonthCalendar variant="events")
//   - Occupancy · next 30 days (MonthCalendar variant="occ")
//   - Performance · 30d (line chart RevPAR/ADR vs STLY)
// Self-contained server component: fetches its own data via lib/data-pulse.

import Container from './layout/Container';
import { Chart, MonthCalendar, type ChartSeries, type CalendarDay } from './index';
import { getPulseHighOcc, getPulseUpcomingEvents, getPulseDaily } from '@/lib/data-pulse';

interface Props { propertyId: number }

function shiftDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export default async function OpsPulseInsights({ propertyId: pid }: Props) {
  const anchor = new Date().toISOString().slice(0, 10);
  const to30 = shiftDate(anchor, 30);
  const to29 = shiftDate(anchor, 29);
  const from365 = shiftDate(anchor, -365);
  const to365 = shiftDate(from365, 29);

  const [highOcc, events, dailyRows, stlyRows] = await Promise.all([
    getPulseHighOcc(pid, anchor, to30, 0),
    getPulseUpcomingEvents(pid, anchor, to30, 30),
    getPulseDaily(pid, anchor, to29),
    getPulseDaily(pid, from365, to365),
  ]);

  // Build 30-day calendar frame
  const calendarDays: { date: string }[] = [];
  for (let i = 0; i < 30; i++) calendarDays.push({ date: shiftDate(anchor, i) });

  // Events calendar
  const eventsByDay = new Map<string, string[]>();
  for (const e of events ?? []) {
    const k = String((e as { date: string }).date).slice(0, 10);
    const arr = eventsByDay.get(k) ?? [];
    arr.push((e as { name: string }).name);
    eventsByDay.set(k, arr);
  }
  const eventCalendar: CalendarDay[] = calendarDays.map((d) => {
    const evs = eventsByDay.get(d.date) ?? [];
    return {
      date: d.date,
      label: evs.length > 0 ? String(evs.length) : undefined,
      tone: evs.length > 0 ? ('brass' as const) : undefined,
      tooltip: evs.length > 0 ? `${d.date}\n${evs.join('\n')}` : undefined,
    };
  });

  // Occupancy calendar
  const occByDay = new Map<string, number>();
  for (const r of (highOcc ?? []) as Array<{ night_date?: string; date?: string; occupancy_pct?: number }>) {
    occByDay.set(String(r.night_date ?? r.date ?? '').slice(0, 10), Number(r.occupancy_pct ?? 0));
  }
  const occCalendar: CalendarDay[] = calendarDays.map((d) => {
    const pct = occByDay.get(d.date);
    if (pct == null) return { date: d.date };
    const tone: CalendarDay['tone'] = pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red';
    return {
      date: d.date,
      label: `${Math.round(pct)}%`,
      tone,
      tooltip: `${d.date}\nOccupancy: ${pct.toFixed(1)}%`,
    };
  });

  // Performance · 30d chart
  const stlyByDate = new Map<string, { revpar?: number | null; adr?: number | null }>();
  for (const r of stlyRows ?? []) {
    stlyByDate.set(shiftDate((r as { night_date: string }).night_date, 365), r as { revpar?: number | null; adr?: number | null });
  }
  const heroData = (dailyRows ?? []).map((r) => {
    const row = r as { night_date: string; revpar?: number | null; adr?: number | null };
    const stly = stlyByDate.get(row.night_date) ?? {};
    return {
      night_date: row.night_date,
      revpar: row.revpar,
      adr: row.adr,
      stly_revpar: stly.revpar ?? null,
      stly_adr: stly.adr ?? null,
    };
  });
  const heroSeries: ChartSeries[] = [
    { key: 'revpar',      label: 'RevPAR',      color: '#1F3A2E' },
    { key: 'adr',         label: 'ADR',         color: '#B8A878' },
    { key: 'stly_revpar', label: 'STLY RevPAR', color: '#5A5A5A' },
    { key: 'stly_adr',    label: 'STLY ADR',    color: '#A89A78' },
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
      <Container title="Upcoming events · next 30 days" subtitle="hover any day to see events">
        <MonthCalendar days={eventCalendar} variant="events" />
      </Container>
      <Container title="Occupancy · next 30 days" subtitle="hover any day for the OCC %">
        <MonthCalendar days={occCalendar} variant="occ" />
      </Container>
      <Container title="Performance · 30d" subtitle={`${anchor} → ${to29} · RevPAR + ADR vs STLY`}>
        <Chart
          variant="line"
          data={heroData}
          xKey="night_date"
          series={heroSeries}
          height={220}
          empty={{ title: 'No data in window' }}
        />
      </Container>
    </div>
  );
}
