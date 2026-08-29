// app/h/[property_id]/revenue/reservations/page.tsx
// PBS 2026-08-21 · Reservations subtab under Revenue > Demand & Pace.
//
// v3 (2026-08-21): Cloudbeds-style RESERVATIONS TABLE.
// Replaces the old BookingActivity feed with a proper reservations grid
// mirroring Cloudbeds columns:
//   Reservation ID · First name · Surname · Date Booked · Room#(s) ·
//   Room Type · Check In · Check Out · Nights · Total Price · Status · Source
//
// Data source: public.v_reservations_full (created 2026-08-21) — joins
// v_reservations_unified + pms.reservation_rooms_cb + pms.rooms to attach
// distinct room_name(s) and splits guest_name → first/last.
//
// Filter chip row (URL-driven, ?range=today_yesterday|next7|next30|custom):
//   [Today+Yesterday (default)] [Next 7d] [Next 30d] [Custom range]
// Custom range = ?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD.
// Client-side search box filters by guest name / reservation id.
//
// Tabs strip: REVENUE_SUBPAGES with 'Demand & Pace' active
// (Reservations lives under it — see lib/nav-subgroups).

import React from 'react';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ReservationsTableClient, {
  type ReservationRow,
} from './ReservationsTableClient';
import RangeChips from './RangeChips';
import BookingsTableCB from './BookingsTableCB';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type RangeKey = 'today_yesterday' | 'next7' | 'next30' | 'custom';

function tzForProperty(pid: number): string {
  if (pid === 260955) return 'Asia/Vientiane';
  if (pid === 1000001) return 'Europe/Madrid';
  return 'UTC';
}

// Returns YYYY-MM-DD for `now` in the given IANA timezone (no library needed).
function todayInTz(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function isIsoDate(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function normalizeRange(
  raw: string | undefined,
  from: string | undefined,
  to: string | undefined,
): RangeKey {
  if (raw === 'next7' || raw === 'next30' || raw === 'today_yesterday') return raw;
  if (raw === 'custom' && isIsoDate(from) && isIsoDate(to)) return 'custom';
  return 'today_yesterday';
}

function windowFor(
  range: RangeKey,
  tz: string,
  from: string | undefined,
  to: string | undefined,
): { fromIso: string; toIso: string; label: string } {
  const today = todayInTz(tz);
  switch (range) {
    case 'next7':
      return { fromIso: today, toIso: addDaysIso(today, 7), label: 'Next 7 days' };
    case 'next30':
      return { fromIso: today, toIso: addDaysIso(today, 30), label: 'Next 30 days' };
    case 'custom':
      if (isIsoDate(from) && isIsoDate(to)) {
        return { fromIso: from, toIso: to, label: `${from} → ${to}` };
      }
      // Fallback — shouldn't happen because normalizeRange guards this.
      return { fromIso: today, toIso: today, label: 'Custom range' };
    case 'today_yesterday':
    default: {
      const y = addDaysIso(today, -1);
      return { fromIso: y, toIso: today, label: 'Today + yesterday (arrivals)' };
    }
  }
}

export default async function TenantRevenueReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ property_id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { property_id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const pid = Number(property_id);
  if (!Number.isFinite(pid)) notFound();

  const tz = tzForProperty(pid);

  const spVal = (k: string): string | undefined => {
    const v = sp?.[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const range = normalizeRange(spVal('range'), spVal('from'), spVal('to'));
  const win = windowFor(range, tz, spVal('from'), spVal('to'));
  const activeTab = spVal('tab') === 'bookings' ? 'bookings' : 'arrivals';

  // Currency symbol for the property (for money formatting).
  const { data: prop } = await supabase
    .from('v_property_display')
    .select('display_symbol')
    .eq('property_id', pid)
    .maybeSingle();
  const sym = String((prop as { display_symbol?: string } | null)?.display_symbol ?? '$');

  // Fetch reservations for the window (check_in_date within [fromIso, toIso]).
  // Note: SELECT limit is intentionally generous (5000) — Cloudbeds pages of
  // ~50 are shown at a time; the client component paginates visually.
  const { data, error } = await supabase
    .from('v_reservations_full')
    .select(
      [
        'reservation_id',
        'guest_first_name',
        'guest_last_name',
        'guest_name',
        'booking_date',
        'room_numbers',
        'room_type_name',
        'check_in_date',
        'check_out_date',
        'nights',
        'total_amount',
        'currency',
        'status',
        'is_cancelled',
        'source',
        'source_name',
      ].join(','),
    )
    .eq('property_id', pid)
    .gte('check_in_date', win.fromIso)
    .lte('check_in_date', win.toIso)
    .order('check_in_date', { ascending: false })
    .order('booking_date', { ascending: false })
    .limit(5000);

  const rows: ReservationRow[] = ((data ?? []) as unknown as ReservationRow[]) ?? [];
  const err = error?.message ?? null;

  // Build sub-strip tabs (same pattern as bare /revenue/demand).
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/demand'),
  }));

  const cancelCount = rows.filter((r) => r.is_cancelled).length;
  const liveCount = rows.length - cancelCount;
  const subtitle = 'property_id=' + pid + ' · ' + win.label + ' · ' + rows.length + ' reservations (' + liveCount + ' live · ' + cancelCount + ' cancelled)';

  const basePath = '/h/' + pid + '/revenue/reservations';

  const tabBase = `${basePath}?range=${range}${range === 'custom' ? `&from=${spVal('from') ?? win.fromIso}&to=${spVal('to') ?? win.toIso}` : ''}`;
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 8px', fontSize: 12, fontWeight: active ? 700 : 500,
    color: active ? 'var(--ink, #1B1B1B)' : 'var(--ink-soft, #5A5A5A)',
    borderBottom: active ? '2px solid var(--primary, #1F3A2E)' : '2px solid transparent',
    textDecoration: 'none', background: 'transparent', marginBottom: -1, fontFamily: 'inherit',
  });

  return (
    <DashboardPage
      title="Revenue · Reservations"
      subtitle={subtitle}
      tabs={tabs}
    >
      {/* page-internal tab strip: Arrivals | Bookings */}
      <nav style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, borderBottom: '1px solid var(--hairline, #E6DFCC)', marginBottom: 4 }} role="tablist" aria-label="Reservations view">
        <a href={tabBase} role="tab" aria-selected={activeTab === 'arrivals'} style={tabStyle(activeTab === 'arrivals')}>Arrivals</a>
        <a href={`${basePath}?tab=bookings`} role="tab" aria-selected={activeTab === 'bookings'} style={tabStyle(activeTab === 'bookings')}>Bookings</a>
      </nav>

      {activeTab === 'arrivals' ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container
            title="Arrivals"
            subtitle={win.label}
            density="compact"
            action={
              <RangeChips
                basePath={basePath}
                range={range}
                from={spVal('from') ?? win.fromIso}
                to={spVal('to') ?? win.toIso}
              />
            }
          >
            {err ? (
              <div
                style={{
                  padding: 16,
                  color: 'var(--ink, #1B1B1B)',
                  fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
                  fontSize: 13,
                }}
              >
                Failed to load reservations: {err}
              </div>
            ) : (
              <ReservationsTableClient rows={rows} sym={sym} tz={tz} />
            )}
          </Container>
        </div>
      ) : (
        <div style={{ gridColumn: '1 / -1' }}>
          <BookingsTableCB propertyId={pid} sym={sym} />
        </div>
      )}
    </DashboardPage>
  );
}
