// lib/fb/__tests__/capture.test.ts
// PBS 2026-08-26 · Restaurant Pass capture logic.
// The traps here are all shape, not arithmetic: future stay months read 0%
// because the stay has not happened, staff meals post exactly like guest
// checks, and capture-by-reservation is a different number from the legacy
// capture-by-reservation-day. Each gets a test.

import {
  captureTrend,
  neverSpentBySource,
  splitStaff,
  captureSummary,
  type CaptureRow,
  type SpendRow,
} from '../capture';

const trend: CaptureRow[] = [
  { stay_month: '2026-06-01', reservations: 35, reservations_with_fb: 30, capture_pct: 85.7, room_nights: 112, room_nights_no_fb: 9,  fb_spend: 4938 },
  { stay_month: '2026-07-01', reservations: 94, reservations_with_fb: 69, capture_pct: 73.4, room_nights: 246, room_nights_no_fb: 44, fb_spend: 9192 },
  { stay_month: '2026-08-01', reservations: 77, reservations_with_fb: 46, capture_pct: 59.7, room_nights: 229, room_nights_no_fb: 77, fb_spend: 7212 },
  // Stays that have not happened yet — every one of these reads 0% capture.
  { stay_month: '2026-09-01', reservations: 28, reservations_with_fb: 0, capture_pct: 0, room_nights: 76, room_nights_no_fb: 76, fb_spend: 0 },
  { stay_month: '2026-10-01', reservations: 32, reservations_with_fb: 0, capture_pct: 0, room_nights: 95, room_nights_no_fb: 95, fb_spend: 0 },
];

describe('captureTrend', () => {
  it('drops future stay months so the line does not fall off a cliff', () => {
    // Sep and Oct are forward bookings. Charting their 0% would read as a
    // collapse in capture rather than "these guests have not arrived".
    const out = captureTrend(trend, '2026-08-26');
    expect(out.map(r => r.month)).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
  });

  it('keeps the current month — it is partially real', () => {
    expect(captureTrend(trend, '2026-08-26').at(-1)?.month).toBe('2026-08-01');
  });

  it('labels months for the axis', () => {
    expect(captureTrend(trend, '2026-08-26').map(r => r.label)).toEqual(['Jun', 'Jul', 'Aug']);
  });

  it('carries capture and the no-F&B night count through', () => {
    const aug = captureTrend(trend, '2026-08-26').at(-1)!;
    expect(aug.capturePct).toBe(59.7);
    expect(aug.roomNightsNoFb).toBe(77);
  });

  it('returns an empty series rather than throwing on no rows', () => {
    expect(captureTrend([], '2026-08-26')).toEqual([]);
  });

  it('sorts by month even when the source rows are unordered', () => {
    const shuffled = [trend[2], trend[0], trend[1]];
    expect(captureTrend(shuffled, '2026-08-26').map(r => r.label)).toEqual(['Jun', 'Jul', 'Aug']);
  });
});

const spend: SpendRow[] = [
  { source_name: 'Booking.com',  is_staff: false, has_fb_spend: true,  fb_spend: 4910, nights: 3 },
  { source_name: 'Booking.com',  is_staff: false, has_fb_spend: false, fb_spend: 0,    nights: 3 },
  { source_name: 'Booking.com',  is_staff: false, has_fb_spend: false, fb_spend: 0,    nights: 2 },
  { source_name: 'Expedia',      is_staff: false, has_fb_spend: true,  fb_spend: 585,  nights: 2 },
  { source_name: 'Expedia',      is_staff: false, has_fb_spend: false, fb_spend: 0,    nights: 4 },
  { source_name: 'Staff Usage',  is_staff: true,  has_fb_spend: true,  fb_spend: 74,   nights: 1 },
];

describe('neverSpentBySource', () => {
  it('counts reservations and lost room nights per source', () => {
    const out = neverSpentBySource(spend);
    const bdc = out.find(r => r.source === 'Booking.com')!;
    expect(bdc.neverSpent).toBe(2);
    expect(bdc.roomNightsLost).toBe(5);
    expect(bdc.didSpend).toBe(1);
  });

  it('computes capture per source', () => {
    // Booking.com: 1 of 3 spent
    expect(neverSpentBySource(spend).find(r => r.source === 'Booking.com')!.capturePct).toBe(33);
  });

  it('excludes staff usage entirely — it is not a guest opportunity', () => {
    expect(neverSpentBySource(spend).some(r => r.source === 'Staff Usage')).toBe(false);
  });

  it('orders by lost room nights, because that is the size of the prize', () => {
    // Booking.com lost 5 nights, Expedia 4.
    expect(neverSpentBySource(spend).map(r => r.source)).toEqual(['Booking.com', 'Expedia']);
  });

  it('omits sources where everyone spent', () => {
    expect(neverSpentBySource([
      { source_name: 'Walk-In', is_staff: false, has_fb_spend: true, fb_spend: 137, nights: 1 },
    ])).toEqual([]);
  });
});

describe('splitStaff', () => {
  it('separates guest revenue from staff meals', () => {
    const s = splitStaff(spend);
    expect(s.guestSpend).toBe(5495);
    expect(s.staffSpend).toBe(74);
  });

  it('reports the staff share so the page can say whether it matters', () => {
    // 74 / 5569 = 1.3%
    expect(splitStaff(spend).staffSharePct).toBe(1.3);
  });

  it('does not divide by zero on an empty day', () => {
    expect(splitStaff([])).toEqual({ guestSpend: 0, staffSpend: 0, staffSharePct: 0 });
  });
});

describe('captureSummary', () => {
  it('summarises guest reservations only', () => {
    const s = captureSummary(spend);
    expect(s.reservations).toBe(5);
    expect(s.withSpend).toBe(2);
    expect(s.neverSpent).toBe(3);
    expect(s.capturePct).toBe(40);
  });

  it('totals the room nights that bought nothing', () => {
    expect(captureSummary(spend).roomNightsLost).toBe(9);
  });

  it('values the opportunity at the observed spend per capturing reservation', () => {
    // guest spend 5495 / 2 capturing = 2747.5 per res; 3 never spent -> 8243 (rounded)
    expect(captureSummary(spend).opportunity).toBe(8243);
  });

  it('returns zeros rather than NaN when nobody has stayed', () => {
    expect(captureSummary([])).toEqual({
      reservations: 0, withSpend: 0, neverSpent: 0,
      capturePct: 0, roomNightsLost: 0, opportunity: 0,
    });
  });
});
