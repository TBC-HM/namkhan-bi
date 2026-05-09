// app/revenue/parity/_components/ParityGrid.tsx
//
// Lighthouse-style date × OTA-channel grid for The Namkhan, scaffolded
// from the reference screenshot shipped 2026-05-09.
//
// Layout:
//   Column 1  Date pill (today highlighted brass).
//   Cols 2-7  One per OTA channel: Brand.com · Booking.com · Expedia ·
//             Agoda · Hotels.com · Trip.com. Cell shows {OtaBadge} +
//             rate or "Sold out" pill.
//   Col 8     Loss channels via metasearch — comp names that undercut us.
//   Col 9     Lowest rate observed in the row.
//
// Data shape comes from `public.v_parity_grid` (see migration
// `create_v_parity_grid_2026_05_09`). One row per stay_date with one
// numeric column per channel + an array of comp names that priced below
// our BDC rate that day.
//
// Rules followed (locked design system, 2026-05-03):
//   • $ prefix for USD; integer rendering via fmtTableUsd.
//   • Em-dash for empty cells; never "N/A" / "0" / blank.
//   • "Sold out" rendered as <StatusPill className="pill-expired"> per
//     spec. (We use the StatusPill component so a single source-of-truth
//     governs the pill shape.)
//   • Today row tinted brass (NOT orange — orange is OTA brand colour).
//   • All typography sizes flow through CSS variables.

import { OtaBadge } from '@/components/ota/OtaBadge';
import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd, EMPTY } from '@/lib/format';

export type ParityGridRow = {
  stay_date:       string;
  direct_usd:      number | null;
  direct_avail:    boolean | null;
  booking_usd:     number | null;
  booking_avail:   boolean | null;
  expedia_usd:     number | null;
  expedia_avail:   boolean | null;
  agoda_usd:       number | null;
  agoda_avail:     boolean | null;
  hotels_usd:      number | null;
  hotels_avail:    boolean | null;
  trip_usd:        number | null;
  trip_avail:      boolean | null;
  last_shop_date:  string | null;
  loss_channels:   string[] | null;
  comp_lowest_usd: number | null;
};

const CHANNELS: Array<{
  key:    keyof Pick<ParityGridRow, 'direct_usd'|'booking_usd'|'expedia_usd'|'agoda_usd'|'hotels_usd'|'trip_usd'>;
  avail:  keyof Pick<ParityGridRow, 'direct_avail'|'booking_avail'|'expedia_avail'|'agoda_avail'|'hotels_avail'|'trip_avail'>;
  label:  string;
  bookingHref: (stay: string) => string;
}> = [
  { key: 'direct_usd',  avail: 'direct_avail',  label: 'Brand.com',
    bookingHref: (s) => `https://thenamkhan.com/book?date=${s}` },
  { key: 'booking_usd', avail: 'booking_avail', label: 'Booking.com',
    bookingHref: (s) => `https://www.booking.com/searchresults.html?ss=The%20Namkhan&checkin=${s}&group_adults=2&no_rooms=1` },
  { key: 'expedia_usd', avail: 'expedia_avail', label: 'Expedia',
    bookingHref: (s) => `https://www.expedia.com/Hotel-Search?destination=The%20Namkhan&startDate=${s}&adults=2` },
  { key: 'agoda_usd',   avail: 'agoda_avail',   label: 'Agoda',
    bookingHref: (s) => `https://www.agoda.com/search?city=The+Namkhan&checkIn=${s}&adults=2` },
  { key: 'hotels_usd',  avail: 'hotels_avail',  label: 'Hotels.com',
    bookingHref: (s) => `https://www.hotels.com/Hotel-Search?destination=The%20Namkhan&startDate=${s}&adults=2` },
  { key: 'trip_usd',    avail: 'trip_avail',    label: 'Trip.com',
    bookingHref: (s) => `https://www.trip.com/hotels/list?city=The+Namkhan&checkin=${s}&adults=2` },
];

const FLAG = '🇱🇦'; // Laos — Namkhan property location

function todayIso(): string {
  // Local YYYY-MM-DD (NOT toISOString, which is UTC) — matches PBS's
  // expectation that "today" = today in the operator's wall-clock view.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateBadge(iso: string): string {
  // "Sun 16/05" — matches the reference screenshot.
  const d = new Date(iso + 'T00:00:00');
  const dow = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dow} ${dd}/${mm}`;
}

interface Props {
  rows: ParityGridRow[];
}

export default function ParityGrid({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div style={S.empty}>
        No parity data captured yet. Run the agent to populate.
      </div>
    );
  }

  const today = todayIso();

  return (
    <div style={S.scroll}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.thFirst}>Date</th>
            {CHANNELS.map((c) => (
              <th key={c.key} style={S.thNum}>
                <span style={S.thChannel}>
                  <OtaBadge name={c.label} />
                </span>
              </th>
            ))}
            <th style={S.th}>Loss channels via metasearch</th>
            <th style={S.thNum}>Lowest rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isToday = r.stay_date === today;
            const channelVals = CHANNELS.map((c) => Number(r[c.key]) || null);
            const ratesOnly = channelVals.filter((v): v is number => v != null && v > 0);
            const rowLowest = ratesOnly.length ? Math.min(...ratesOnly) : null;
            return (
              <tr key={r.stay_date} style={isToday ? S.todayRow : undefined}>
                <td style={isToday ? S.dateCellToday : S.dateCell}>
                  <span style={S.dateBadge}>{fmtDateBadge(r.stay_date)}</span>
                </td>

                {CHANNELS.map((c) => {
                  const rate = r[c.key] != null ? Number(r[c.key]) : null;
                  const avail = r[c.avail];
                  const soldOut = avail === false;
                  return (
                    <td key={c.key} style={S.tdNum}>
                      {soldOut ? (
                        <StatusPill tone="expired">Sold out</StatusPill>
                      ) : rate != null ? (
                        <a
                          href={c.bookingHref(r.stay_date)}
                          target="_blank"
                          rel="noreferrer"
                          style={S.cellLink}
                          title={`${c.label} · ${r.stay_date} · open in new tab`}
                        >
                          <span style={S.rate}>{fmtTableUsd(rate)}</span>
                          <span style={S.flag}>{FLAG}</span>
                          <span style={S.chev} aria-hidden>↗</span>
                        </a>
                      ) : (
                        <span style={S.dash}>{EMPTY}</span>
                      )}
                    </td>
                  );
                })}

                <td style={S.tdLoss}>
                  {r.loss_channels && r.loss_channels.length > 0 ? (
                    <span style={S.lossText}>
                      {r.loss_channels.slice(0, 4).join(' · ')}
                      {r.loss_channels.length > 4 && ` · +${r.loss_channels.length - 4}`}
                    </span>
                  ) : (
                    <span style={S.dash}>{EMPTY}</span>
                  )}
                </td>

                <td style={S.tdNum}>
                  <span style={S.lowest}>{fmtTableUsd(rowLowest)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--ink-mute)',
    fontFamily: 'var(--sans)',
    fontSize: 'var(--t-md)',
  },
  scroll: { overflowX: 'auto' },
  table: {
    width: '100%',
    minWidth: 1100,
    borderCollapse: 'collapse',
    background: 'var(--paper-warm)',
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    color: 'var(--brass)',
    background: 'var(--paper-deep)',
    borderBottom: '1px solid var(--paper-deep)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  thFirst: {
    textAlign: 'left',
    padding: '12px 14px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    color: 'var(--brass)',
    background: 'var(--paper-deep)',
    borderBottom: '1px solid var(--paper-deep)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    width: 110,
  },
  thNum: {
    textAlign: 'right',
    padding: '12px 14px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    color: 'var(--brass)',
    background: 'var(--paper-deep)',
    borderBottom: '1px solid var(--paper-deep)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  thChannel: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
  },
  todayRow: {
    background: 'rgba(168, 133, 74, 0.10)', // brass tint — not orange
  },
  dateCell: {
    padding: '8px 14px',
    borderBottom: '1px solid var(--paper-deep)',
    color: 'var(--ink)',
    fontSize: 'var(--t-sm)',
    whiteSpace: 'nowrap',
  },
  dateCellToday: {
    padding: '8px 14px',
    borderBottom: '1px solid var(--paper-deep)',
    color: 'var(--ink)',
    fontSize: 'var(--t-sm)',
    whiteSpace: 'nowrap',
  },
  dateBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    background: 'transparent',
    color: 'var(--ink)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-sm)',
    fontWeight: 500,
    letterSpacing: 'var(--ls-loose)',
  },
  tdNum: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--paper-deep)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  tdLoss: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--paper-deep)',
    color: 'var(--ink-soft)',
    fontSize: 'var(--t-xs)',
    fontFamily: 'var(--mono)',
    letterSpacing: 'var(--ls-loose)',
    maxWidth: 320,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  lossText: { color: 'var(--st-bad)' },
  cellLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: 'var(--ink)',
    textDecoration: 'none',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-sm)',
    fontWeight: 500,
  },
  rate: { color: 'var(--ink)' },
  flag: { fontSize: 'var(--t-sm)', lineHeight: 1 },
  chev: { color: 'var(--ink-mute)', fontSize: 'var(--t-xs)' },
  dash: { color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' },
  lowest: {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-sm)',
    fontWeight: 600,
    color: 'var(--ink)',
  },
};
