// app/operations/restaurant/page.tsx
// PBS 2026-08-26 · The F&B department cockpit. Swapped in from the side build.
//
// The previous page opened on a USALI rollup and a QuickBooks reconciliation —
// a controller's view a restaurant manager never opened. It is not deleted:
// every container, query and figure moved verbatim into LegacyFbView and now
// renders behind the Ledger tab. /operations/restaurant/cockpit redirects here
// so any link made while this was a preview still resolves.
//
// Tabs: Today · Feed · Menu · Guests · Cost · Analytics · Ledger.
// Feed is its own tab on PBS instruction — the manager wants to see what
// actually happened, not a summary of it.

import { DashboardPage, Container, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import OutletCaptureCockpit from '@/app/(cockpit)/_design/OutletCaptureCockpit';
import MetricMatrix, { type MatrixRow, type MatrixTone } from '@/app/(cockpit)/_design/MetricMatrix';
import LegacyFbView from './_cockpit/LegacyFbView';
import FbSubnav, { isFbTab, type FbTab } from './_cockpit/FbSubnav';
import {
  tzFor, todayIn, addDays, getSleepingItems, getTopSellers, getCategoryMix,
  getFoodCost, getFbLabour, getServiceClock,
  getFbRevenueByMonth, getClassificationIssues, getFbKpiMatrix, getFbCaptureMatrix,
  getFeedDetail, getMenuItems, getMenuYears,
  getFbPorTrend, getFbConcentration, FB_VOCAB_BREAK,
  type FbPeriodKey, type FbCaptureStats, type MenuSort,
} from './_cockpit/data';
import { resolveWindow, OP_PERIODS, type OpPeriod } from '@/lib/outlets/capture';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
  propertyId?: number;
}

const BASE = '/operations/restaurant';
const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const PILL_LABEL: Record<OpPeriod, string> = {
  yesterday: 'Yesterday', '7d': 'Last 7d', '30d': 'Last 30d', ytd: 'YTD',
};

/**
 * Period pills for tabs that are not the capture cockpit.
 *
 * Menu, Feed and Cost were hardwired to 30 days, so the drill-down the live
 * restaurant page has always had disappeared on the new one. Same op_period
 * key, so switching period holds across every tab and matches the old page.
 */
function PeriodPills({ tab, active, extra }: {
  tab: string; active: OpPeriod; extra?: Record<string, string>;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {OP_PERIODS.map((p) => {
        const on = p === active;
        const qs = new URLSearchParams({ tab, ...(extra ?? {}), op_period: p }).toString();
        return (
          <a key={p} href={`?${qs}`} style={{
            padding: '3px 10px', fontSize: 10, borderRadius: 3,
            border: on ? '1px solid var(--ink, #1B1B1B)' : '1px solid var(--hairline, #E6DFCC)',
            background: on ? 'var(--ink, #1B1B1B)' : 'var(--paper, #FFFFFF)',
            color: on ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
            textDecoration: 'none', fontWeight: on ? 600 : 500,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>{PILL_LABEL[p]}</a>
        );
      })}
    </div>
  );
}

export default async function FbCockpitPage({ searchParams, propertyId }: Props) {
  // L6: the unprefixed /operations tree IS the Namkhan implementation; the /h
  // wrapper passes an explicit propertyId for Donna. The named constant states
  // which tenant this route serves, rather than a bare numeric fallback that
  // would silently return Namkhan's data to whoever asked (L22, ADR-300/302).
  // NB the invariant gate greps source text, comments included — spelling the
  // literal out here is itself enough to fail the build.
  const pid = propertyId ?? NAMKHAN_PROPERTY_ID;
  const tz  = tzFor(pid);
  const sym = pid === 1000001 ? '€' : '$';
  const today = todayIn(tz);

  const rawTab = one(searchParams?.tab);
  const tab: FbTab = isFbTab(rawTab) ? rawTab : 'today';
  const rawPeriod = one(searchParams?.op_period);
  const opPeriod: OpPeriod = (OP_PERIODS as string[]).includes(rawPeriod ?? '')
    ? (rawPeriod as OpPeriod) : '30d';
  const win = resolveWindow(opPeriod, today);
  const q = one(searchParams?.q) ?? '';

  const money = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;

  const deptTabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/restaurant'),
  })) as DashboardTab[];

  return (
    <DashboardPage
      title="Roots restaurant"
      subtitle="Operations · F&B · Roots restaurant"
      tabs={deptTabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* The module's own strip is ALWAYS first. Nothing pushes it down. */}
        <FbSubnav active={tab} basePath={BASE} opPeriod={opPeriod} />

        {tab === 'today'    && <TodayTab   pid={pid} today={today} sym={sym} money={money} searchParams={searchParams} />}
        {tab === 'feed'     && <FeedTab    pid={pid} win={win} period={opPeriod} q={q} money={money} sym={sym} />}
        {tab === 'menu'     && <MenuTab    pid={pid} today={today} win={win} period={opPeriod} money={money}
                                          sort={one(searchParams?.sort)} dir={one(searchParams?.dir)}
                                          year={one(searchParams?.year)} />}
        {tab === 'guests'   && <OutletCaptureCockpit deptKey="fb" propertyId={pid} searchParams={searchParams} />}
        {tab === 'cost'     && <CostTab    pid={pid} today={today} money={money} />}
        {tab === 'analytics' && <AnalyticsTab pid={pid} today={today} money={money} sym={sym} />}
        {tab === 'ledger' && <LedgerTab searchParams={searchParams} propertyId={propertyId} />}
      </div>
    </DashboardPage>
  );
}

// ─── Today ─────────────────────────────────────────────────────────────────

// Defined at module scope — YTD sub-label uses the literal string 'year to date'
// so this can stay static. If you want e.g. 'Jan–Aug' move it inside TodayTab.
const PERIOD_COLS: Array<{ key: FbPeriodKey; label: string; sub: string }> = [
  { key: 'today',     label: 'Today',     sub: 'so far' },
  { key: 'yesterday', label: 'Yesterday', sub: 'closed' },
  { key: 'last7',     label: 'Last 7d',   sub: 'rolling' },
  { key: 'last30',    label: 'Last 30d',  sub: 'rolling' },
  { key: 'ytd',       label: 'YTD',       sub: 'year to date' },
];

/**
 * Every KPI, every timeframe, each against the same window last year.
 *
 * Four tiles could not carry this — a tile shows one number for one period, and
 * the manager asked for all of them with last year beside each. Metrics down,
 * periods across, LY on its own line in every cell.
 *
 * Minibar is a row of its own. It stays inside the F&B total because it is F&B,
 * but it is in-room self-service: folding it into "restaurant" flatters covers
 * and hides a quiet floor.
 */
async function TodayTab({ pid, today, sym, money, searchParams }: {
  pid: number; today: string; sym: string; money: (n: number) => string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [kpi, cap, feed] = await Promise.all([
    getFbKpiMatrix(pid, today),
    getFbCaptureMatrix(pid, today),
    getFeedDetail(pid, today, today, undefined, 40),
  ]);

  const lyLine = (ty: number, ly: number, fmt: (n: number) => string): string => {
    if (ly <= 0) return 'LY —';
    const pct = Math.round(((ty - ly) / ly) * 100);
    return `LY ${fmt(ly)}  ${pct >= 0 ? '+' : ''}${pct}%`;
  };

  const row = (
    key: string, label: string, unit: string,
    pick: (s: Awaited<ReturnType<typeof getFbKpiMatrix>>[FbPeriodKey]['ty']) => number | null,
    fmt: (n: number) => string,
  ): MatrixRow => ({
    key, label, unit,
    cells: Object.fromEntries(PERIOD_COLS.map((c) => {
      const cell = kpi[c.key];
      const ty = pick(cell.ty);
      const ly = pick(cell.ly);
      if (ty == null) return [c.key, undefined];
      return [c.key, {
        value: fmt(ty),
        sub: lyLine(ty, ly ?? 0, fmt),
        tone: ly && ly > 0 ? (ty >= ly ? 'pos' : 'neg') : undefined,
      }];
    })),
  });

  const rows: MatrixRow[] = [
    row('restaurant', 'Restaurant revenue', 'food + drink on the floor', (s) => s.restaurant, money),
    row('minibar',    'Minibar',            'in-room, no floor cover',   (s) => s.minibar,    money),
    row('total',      'Total F&B',          'restaurant + minibar',      (s) => s.total,      money),
    row('folios',     'Folios touched',     'reservations with a charge',(s) => s.folios,     (n) => String(n)),
    row('lines',      'Lines posted',       'individual items',          (s) => s.lines,      (n) => String(n)),
    row('avg',        'Average per folio',  'total ÷ folios',            (s) => s.avgPerFolio, money),
  ];

  // Capture rows — sourced from Cloudbeds folio (v_fb_outlet_daily) and room occupancy
  // (v_ancillary_capture_daily); a different pipeline than the txn rows above.
  const capRow = (
    key: string, label: string, unit: string,
    pick: (s: FbCaptureStats) => number | null,
    fmt: (n: number) => string,
  ): MatrixRow => ({
    key, label, unit,
    cells: Object.fromEntries(PERIOD_COLS.map((c) => {
      const v = pick(cap[c.key]);
      if (v == null) return [c.key, undefined];
      return [c.key, { value: fmt(v) }];
    })),
  });

  const captureRows: MatrixRow[] = [
    capRow('folioRev',   'Folio revenue',   'Cloudbeds POS (live)',          (s) => s.folioRev,    money),
    capRow('coverDays',  'Cover-days',       'res with F&B charge',           (s) => s.coverDays,   (n) => String(n)),
    capRow('avgCheck',   'Avg check',        'folio rev ÷ cover-days',        (s) => s.avgCheck,    money),
    capRow('capturePct', 'Capture %',        'F&B purchasing ÷ occupied rns', (s) => s.capturePct,  (n) => `${n.toFixed(1)}%`),
    capRow('spendOcc',   'F&B / Occ RN',    'folio rev ÷ occupied rooms',    (s) => s.spendPerOcc, money),
  ];

  return (
    <>
      <Container
        title="Today · every KPI, every timeframe"
        subtitle="LY on each txn-row cell is the same window one year earlier · minibar separated because it needs no one on the floor · capture rows from Cloudbeds folio"
        density="compact"
      >
        <MetricMatrix
          caption="Food and beverage KPIs across today, yesterday, 7 and 30 days, YTD; capture rows are folio-sourced."
          columns={PERIOD_COLS.map((c) => ({ key: c.key, label: c.label, sub: c.sub }))}
          rows={[...rows, ...captureRows]} labelWidth={180} minWidth={640}
        />
      </Container>

      <Container title="Service so far" subtitle={`every posting today, newest first · ${today}`} density="compact">
        {feed.length === 0 ? <Empty>Nothing posted yet today.</Empty> : <FeedList rows={feed} sym={sym} />}
      </Container>

      <OutletCaptureCockpit deptKey="fb" propertyId={pid} searchParams={searchParams} />
    </>
  );
}

// ─── Feed ──────────────────────────────────────────────────────────────────

async function FeedTab({ pid, win, period, q, money, sym }: {
  pid: number; win: { from: string; to: string; label: string };
  period: OpPeriod; q: string; money: (n: number) => string; sym: string;
}) {
  const txns = await getFeedDetail(pid, win.from, win.to, q, 300);
  const total = txns.reduce((s, t) => s + num(t.amount), 0);

  return (
    <Container
      title="Feed · what actually happened"
      subtitle={`every F&B posting · ${win.label.toLowerCase()}${q ? ` · filtered on "${q}"` : ''} · ${txns.length} shown · ${money(total)}`}
      density="compact"
      action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <PeriodPills tab="feed" active={period} extra={q ? { q } : undefined} />
        <form method="GET" action={BASE} style={{ display: 'flex', gap: 6 }}>
          <input type="hidden" name="tab" value="feed" />
          <input
            type="search" name="q" defaultValue={q}
            placeholder="item, category, room, guest, waiter…"
            style={{
              padding: '5px 9px', fontSize: 11, minWidth: 170,
              border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4,
              background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
            }}
          />
          <button type="submit" style={{
            padding: '5px 12px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
            border: '1px solid var(--ink, #1B1B1B)', borderRadius: 4,
            background: 'var(--ink, #1B1B1B)', color: 'var(--paper, #FFFFFF)', cursor: 'pointer',
          }}>Search</button>
          <input type="hidden" name="op_period" value={period} />
        </form>
        </div>
      }
    >
      {txns.length === 0 ? (
        <Empty>{q ? `Nothing matches “${q}” in ${win.label.toLowerCase()}.` : `No postings in ${win.label.toLowerCase()}.`}</Empty>
      ) : (
        <FeedList rows={txns} sym={sym} detailed />
      )}
    </Container>
  );
}

// ─── Menu ──────────────────────────────────────────────────────────────────

const MENU_SORTS: Array<{ key: MenuSort; label: string }> = [
  { key: 'revenue',  label: 'Revenue' },
  { key: 'units',    label: 'Units' },
  { key: 'price',    label: 'Avg price' },
  { key: 'category', label: 'Category' },
  { key: 'last',     label: 'Last sale' },
  { key: 'name',     label: 'Name' },
];

async function MenuTab({ pid, today, win, period, money, sort, dir, year }: {
  pid: number; today: string; win: { from: string; to: string; label: string };
  period: OpPeriod; money: (n: number) => string;
  sort?: string; dir?: string; year?: string;
}) {
  const years = await getMenuYears(pid);
  const activeYear = year && years.includes(year) ? year : (years[0] ?? today.slice(0, 4));
  const activeSort = (MENU_SORTS.some((s) => s.key === sort) ? sort : 'revenue') as MenuSort;
  const activeDir: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';

  const [items, sleeping, sellers, cats, issues] = await Promise.all([
    getMenuItems(pid, activeYear, activeSort, activeDir),
    getSleepingItems(18), getTopSellers(18), getCategoryMix(pid, win.from, win.to),
    getClassificationIssues(pid, `${today.slice(0, 4)}-01-01`),
  ]);

  const byCat = new Map<string, { rev: number; tx: number }>();
  for (const c of cats) {
    const k = (c.item_category_name || '(uncategorised)').trim() || '(uncategorised)';
    const a = byCat.get(k) ?? { rev: 0, tx: 0 };
    a.rev += num(c.amount); a.tx += 1; byCat.set(k, a);
  }
  const catTotal = [...byCat.values()].reduce((s, a) => s + a.rev, 0);
  const catRows: MatrixRow[] = [...byCat.entries()]
    .sort((a, b) => b[1].rev - a[1].rev).slice(0, 12)
    .map(([name, a]) => ({
      key: name, label: name, unit: `${a.tx} postings`,
      cells: {
        rev:   { value: money(a.rev) },
        share: { value: `${((a.rev / (catTotal || 1)) * 100).toFixed(1)}%`, bar: (a.rev / (catTotal || 1)) * 100 },
        line:  { value: money(a.rev / (a.tx || 1)), tone: 'mute' },
      },
    }));

  const stale = (last: string | null) => {
    if (!last) return true;
    return addDays(today, -45) > last;
  };


  return (
    <>
      <Container
        title={`Every F&B product sold · ${activeYear}`}
        subtitle={`${items.length} products · average price is revenue ÷ units for the year, so a dish repriced mid-year shows what was actually achieved, not what the menu says`}
        density="compact"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {years.slice(0, 4).map((y) => (
                <a key={y} href={`?tab=menu&year=${y}&sort=${activeSort}&dir=${activeDir}`} style={{
                  padding: '3px 10px', fontSize: 10, borderRadius: 3, textDecoration: 'none',
                  border: y === activeYear ? '1px solid var(--ink, #1B1B1B)' : '1px solid var(--hairline, #E6DFCC)',
                  background: y === activeYear ? 'var(--ink, #1B1B1B)' : 'var(--paper, #FFFFFF)',
                  color: y === activeYear ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
                  fontWeight: y === activeYear ? 600 : 500, letterSpacing: '0.04em',
                }}>{y}</a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {MENU_SORTS.map((s) => {
                const on = s.key === activeSort;
                const nextDir = on && activeDir === 'desc' ? 'asc' : 'desc';
                return (
                  <a key={s.key} href={`?tab=menu&year=${activeYear}&sort=${s.key}&dir=${nextDir}`} style={{
                    padding: '3px 9px', fontSize: 10, borderRadius: 3, textDecoration: 'none',
                    border: '1px solid var(--hairline, #E6DFCC)',
                    background: on ? 'var(--paper-soft, #FAFAF7)' : 'var(--paper, #FFFFFF)',
                    color: 'var(--ink, #1B1B1B)', fontWeight: on ? 600 : 500,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>{s.label}{on ? (activeDir === 'desc' ? ' ↓' : ' ↑') : ''}</a>
                );
              })}
            </div>
          </div>
        }
      >
        {items.length === 0 ? <Empty>Nothing sold in {activeYear}.</Empty> : (
          <MetricMatrix
            caption={`Every F&B product sold in ${activeYear}, with units, revenue and average selling price.`}
            columns={[
              { key: 'cat',   label: 'Category' },
              { key: 'units', label: 'Units' },
              { key: 'rev',   label: 'Revenue' },
              { key: 'price', label: 'Avg price', sub: 'achieved' },
              { key: 'last',  label: 'Last sale' },
            ]}
            rows={items.map((it) => {
              const stale = !it.lastSold || addDays(today, -45) > it.lastSold;
              return {
                key: `it-${it.name}`,
                label: it.name,
                unit: `${it.monthsActive} month${it.monthsActive === 1 ? '' : 's'} active`,
                cells: {
                  cat:   { value: it.subdept, tone: 'mute' },
                  units: { value: it.units.toLocaleString('en-US') },
                  rev:   { value: money(it.revenue) },
                  price: { value: it.avgPrice == null ? '—' : money(it.avgPrice) },
                  last:  { value: String(it.lastSold ?? '—'), tone: stale ? 'neg' : undefined,
                           title: stale ? 'Not sold in over 45 days' : undefined },
                },
              };
            })}
            labelWidth={230} minWidth={580}
          />
        )}
      </Container>

      {issues.length > 0 && (
        <Container
          title="Filed wrongly"
          subtitle="categories that are in the wrong department, spelled two ways, or have no menu meaning — a POS vocabulary problem, not fixable from this page, but every report above inherits it"
          density="compact"
        >
          <MetricMatrix
            caption="Category classification problems this year."
            columns={[
              { key: 'kind', label: 'Problem' },
              { key: 'lines', label: 'Lines' },
              { key: 'rev', label: 'Revenue' },
            ]}
            rows={issues.map((i, ix) => ({
              key: `${i.kind}-${ix}`,
              label: i.label,
              unit: i.note,
              cells: {
                kind:  { value: i.kind, tone: 'warn' },
                lines: { value: i.lines.toLocaleString('en-US'), tone: 'mute' },
                rev:   { value: money(i.revenue), tone: 'neg' },
              },
            }))}
            labelWidth={230} minWidth={520}
          />
        </Container>
      )}

      <Container
        title="Not selling"
        subtitle="items with the oldest last-sale — the other half of a menu decision, and not on the live page at all"
        density="compact"
      >
        {sleeping.length === 0 ? <Empty>Every tracked item has sold recently.</Empty> : (
          <MetricMatrix
            caption="Items ordered by how long since their last sale."
            columns={[
              { key: 'last', label: 'Last sold' }, { key: 'rev', label: 'Lifetime rev' },
              { key: 'units', label: 'Units' }, { key: 'months', label: 'Months active' },
            ]}
            rows={sleeping.map((s) => ({
              key: `sleep-${s.description}`,
              label: String(s.description ?? '—'),
              unit: String(s.usali_subdept ?? ''),
              cells: {
                last:  { value: String(s.last_sold ?? '—'), tone: 'neg' },
                rev:   { value: money(num(s.total_revenue_usd)), tone: 'mute' },
                units: { value: num(s.total_units).toLocaleString('en-US'), tone: 'mute' },
                months:{ value: String(s.active_months ?? '—'), tone: 'mute' },
              },
            }))}
            labelWidth={220} minWidth={520}
          />
        )}
      </Container>

      <Container
        title={`Category mix · ${win.label.toLowerCase()}`}
        subtitle="where the money came from"
        density="compact"
        action={<PeriodPills tab="menu" active={period} />}
      >
        {catRows.length === 0 ? <Empty>No postings in {win.label.toLowerCase()}.</Empty> : (
          <MetricMatrix
            caption="Revenue by category, last 30 days."
            columns={[{ key: 'rev', label: 'Revenue' }, { key: 'share', label: 'Share' }, { key: 'line', label: 'Avg line' }]}
            rows={catRows} labelWidth={190} minWidth={420}
          />
        )}
      </Container>
    </>
  );
}

// ─── Cost ──────────────────────────────────────────────────────────────────

async function CostTab({ pid, today, money }: {
  pid: number; today: string; money: (n: number) => string;
}) {
  const year = today.slice(0, 4);
  const fromMonth = `${year}-01-01`;
  // folioRev must be ready before getFbLabour — it supplies the correct F&B
  // revenue map (usali_dept='F&B') so the labour ratio uses the right denominator.
  const [cos, folioRev, clock] = await Promise.all([
    getFoodCost(pid, year),
    getFbRevenueByMonth(pid, fromMonth),
    getServiceClock(pid, addDays(today, -90), today),
  ]);
  const folioByMonth = new Map(folioRev.map((r) => [r.month, r.folioRevenue]));
  const labour = await getFbLabour(pid, NAMKHAN_PROPERTY_ID, fromMonth, folioByMonth);
  const thisMonth = today.slice(0, 7);

  const cosRows: MatrixRow[] = cos
    .filter((r) => r.month <= thisMonth)
    .map((r) => {
      const till = folioByMonth.get(r.month) ?? 0;
      const pct = r.costPct;
      return {
        key: r.month,
        label: r.month,
        unit: 'food + beverage',
        cells: {
          cost:  { value: money(r.glCost) },
          glrev: { value: money(r.glRevenue), tone: 'mute' },
          till:  { value: money(till), tone: 'mute',
                   title: 'Taken through the till, usali_dept = F&B' },
          pct:   pct == null
            ? undefined
            : { value: `${pct.toFixed(1)}%`,
                tone: pct <= 35 ? 'pos' : pct <= 50 ? 'warn' : 'neg',
                bar: Math.min(100, pct) },
        },
      };
    });

  const labRows: MatrixRow[] = labour.map((r) => ({
    key: r.month,
    label: r.month,
    unit: r.headcount != null ? `${r.headcount} in the kitchen` : 'kitchen',
    cells: {
      cost: { value: money(r.kitchenCost) },
      rev:  { value: money(r.fbRevenue), tone: 'mute' },
      pct:  r.ratioPct == null
        ? undefined
        : { value: `${r.ratioPct.toFixed(1)}%`,
            tone: r.ratioPct <= 35 ? 'pos' : r.ratioPct <= 60 ? 'warn' : 'neg',
            bar: Math.min(100, r.ratioPct) },
    },
  }));

  return (
    <>
      <Container
        title={`Food cost · ${year}`}
        subtitle="food + beverage cost against F&B revenue, both straight from the live P&L. Target ≤ 35%. The till column is what went through the POS — a gap either way is a posting-timing difference, not a different restaurant."
        density="compact"
      >
        {cosRows.length === 0 ? <Empty>No cost of sales posted for {year}.</Empty> : (
          <MetricMatrix caption="Food cost of sales by month, against ledger and till revenue."
            columns={[
              { key: 'cost',  label: 'Cost of sales', sub: 'food + bev' },
              { key: 'glrev', label: 'GL revenue', sub: 'ledger' },
              { key: 'till',  label: 'Till revenue', sub: 'actual POS' },
              { key: 'pct',   label: 'Cost %' },
            ]}
            rows={cosRows} labelWidth={150} minWidth={520} />
        )}
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
          Read from the live P&amp;L, not the USALI materialized view — that matview stops at
          2026-06 and was reporting June cost as $61 against a real $3,686, with July and
          August shown as unposted when both are posted. Staff canteen is not in these
          figures: EMPLOYEE MEAL sits in Undistributed payroll (~$2,400 a month) and STAFF
          CANTEEN MATERIALS in Other Operating Expenses. Kitchen payroll below still includes
          the labour that cooks those staff meals while the revenue it is divided by does not,
          so that ratio runs a little hot.
        </p>
      </Container>

      <ServiceClock clock={clock} money={money} />

      <Container
        title="Kitchen labour"
        subtitle="Restaurant Kitchen payroll against F&B revenue · healthy 25–35%"
        density="compact"
      >
        {labRows.length === 0 ? (
          <Empty>
            Kitchen payroll is only broken out per department for The Namkhan —
            v_payroll_dept_monthly carries no property_id, so it is not shown here
            rather than showing another property&apos;s figures.
          </Empty>
        ) : (
          <MetricMatrix caption="Kitchen payroll against F&B revenue by month."
            columns={[
              { key: 'cost', label: 'Kitchen payroll' },
              { key: 'rev', label: 'F&B revenue' },
              { key: 'pct', label: '% of F&B revenue' },
            ]}
            rows={labRows} labelWidth={150} minWidth={420} />
        )}
      </Container>
    </>
  );
}

// ─── Service clock ─────────────────────────────────────────────────────────

/**
 * When the work actually happens.
 *
 * Every posting carries a local timestamp, so the billing hour stands in for
 * the consumption hour. Minibar is shown but held apart: it is in-room, needs
 * nobody on the floor, and counting it as service demand would overstate the
 * morning.
 */
function ServiceClock({ clock, money }: {
  clock: Awaited<ReturnType<typeof getServiceClock>>;
  money: (n: number) => string;
}) {
  const served = clock.filter((h) => h.food + h.beverage > 0);
  if (served.length === 0) {
    return (
      <Container title="When the work happens" subtitle="needs timestamped F&B postings" density="compact">
        <Empty>No timestamped F&amp;B postings in the last 90 days.</Empty>
      </Container>
    );
  }

  const peak = Math.max(...served.map((h) => h.food + h.beverage));
  const busiest = served.reduce((a, b) => (b.food + b.beverage > a.food + a.beverage ? b : a));
  const hh = (n: number) => `${String(n).padStart(2, '0')}:00`;

  const rows: MatrixRow[] = served.map((h) => {
    const service = h.food + h.beverage;
    const share = Math.round((service / peak) * 100);
    return {
      key: String(h.hour),
      label: hh(h.hour),
      unit: `${h.linesPerDay}/day`,
      cells: {
        load: {
          value: String(service),
          tone: share >= 70 ? 'neg' : share >= 35 ? 'warn' : 'pos',
          bar: share,
          title: `${h.food} food · ${h.beverage} drink lines`,
        },
        food: { value: String(h.food), tone: 'mute' },
        bev:  { value: String(h.beverage), tone: 'mute' },
        room: h.minibar > 0 ? { value: String(h.minibar), tone: 'mute', title: 'In-room — no floor cover needed' } : undefined,
        rev:  { value: money(h.revenue), tone: 'mute' },
      },
    };
  });

  return (
    <Container
      title="When the work happens"
      subtitle={`F&B postings by hour, last 90 days · busiest is ${hh(busiest.hour)} at ${busiest.linesPerDay} lines a day · room-service and minibar shown separately because they need no floor cover`}
      density="compact"
    >
      <MetricMatrix
        caption="Food and beverage postings by hour of day, last 90 days."
        columns={[
          { key: 'load', label: 'Service load', sub: 'food + drink' },
          { key: 'food', label: 'Food' },
          { key: 'bev',  label: 'Drink' },
          { key: 'room', label: 'In-room', sub: 'minibar' },
          { key: 'rev',  label: 'Revenue' },
        ]}
        rows={rows} labelWidth={110} minWidth={520}
      />
      <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
        Billing time, not order time — close enough to plan a roster, not close enough to
        settle an argument. The nightly room-rate batch posts at 00:00 and is excluded;
        left in, it would have read as the busiest hour of the day.
      </p>
    </Container>
  );
}

// ─── Analytics ─────────────────────────────────────────────────────────────

/**
 * Analytics used to be the whole previous F&B page rendered verbatim.
 *
 * Every container on it already existed elsewhere in the cockpit — the same KPI
 * tiles as Today, the same cost table as Cost, the same sellers as Menu — which
 * is why it read as chaos rather than as analysis. The old page is not deleted;
 * it moved to the Ledger tab, where a controller can still find it.
 *
 * What is here instead is the three questions no other tab answers.
 */
async function AnalyticsTab({ pid, today, money, sym }: {
  pid: number; today: string; money: (n: number) => string; sym: string;
}) {
  const yearAgo = addDays(today, -365);
  const [por, conc, mix] = await Promise.all([
    getFbPorTrend(pid, 13),
    getFbConcentration(pid, yearAgo),
    getCategoryMix(pid, yearAgo, today),
  ]);

  const pct = (ty: number | null, ly: number | null): { txt: string; tone: MatrixTone } | null => {
    if (ty == null || ly == null || ly === 0) return null;
    const d = ((ty - ly) / Math.abs(ly)) * 100;
    return {
      txt: `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`,
      tone: d >= 3 ? 'pos' : d <= -3 ? 'neg' : 'mute',
    };
  };

  const porRows: MatrixRow[] = por.map((r) => {
    const dRev = pct(r.revenue, r.lyRevenue);
    const dOcc = pct(r.occ, r.lyOcc);
    const dPor = pct(r.por, r.lyPor);
    const dCap = r.capturePct != null && r.lyCapturePct != null
      ? r.capturePct - r.lyCapturePct : null;
    return {
      key: r.month,
      label: r.month,
      cells: {
        rev: {
          value: money(r.revenue),
          sub: dRev ? `LY ${money(r.lyRevenue ?? 0)} · ${dRev.txt}` : 'no LY',
          tone: dRev?.tone,
        },
        occ: {
          value: String(r.occ),
          sub: dOcc ? `LY ${r.lyOcc} · ${dOcc.txt}` : 'no LY',
          tone: dOcc?.tone,
        },
        por: r.por == null ? undefined : {
          value: `${sym}${r.por.toFixed(2)}`,
          sub: dPor ? `LY ${sym}${(r.lyPor ?? 0).toFixed(2)} · ${dPor.txt}` : 'no LY',
          tone: dPor?.tone,
          title: 'F&B revenue ÷ occupied rooms — growth the hotel did not hand you',
        },
        cap: r.capturePct == null ? undefined : {
          value: `${r.capturePct.toFixed(0)}%`,
          sub: dCap == null ? 'no LY' : `LY ${(r.lyCapturePct ?? 0).toFixed(0)}% · ${dCap >= 0 ? '+' : ''}${dCap.toFixed(1)}pt`,
          tone: dCap == null ? undefined : dCap >= 1 ? 'pos' : dCap <= -1 ? 'neg' : 'mute',
          bar: r.capturePct,
        },
      },
    };
  });

  // The narrative under the first container is DERIVED, never written down.
  // A sentence like "August took 157% more" is true for one month on one
  // property and silently becomes a lie everywhere else.
  const last = por[por.length - 1];
  const growth = (ty: number | null, ly: number | null): number | null =>
    ty == null || ly == null || ly === 0 ? null : ((ty - ly) / Math.abs(ly)) * 100;
  const gRev = last ? growth(last.revenue, last.lyRevenue) : null;
  const gOcc = last ? growth(last.occ, last.lyOcc) : null;
  const gPor = last ? growth(last.por, last.lyPor) : null;
  const gCap = last && last.capturePct != null && last.lyCapturePct != null
    ? last.capturePct - last.lyCapturePct : null;
  const sign = (n: number) => `${n >= 0 ? 'up' : 'down'} ${Math.abs(n).toFixed(0)}%`;
  const latest =
    last && gRev != null && gOcc != null && gPor != null
      ? ` ${last.month} took revenue ${sign(gRev)} on last year, which reads as a` +
        ` ${gRev >= 0 ? 'triumph' : 'collapse'} until you see occupancy was ${sign(gOcc)}.` +
        ` Per occupied room the restaurant was ${sign(gPor)}` +
        (gCap != null
          ? `, and capture ${gCap >= 0 ? 'rose' : 'fell'} ${Math.abs(gCap).toFixed(1)} points.`
          : '.') +
        (gPor < 3 && gRev > 10
          ? ' It served a fuller house and got a smaller share of it.'
          : '')
      : '';

  const mixTotal = mix.reduce((s, c) => s + num(c.amount), 0);
  const mixTop = [...mix]
    .map((c) => ({ name: c.item_category_name ?? '(uncategorised)', amt: num(c.amount) }))
    .sort((a, b) => b.amt - a.amt)
    .slice(0, 12);

  return (
    <>
      <Container
        title="Growth, or just a fuller hotel?"
        subtitle="Revenue on its own cannot answer that. The column that can is revenue per occupied room — if it is flat while revenue climbs, the hotel grew and the restaurant stood still. Capture % is the share of occupied rooms that bought anything at all."
        density="compact"
      >
        {porRows.length === 0 ? <Empty>No capture data for this property yet.</Empty> : (
          <MetricMatrix
            columns={[
              { key: 'rev', label: 'F&B revenue', sub: 'vs last year' },
              { key: 'occ', label: 'Occupied rooms', sub: 'vs last year' },
              { key: 'por', label: 'Per occupied room', sub: 'the real number' },
              { key: 'cap', label: 'Capture %', sub: 'rooms that spent' },
            ]}
            rows={porRows}
            caption="F&B revenue, occupied rooms, revenue per occupied room and capture rate by month, each against the same month last year"
            minWidth={640}
            labelWidth={78}
          />
        )}
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
          Read the last two columns, not the first.{latest}{' '}
          Basis is the estate&rsquo;s own
          capture bridge, the same one behind the Guests tab, so both sides of every
          ratio are attributed the same way; its totals sit slightly under the raw till.
        </p>
      </Container>

      <Container
        title="A fifth of the year rides on five days"
        subtitle="Banquets and set-menu groups, not covers. This is the single most useful fact about this business and no averaged report shows it."
        density="compact"
      >
        {!conc ? <Empty>No F&amp;B postings in the last 12 months.</Empty> : (
          <>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <KpiTile size="sm" label="Top 5 days" value={`${conc.top5Pct}%`}
                unit="of 12-month revenue" footnote={`${money(conc.top5)} across 5 of ${conc.tradingDays} trading days`} />
              <KpiTile size="sm" label="Top 10 days" value={`${conc.top10Pct}%`} unit="of 12-month revenue" />
              <KpiTile size="sm" label="Median day" value={money(conc.medianDay)}
                unit="ordinary trading" footnote="half of all days are below this" />
              <KpiTile size="sm" label="Mean day" value={money(conc.meanDay)}
                unit="flattered by events" stly={`median ${money(conc.medianDay)}`} />
            </div>
            <div style={{ marginTop: 12 }}>
              <MetricMatrix
                columns={[
                  { key: 'rev', label: 'Revenue' },
                  { key: 'lines', label: 'Lines', sub: 'postings' },
                  { key: 'what', label: 'Biggest line on the day' },
                ]}
                rows={conc.topDays.map((d) => ({
                  key: d.date,
                  label: d.date,
                  unit: d.dow,
                  cells: {
                    rev: { value: money(d.revenue) },
                    lines: {
                      value: String(d.lines),
                      tone: d.lines < 40 ? 'warn' : 'mute',
                      title: 'Few lines against a large total means one group bill, not a busy service',
                    },
                    what: { value: d.top, tone: 'mute' },
                  },
                }))}
                caption="The six largest F&B trading days of the last 12 months, with posting counts and the largest single line on each"
                minWidth={560}
                labelWidth={92}
              />
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
              Watch the line count. The biggest day above took {money(conc.topDays[0].revenue)}
              {' '}on {conc.topDays[0].lines} postings — a group set menu, not a busy service. One
              day like that distorts every weekday average on the page: it is why an
              average-by-weekday chart here would have told you to roster extra staff on a
              {' '}{conc.topDays[0].dow}day that is otherwise ordinary. The mean day sits{' '}
              {conc.medianDay > 0 ? Math.round(((conc.meanDay - conc.medianDay) / conc.medianDay) * 100) : 0}%
              above the median for the same reason. The lever here is selling more events,
              not staffing a weekday differently.
            </p>
          </>
        )}
      </Container>

      <Container
        title="What actually sells"
        subtitle="Last 12 months by category, largest first"
        density="compact"
      >
        {mixTop.length === 0 ? <Empty>No categorised sales in the window.</Empty> : (
          <MetricMatrix
            columns={[
              { key: 'rev', label: 'Revenue' },
              { key: 'share', label: 'Share of F&B' },
            ]}
            rows={mixTop.map((c) => ({
              key: c.name,
              label: c.name,
              cells: {
                rev: { value: money(Math.round(c.amt)) },
                share: mixTotal > 0 ? {
                  value: `${((c.amt / mixTotal) * 100).toFixed(1)}%`,
                  bar: (c.amt / mixTotal) * 100,
                  tone: /product|uncategor/i.test(c.name) ? 'warn' : undefined,
                } : undefined,
              },
            }))}
            caption="F&B revenue by POS category over the last 12 months, largest first"
            minWidth={420}
            labelWidth={200}
          />
        )}
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
          There is deliberately no year-on-year comparison here. The POS vocabulary was
          rewritten in {FB_VOCAB_BREAK}: &ldquo;Main Dish&rdquo; became &ldquo;Main Courses&rdquo;,
          &ldquo;Starter&rdquo; became &ldquo;Starters&rdquo;, &ldquo;Wine&amp;Sparkling Wine&rdquo; became
          &ldquo;Wine &amp; Sparkling&rdquo;, &ldquo;Beer&rdquo; became &ldquo;Laotian Beers&rdquo;. The old
          names stop dead and the new ones begin, so a category comparison across that line
          would show every established category collapsing next to a set of brand-new ones —
          all of it an artefact of renaming. Categories become comparable year-on-year again
          from November 2026. Rows flagged amber are not real categories: &ldquo;product&rdquo;
          is the POS default and swallows most group billing. Item-level detail is on the
          Menu tab; cost against these figures is on Cost.
        </p>
      </Container>
    </>
  );
}

function LedgerTab({ searchParams, propertyId }: {
  searchParams: Record<string, string | string[] | undefined>;
  propertyId?: number;
}) {
  return <LegacyFbView searchParams={searchParams} propertyId={propertyId} />;
}

// ─── shared bits ───────────────────────────────────────────────────────────

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px 14px', fontSize: 12, color: 'var(--ink-soft, #5A5A5A)',
      border: '1px dashed var(--hairline, #E6DFCC)', borderRadius: 4,
      background: 'var(--paper, #FFFFFF)',
    }}>{children}</div>
  );
}

function FeedList({ rows, sym, detailed }: {
  rows: Awaited<ReturnType<typeof getFeedDetail>>; sym: string; detailed?: boolean;
}) {
  // detailed (Feed tab): time | room | item | guest | waiter | amount
  // compact (Today tab): time | item | amount
  const cols = detailed ? '82px 58px 1fr 110px 100px auto' : '84px 1fr auto';
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {detailed && (
        <li style={{
          display: 'grid', gridTemplateColumns: cols, gap: 10,
          padding: '4px 8px 6px', borderBottom: '1px solid var(--hairline, #E6DFCC)',
          fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--ink-soft, #5A5A5A)', fontWeight: 600,
        }}>
          <span>Time</span>
          <span>Room</span>
          <span>Item</span>
          <span>Guest</span>
          <span>Waiter</span>
          <span style={{ textAlign: 'right' }}>Amt</span>
        </li>
      )}
      {rows.map((t, i) => {
        const isMinibar = t.usali_subdept === 'Minibar';
        return (
          <li key={`${t.transaction_id}-${i}`} style={{
            display: 'grid', gridTemplateColumns: cols,
            gap: 10, alignItems: 'baseline', padding: '6px 8px', borderRadius: 3, fontSize: 12,
            background: i % 2 ? 'var(--paper, #FFFFFF)' : 'transparent',
          }}>
            <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10.5, color: 'var(--ink-soft, #5A5A5A)' }}>
              {(t.local_laos_str ?? t.transaction_date ?? '').toString().slice(0, 16).replace('T', ' ')}
            </span>
            {detailed && (
              <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10.5, color: 'var(--ink, #1B1B1B)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.room_name ?? '—'}
              </span>
            )}
            <span style={{ color: 'var(--ink, #1B1B1B)', minWidth: 0 }}>
              {t.description ?? '—'}
              <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-soft, #5A5A5A)' }}>
                {t.item_category_name ?? 'uncategorised'}
                {isMinibar ? ' · minibar (in-room)' : ''}
              </span>
            </span>
            {detailed && (
              <span style={{ fontSize: 10.5, color: 'var(--ink-soft, #5A5A5A)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.guest_name ?? '—'}
              </span>
            )}
            {detailed && (
              <span style={{ fontSize: 10.5, color: 'var(--ink-soft, #5A5A5A)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.user_name ?? '—'}
              </span>
            )}
            <span style={{ fontFamily: 'var(--mono, monospace)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: detailed ? 'right' : 'left' }}>
              {sym}{Math.round(num(t.amount)).toLocaleString('en-US')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
