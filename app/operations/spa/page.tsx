// app/operations/spa/page.tsx
// PBS 2026-08-30 · The Spa manager cockpit.
//
// The previous Overview opened on a USALI rollup and a QuickBooks GL breakdown
// scoped to Q1 — a controller's view, and one a spa manager never opened. It is
// not deleted: every container moved verbatim into _cockpit/LegacySpaView and
// now renders behind the Ledger tab.
//
// TWO RULES CARRIED OVER FROM THE F&B REBUILD:
//  1. SpaSubnav is ALWAYS the first thing in the column. The module's own
//     navigation is never pushed down the page by anything added here.
//  2. Spa keeps its real sub-routes (schedule, catalogue, passes, delivery).
//     F&B uses ?tab= because it had no sub-routes to lose; converting Spa would
//     have broken five live URLs for cosmetic symmetry.

import { DashboardPage, Container, KpiTile, type DashboardTab } from '@/app/(cockpit)/_design';
import MetricMatrix, { type MatrixRow, type MatrixTone } from '@/app/(cockpit)/_design/MetricMatrix';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import SpaSubnav from './_shared/SpaSubnav';
import {
  getSpaKpiMatrix, getSpaCaptureTrend, getSpaDiaryGap, getSpaTreatments, getSpaCapacity,
  addDays, SPA_PERIOD_COLS, type SpaPeriodKey,
} from './_cockpit/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams?: Record<string, string | string[] | undefined>;
  /** Supplied by the /h wrapper. The unprefixed route IS Namkhan (L6). */
  propertyId?: number;
}

const TZ: Record<number, string> = { 1000001: 'Europe/Madrid' };
const todayIn = (tz: string) => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '01';
  return `${g('year')}-${g('month')}-${g('day')}`;
};

export default async function SpaCockpitPage({ propertyId }: Props) {
  const pid = propertyId ?? NAMKHAN_PROPERTY_ID;
  const sym = pid === 1000001 ? '€' : '$';
  const money = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;
  const today = todayIn(TZ[pid] ?? 'Asia/Vientiane');
  const yearAgo = addDays(today, -365);

  const [kpi, capture, diary, menu, cap] = await Promise.all([
    getSpaKpiMatrix(pid, today),
    getSpaCaptureTrend(pid, 13),
    getSpaDiaryGap(pid, `${Number(today.slice(0, 4)) - 1}-01-01`),
    getSpaTreatments(pid, yearAgo, today),
    getSpaCapacity(pid),
  ]);

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/spa'),
  })) as DashboardTab[];

  const lyLine = (ty: number, ly: number, fmt: (n: number) => string): string =>
    ly <= 0 ? 'LY —' : `LY ${fmt(ly)}  ${ty >= ly ? '+' : ''}${Math.round(((ty - ly) / ly) * 100)}%`;

  const row = (
    key: string, label: string, unit: string,
    pick: (s: (typeof kpi)[SpaPeriodKey]['ty']) => number | null,
    fmt: (n: number) => string,
  ): MatrixRow => ({
    key, label, unit,
    cells: Object.fromEntries(SPA_PERIOD_COLS.map((c) => {
      const ty = pick(kpi[c.key].ty);
      const ly = pick(kpi[c.key].ly);
      if (ty == null) return [c.key, undefined];
      return [c.key, {
        value: fmt(ty),
        sub: lyLine(ty, ly ?? 0, fmt),
        tone: ly && ly > 0 ? (ty >= ly ? 'pos' : 'neg') : undefined,
      }];
    })),
  });

  const kpiRows: MatrixRow[] = [
    row('rev',    'Spa revenue',   'charged to folios',        (s) => s.revenue,    money),
    row('treat',  'Treatments',    'lines posted',             (s) => s.treatments, (n) => String(n)),
    row('guests', 'Guests treated','distinct reservations',    (s) => s.guests,     (n) => String(n)),
    row('avg',    'Average ticket','revenue ÷ treatments',     (s) => s.avgTicket,  money),
  ];

  // ── Capture trend ────────────────────────────────────────────────────────
  const pct = (ty: number | null, ly: number | null): { txt: string; tone: MatrixTone } | null => {
    if (ty == null || ly == null || ly === 0) return null;
    const d = ((ty - ly) / Math.abs(ly)) * 100;
    return { txt: `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`, tone: d >= 3 ? 'pos' : d <= -3 ? 'neg' : 'mute' };
  };
  const capRows: MatrixRow[] = capture.map((r) => {
    const dRev = pct(r.revenue, r.lyRevenue);
    const dPor = pct(r.por, r.lyPor);
    const dCap = r.capturePct != null && r.lyCapturePct != null ? r.capturePct - r.lyCapturePct : null;
    return {
      key: r.month, label: r.month,
      cells: {
        rev: { value: money(r.revenue), sub: dRev ? `LY ${money(r.lyRevenue ?? 0)} · ${dRev.txt}` : 'no LY', tone: dRev?.tone },
        occ: { value: String(r.occ), tone: 'mute', sub: 'rooms occupied' },
        por: r.por == null ? undefined : {
          value: `${sym}${r.por.toFixed(2)}`,
          sub: dPor ? `LY ${sym}${(r.lyPor ?? 0).toFixed(2)} · ${dPor.txt}` : 'no LY',
          tone: dPor?.tone,
          title: 'Spa revenue ÷ occupied rooms',
        },
        cap: r.capturePct == null ? undefined : {
          value: `${r.capturePct.toFixed(1)}%`,
          sub: dCap == null ? 'no LY' : `LY ${(r.lyCapturePct ?? 0).toFixed(1)}% · ${dCap >= 0 ? '+' : ''}${dCap.toFixed(1)}pt`,
          tone: dCap == null ? undefined : dCap >= 1 ? 'pos' : dCap <= -1 ? 'neg' : 'mute',
          bar: r.capturePct,
        },
      },
    };
  });
  const best = capture.reduce<typeof capture[number] | null>(
    (b, r) => (r.capturePct != null && (!b || (b.capturePct ?? 0) < r.capturePct) ? r : b), null);
  const now = capture[capture.length - 1];

  // ── Diary gap ────────────────────────────────────────────────────────────
  const diaryRows: MatrixRow[] = diary.months.filter((m) => m.charged > 0 || m.booked > 0).map((m) => ({
    key: m.month, label: m.month,
    cells: {
      charged: { value: String(m.charged), sub: money(m.revenue) },
      booked:  { value: String(m.booked), tone: m.booked === 0 ? 'neg' : 'warn',
                 sub: m.booked === 0 ? 'diary empty' : 'in the diary' },
      posted:  { value: String(m.postedToFolio),
                 tone: m.booked > 0 && m.postedToFolio === 0 ? 'neg' : 'mute',
                 sub: 'reached a folio' },
    },
  }));

  // ── Menu ─────────────────────────────────────────────────────────────────
  const menuTop = menu.slice(0, 14);
  const offCard = menu.filter((m) => m.listPrice != null
    && Math.abs(m.achieved - m.listPrice) / m.listPrice > 0.05).length;

  return (
    <DashboardPage
      title="Spa"
      subtitle="Operations · Spa · wellness treatments"
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* The module's own strip is ALWAYS first. Nothing pushes it down. */}
        <SpaSubnav active="overview" />

        <Container
          title="Today · every KPI, every timeframe"
          subtitle="LY on each cell is the same window one year earlier · charged to Cloudbeds folios, which is the only complete record of what the spa actually did"
          density="compact"
        >
          <MetricMatrix
            caption="Spa revenue, treatments, guests treated and average ticket across today, yesterday, 7 and 30 days and year to date, each against last year."
            columns={SPA_PERIOD_COLS.map((c) => ({ key: c.key, label: c.label, sub: c.sub }))}
            rows={kpiRows} labelWidth={168} minWidth={640}
          />
        </Container>

        <Container
          title="The diary is not being used"
          subtitle="Treatments charged to guests, against treatments recorded in the booking module"
          density="compact"
        >
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <KpiTile size="sm" label="Treatments charged" value={String(diary.totalCharged)}
              unit={`across ${diary.monthsTrading} months`} footnote="from the folio — real trade" />
            <KpiTile size="sm" label="Bookings recorded" value={String(diary.totalBooked)}
              unit="in the diary, ever" footnote={diary.lastBooking ? `last one ${diary.lastBooking}` : 'none'} />
            <KpiTile size="sm" label="Bookings that reached a folio" value={String(diary.totalPosted)}
              unit="of those bookings" footnote="posted_to_folio = true" />
            <KpiTile size="sm" label="Therapists · rooms" value={`${cap.therapists} · ${cap.rooms}`}
              unit="active" footnote={`${cap.cardTreatments} treatments on the card`} />
          </div>
          {diaryRows.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <MetricMatrix
                caption="Treatments charged to folios each month against bookings recorded in the spa module."
                columns={[
                  { key: 'charged', label: 'Charged', sub: 'really happened' },
                  { key: 'booked',  label: 'Booked',  sub: 'in the diary' },
                  { key: 'posted',  label: 'Posted',  sub: 'diary → folio' },
                ]}
                rows={diaryRows} minWidth={520} labelWidth={92}
              />
            </div>
          )}
          <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
            This is first on the page because it changes how everything under it should be
            read. The folio shows {diary.monthsTrading} unbroken months of spa trade; the
            booking module holds {diary.totalBooked} record{diary.totalBooked === 1 ? '' : 's'} in
            total{diary.lastBooking ? `, the most recent scheduled ${diary.lastBooking}` : ''}, and{' '}
            {diary.totalPosted === 0 ? 'not one of them ever reached a folio' : `only ${diary.totalPosted} reached a folio`}.
            The diary and the spa are two separate universes. So the Schedule tab is not the
            real diary, no therapist or room utilisation can be calculated — the numbers to do
            it with do not exist — and anyone reading the booking count as the workload is out
            by more than an order of magnitude. Everything on this page is therefore sourced
            from the folio, not from bookings. Fixing this is an operations decision about
            whether the module gets used, not a reporting change.
          </p>
        </Container>

        <Container
          title="Capture is the whole opportunity"
          subtitle="Spa revenue per occupied room, and the share of occupied rooms that bought any treatment. Same bridge as the F&B cockpit, so the two departments are measured identically."
          density="compact"
        >
          {capRows.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>No capture data for this property yet.</p>
          ) : (
            <MetricMatrix
              caption="Monthly spa revenue, occupied rooms, revenue per occupied room and capture rate, each against last year."
              columns={[
                { key: 'rev', label: 'Spa revenue', sub: 'vs last year' },
                { key: 'occ', label: 'Occupied rooms' },
                { key: 'por', label: 'Per occupied room', sub: 'the real number' },
                { key: 'cap', label: 'Capture %', sub: 'rooms that bought' },
              ]}
              rows={capRows} minWidth={640} labelWidth={78}
            />
          )}
          {best && now && (
            <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
              The spa&rsquo;s best month in this window captured{' '}
              {(best.capturePct ?? 0).toFixed(1)}% of occupied rooms at {sym}{(best.por ?? 0).toFixed(2)} a
              room ({best.month}); the latest is {(now.capturePct ?? 0).toFixed(1)}% at{' '}
              {sym}{(now.por ?? 0).toFixed(2)} ({now.month}). Read that against F&amp;B, which
              captures four in five of the same guests: the people are in the building and
              already spending. Each point of capture on {now.occ} occupied rooms is roughly{' '}
              {Math.max(1, Math.round(now.occ / 100))} more treatment
              {Math.round(now.occ / 100) === 1 ? '' : 's'} a month — which is why this is a
              front-desk and in-room-offer question long before it is a pricing one.
            </p>
          )}
        </Container>

        <Container
          title="What sells, and whether the card agrees"
          subtitle="Last 12 months · achieved price is what the folio actually took, list price is what the treatment card says"
          density="compact"
        >
          {menuTop.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>No treatments sold in the window.</p>
          ) : (
            <MetricMatrix
              caption="Treatments sold in the last 12 months with revenue, units, achieved price, card price and last sale date."
              columns={[
                { key: 'rev',   label: 'Revenue' },
                { key: 'sold',  label: 'Sold' },
                { key: 'ach',   label: 'Achieved', sub: 'per treatment' },
                { key: 'list',  label: 'On the card' },
                { key: 'last',  label: 'Last sold' },
              ]}
              rows={menuTop.map((m) => {
                const gap = m.listPrice != null && m.listPrice > 0
                  ? ((m.achieved - m.listPrice) / m.listPrice) * 100 : null;
                return {
                  key: m.name, label: m.name,
                  cells: {
                    rev:  { value: money(m.revenue) },
                    sold: { value: String(m.sold), tone: 'mute' },
                    ach:  { value: `${sym}${m.achieved.toFixed(2)}` },
                    list: m.listPrice == null
                      ? { value: '—', tone: 'warn', title: 'No treatment on the card matches this description' }
                      : { value: `${sym}${m.listPrice.toFixed(0)}`,
                          sub: gap == null ? undefined : `${gap >= 0 ? '+' : ''}${gap.toFixed(0)}% achieved`,
                          tone: gap != null && Math.abs(gap) > 5 ? 'warn' : 'mute' },
                    last: { value: m.lastSold ?? '—', tone: 'mute' },
                  },
                };
              })}
              minWidth={620} labelWidth={230}
            />
          )}
          <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
            {offCard > 0 && (
              <>
                <strong>{offCard} treatment{offCard === 1 ? '' : 's'} sell for more than 5% away from
                the carded price.</strong>{' '}
              </>
            )}
            Either the card is stale or the folio price carries tax and service the card
            excludes — worth settling, because the card is what the guest is shown. A dash in
            the card column means no treatment on the card matches that description at all:
            the POS free-texts its descriptions, so the same treatment appears as
            &ldquo;Aroma of Laos&rdquo;, &ldquo;Aroma of Laos (M) (60 min)&rdquo; and
            &ldquo;Aroma of Laos (M) (90 min)&rdquo;, and sizes get sold that were never carded.
            Matching here is by normalised name and is a guide, not an audit. The booking
            module also reads a different, smaller treatment list than this card — the
            Namkhan Signature Ritual, third by revenue, is missing from it — but that list
            lives in a schema the page cannot read, so it is reported here rather than shown.
          </p>
        </Container>
      </div>
    </DashboardPage>
  );
}
