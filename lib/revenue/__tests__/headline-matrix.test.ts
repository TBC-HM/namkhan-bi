// lib/revenue/__tests__/headline-matrix.test.ts
// Pure logic behind the Revenue HoD headline matrix (PBS 2026-08-24).
// The component itself is presentational; everything worth testing lives here:
// label -> row classification (tenant kpiTiles vary per property) and the
// aggregation/derivation math (where the divide-by-zero paths live).

import {
  rowKeyForLabel,
  cellFromTile,
  aggregate,
  deriveKpis,
  fmtSlyPct,
  fmtSlyMoney,
  fmtSlyRn,
  type DailyRow,
} from '../headline-matrix';

describe('rowKeyForLabel', () => {
  it('maps the today stripe labels', () => {
    expect(rowKeyForLabel('OCC')).toBe('occ');
    expect(rowKeyForLabel('ADR')).toBe('adr');
    expect(rowKeyForLabel('RevPAR')).toBe('revpar');
    expect(rowKeyForLabel('Revenue tonight')).toBe('roomsRev');
    expect(rowKeyForLabel('New bookings today · room nights')).toBe('newBookings');
    expect(rowKeyForLabel('Cancellations today · room nights')).toBe('cancellations');
    expect(rowKeyForLabel('Pickup today · net RN')).toBe('pickup');
  });

  it('maps the yesterday stripe labels to the same rows', () => {
    expect(rowKeyForLabel('Revenue yesterday')).toBe('roomsRev');
    expect(rowKeyForLabel('New bookings yesterday · room nights')).toBe('newBookings');
    expect(rowKeyForLabel('Cancellations yesterday · room nights')).toBe('cancellations');
    expect(rowKeyForLabel('Pickup yesterday · net RN')).toBe('pickup');
  });

  it('maps the MTD/YTD suffixed labels', () => {
    expect(rowKeyForLabel('OCC · MTD')).toBe('occ');
    expect(rowKeyForLabel('ADR · YTD')).toBe('adr');
    expect(rowKeyForLabel('RevPAR · MTD')).toBe('revpar');
    expect(rowKeyForLabel('Rooms revenue · YTD')).toBe('roomsRev');
    expect(rowKeyForLabel('Nights actualized')).toBe('nights');
  });

  it('does not confuse total revenue with rooms revenue', () => {
    // Both contain "revenue" — total must win, or MTD total lands in the rooms row.
    expect(rowKeyForLabel('Total revenue · MTD')).toBe('totalRev');
    expect(rowKeyForLabel('Rooms revenue · MTD')).toBe('roomsRev');
  });

  it('flags PACE separately — it is forward-looking, not a period column', () => {
    expect(rowKeyForLabel('PACE · next 30d')).toBe('pace');
  });

  it('is case-insensitive and tolerates whitespace', () => {
    expect(rowKeyForLabel('  occ  ')).toBe('occ');
    expect(rowKeyForLabel('revpar · mtd')).toBe('revpar');
  });

  it('returns null for labels it does not know, so callers can render them anyway', () => {
    // cfg.kpiTiles is per-tenant config; Donna may ship a metric Namkhan lacks.
    // Unknown must be null (=> extra row), never silently dropped.
    expect(rowKeyForLabel('GOPPAR')).toBeNull();
    expect(rowKeyForLabel('')).toBeNull();
  });
});

describe('cellFromTile', () => {
  it('carries value, LY pill, status and footnote across', () => {
    expect(cellFromTile({
      label: 'ADR', value: '$124', size: 'sm',
      footnote: 'today · in-house · net', status: 'green', stly: 'LY $71',
    })).toEqual({
      value: '$124', ly: 'LY $71', status: 'green', footnote: 'today · in-house · net',
    });
  });

  it('stringifies numeric values', () => {
    expect(cellFromTile({ label: 'Nights actualized', value: 24 }).value).toBe('24');
  });

  it('omits an absent LY pill rather than emitting an empty one', () => {
    const c = cellFromTile({ label: 'OCC', value: '33.3%' });
    expect(c.ly).toBeUndefined();
  });
});

describe('aggregate', () => {
  const rows: DailyRow[] = [
    { night_date: '2026-08-01', rooms_available: 30, rooms_sold: 10, rooms_revenue: '1210', total_revenue: '1500' },
    { night_date: '2026-08-02', rooms_available: 30, rooms_sold: 12, rooms_revenue: 1452, total_revenue: 1800 },
  ];

  it('sums across rows and coerces string numerics from PostgREST', () => {
    expect(aggregate(rows)).toEqual({ avail: 60, sold: 22, roomsRev: 2662, totalRev: 3300, nights: 2 });
  });

  it('treats nulls as zero but still counts the night', () => {
    expect(aggregate([{ night_date: '2026-08-03', rooms_available: null, rooms_sold: null, rooms_revenue: null, total_revenue: null }]))
      .toEqual({ avail: 0, sold: 0, roomsRev: 0, totalRev: 0, nights: 1 });
  });

  it('returns a zeroed aggregate for no rows', () => {
    expect(aggregate([])).toEqual({ avail: 0, sold: 0, roomsRev: 0, totalRev: 0, nights: 0 });
  });
});

describe('deriveKpis', () => {
  const TAX = 1.21;

  it('derives occ/adr/revpar net of tax + service', () => {
    const k = deriveKpis({ avail: 720, sold: 214, roomsRev: 34467, totalRev: 45916, nights: 24 }, TAX);
    expect(k.occ).toBeCloseTo(29.72, 2);
    expect(Math.round(k.adr)).toBe(133);
    expect(Math.round(k.revpar)).toBe(40);
    expect(Math.round(k.netRoomsRev)).toBe(28485);
    expect(Math.round(k.netTotalRev)).toBe(37947);
  });

  it('returns zero rather than Infinity when nothing is available', () => {
    const k = deriveKpis({ avail: 0, sold: 0, roomsRev: 0, totalRev: 0, nights: 0 }, TAX);
    expect(k.occ).toBe(0);
    expect(k.revpar).toBe(0);
  });

  it('returns zero ADR when no rooms were sold', () => {
    // avail > 0 but sold = 0 — a closed hotel. ADR must not divide by zero.
    expect(deriveKpis({ avail: 30, sold: 0, roomsRev: 0, totalRev: 0, nights: 1 }, TAX).adr).toBe(0);
  });
});

describe('LY pill formatters', () => {
  it('formats a percentage to one decimal', () => {
    expect(fmtSlyPct(16.666)).toBe('LY 16.7%');
  });

  it('formats money net of last-year tax, with thousands separators', () => {
    expect(fmtSlyMoney(15441, '$', 1.21)).toBe('LY $12,761');
  });

  it('divides by 1 when the value is already net', () => {
    expect(fmtSlyMoney(71, '$', 1)).toBe('LY $71');
  });

  it('honours the property currency symbol', () => {
    expect(fmtSlyMoney(1000, '€', 1)).toBe('LY €1,000');
  });

  it('emits no pill for absent, empty or non-positive money', () => {
    // Matches the existing stripe behaviour: a zero LY is noise, not signal.
    expect(fmtSlyMoney(null, '$', 1.21)).toBeUndefined();
    expect(fmtSlyMoney(undefined, '$', 1.21)).toBeUndefined();
    expect(fmtSlyMoney('', '$', 1.21)).toBeUndefined();
    expect(fmtSlyMoney(0, '$', 1.21)).toBeUndefined();
    expect(fmtSlyMoney(-5, '$', 1.21)).toBeUndefined();
  });

  it('emits no pill for a non-numeric percentage', () => {
    expect(fmtSlyPct(null)).toBeUndefined();
    expect(fmtSlyPct('abc')).toBeUndefined();
  });

  it('formats room nights, keeping a real zero because 0 RN is signal', () => {
    // Distinct from money: "LY 0 RN" tells the manager last year also booked nothing.
    expect(fmtSlyRn(0)).toBe('LY 0 RN');
    expect(fmtSlyRn(12)).toBe('LY 12 RN');
    expect(fmtSlyRn(null)).toBeUndefined();
  });
});
