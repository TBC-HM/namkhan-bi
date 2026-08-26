// app/operations/restaurant/cockpit/page.tsx
// PBS 2026-08-26 · The redesigned F&B cockpit, built ALONGSIDE the live page.
//
// /operations/restaurant is untouched and still serves. This route is the
// replacement candidate: one sub-strip, one tab at a time, manager content
// first and the bookkeeper's work behind its own tab instead of opening the
// page. When it is right we swap the routes; until then nothing is at risk.
//
// Tabs: Tonight · Feed · Menu · Guests · Cost · Ledger.
// Feed is its own tab on PBS instruction — the manager wants to see what
// actually happened, not a summary of it.

import { DashboardPage, Container, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import OutletCaptureCockpit from '@/app/(cockpit)/_design/OutletCaptureCockpit';
import MetricMatrix, { type MatrixRow } from '@/app/(cockpit)/_design/MetricMatrix';
import FbSubnav, { isFbTab, type FbTab } from '../_cockpit/FbSubnav';
import {
  tzFor, todayIn, addDays, getTxns, getTopSellers, getCategoryMix,
  getFoodCost, getLabour, getFolioVsGl,
} from '../_cockpit/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
  propertyId?: number;
}

const BASE = '/operations/restaurant/cockpit';
const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

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
  const tab: FbTab = isFbTab(rawTab) ? rawTab : 'tonight';
  const opPeriod = one(searchParams?.op_period);
  const q = one(searchParams?.q) ?? '';

  const money = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;

  const deptTabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/restaurant'),
  })) as DashboardTab[];

  return (
    <DashboardPage
      title="Roots restaurant"
      subtitle="Operations · F&B · manager cockpit (preview — the live page is unchanged)"
      tabs={deptTabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* The module's own strip is ALWAYS first. Nothing pushes it down. */}
        <FbSubnav active={tab} basePath={BASE} opPeriod={opPeriod} />

        {tab === 'tonight'  && <TonightTab pid={pid} tz={tz} today={today} sym={sym} searchParams={searchParams} />}
        {tab === 'feed'     && <FeedTab    pid={pid} today={today} q={q} money={money} />}
        {tab === 'menu'     && <MenuTab    pid={pid} today={today} money={money} />}
        {tab === 'guests'   && <OutletCaptureCockpit deptKey="fb" propertyId={pid} searchParams={searchParams} />}
        {tab === 'cost'     && <CostTab    pid={pid} today={today} money={money} />}
        {tab === 'ledger'   && <LedgerTab  pid={pid} money={money} />}
      </div>
    </DashboardPage>
  );
}

// ─── Tonight ───────────────────────────────────────────────────────────────

async function TonightTab({ pid, today, sym, searchParams }: {
  pid: number; tz: string; today: string; sym: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const txns = await getTxns(pid, today, today, undefined, 60);
  const total = txns.reduce((s, t) => s + num(t.amount), 0);
  const covers = new Set(txns.map((t) => String(t.reservation_id ?? '')).filter(Boolean)).size;

  const tiles: KpiTileProps[] = [
    { label: 'Taken today', value: `${sym}${Math.round(total).toLocaleString('en-US')}`, size: 'sm',
      footnote: `${txns.length} postings since midnight ${today}`,
      status: total > 0 ? 'green' : 'grey' },
    { label: 'Folios touched', value: covers, size: 'sm',
      footnote: 'distinct reservations with an F&B charge today', status: covers > 0 ? 'green' : 'grey' },
    { label: 'Average per folio', value: covers > 0 ? `${sym}${Math.round(total / covers)}` : '—', size: 'sm',
      footnote: 'today · revenue ÷ folios touched', status: 'grey' },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      <Container title="Service so far" subtitle={`every posting today, newest first · ${today}`} density="compact">
        {txns.length === 0 ? (
          <Empty>Nothing posted yet today.</Empty>
        ) : (
          <FeedList rows={txns.slice(0, 25)} sym={sym} />
        )}
      </Container>

      <OutletCaptureCockpit deptKey="fb" propertyId={pid} searchParams={searchParams} />
    </>
  );
}

// ─── Feed ──────────────────────────────────────────────────────────────────

async function FeedTab({ pid, today, q, money }: {
  pid: number; today: string; q: string; money: (n: number) => string;
}) {
  const from = addDays(today, -30);
  const txns = await getTxns(pid, from, today, q, 300);
  const total = txns.reduce((s, t) => s + num(t.amount), 0);

  return (
    <Container
      title="Feed · what actually happened"
      subtitle={`every F&B posting, last 30 days${q ? ` · filtered on "${q}"` : ''} · ${txns.length} shown · ${money(total)}`}
      density="compact"
      action={
        <form method="GET" action={BASE} style={{ display: 'flex', gap: 6 }}>
          <input type="hidden" name="tab" value="feed" />
          <input
            type="search" name="q" defaultValue={q}
            placeholder="item, category…"
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
        </form>
      }
    >
      {txns.length === 0 ? (
        <Empty>{q ? `Nothing matches “${q}” in the last 30 days.` : 'No postings in the last 30 days.'}</Empty>
      ) : (
        <FeedList rows={txns} sym={money(0).charAt(0)} />
      )}
    </Container>
  );
}

// ─── Menu ──────────────────────────────────────────────────────────────────

async function MenuTab({ pid, today, money }: {
  pid: number; today: string; money: (n: number) => string;
}) {
  const from = addDays(today, -30);
  const [sellers, cats] = await Promise.all([getTopSellers(25), getCategoryMix(pid, from, today)]);

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

  const sellerRows: MatrixRow[] = sellers.slice(0, 18).map((s) => ({
    key: String(s.description),
    label: String(s.description ?? '—'),
    unit: String(s.usali_subdept ?? ''),
    cells: {
      rev:   { value: money(num(s.total_revenue_usd)) },
      units: { value: num(s.total_units).toLocaleString('en-US'), tone: 'mute' },
      months:{ value: String(s.active_months ?? '—'), tone: 'mute' },
      last:  { value: String(s.last_sold ?? '—'), tone: stale(s.last_sold) ? 'neg' : undefined,
               title: stale(s.last_sold) ? 'Not sold in over 45 days' : undefined },
    },
  }));

  return (
    <>
      <Container title="What sells" subtitle="every tracked item by lifetime revenue · red last-sold means nothing in 45 days" density="compact">
        {sellerRows.length === 0 ? <Empty>No item history for this property.</Empty> : (
          <MetricMatrix
            caption="Menu items by lifetime revenue, units, months active and last sold."
            columns={[
              { key: 'rev', label: 'Revenue' }, { key: 'units', label: 'Units' },
              { key: 'months', label: 'Months' }, { key: 'last', label: 'Last sold' },
            ]}
            rows={sellerRows} labelWidth={220} minWidth={520}
          />
        )}
      </Container>

      <Container title="Category mix · last 30 days" subtitle="where the money came from" density="compact">
        {catRows.length === 0 ? <Empty>No postings in the last 30 days.</Empty> : (
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
  const [cos, labour] = await Promise.all([getFoodCost(pid), getLabour(pid, `${year}-01-01`)]);

  const cosRows: MatrixRow[] = cos
    .filter((r) => String(r.period_yyyymm ?? '').startsWith(year))
    .sort((a, b) => String(a.period_yyyymm).localeCompare(String(b.period_yyyymm)))
    .map((r) => {
      const pct = num(r.food_cost_pct);
      return {
        key: String(r.period_yyyymm),
        label: String(r.period_yyyymm),
        unit: 'food cost of sales',
        cells: {
          cost: { value: money(num(r.food_cost)) },
          pct:  { value: pct > 0 ? `${pct.toFixed(1)}%` : '—',
                  tone: pct === 0 ? undefined : pct <= 30 ? 'pos' : pct <= 40 ? 'warn' : 'neg',
                  bar: Math.min(100, pct) },
          rev:  { value: money(num(r.effective_rev)), tone: 'mute' },
        },
      };
    });

  const labRows: MatrixRow[] = labour.map((r) => {
    const pct = num(r.labour_cost_ratio_pct);
    return {
      key: String(r.period_month),
      label: String(r.period_month).slice(0, 7),
      unit: 'labour ÷ rooms revenue',
      cells: {
        cost: { value: money(num(r.labour_cost)) },
        pct:  { value: `${pct.toFixed(1)}%`,
                tone: pct <= 35 ? 'pos' : pct <= 60 ? 'warn' : 'neg',
                bar: Math.min(100, pct) },
      },
    };
  });

  return (
    <>
      <Container title={`Food cost · ${year}`} subtitle="target ≤ 30% of effective revenue · blank months are unposted ledger, not zero cost" density="compact">
        {cosRows.length === 0 ? <Empty>No cost of sales posted for {year}.</Empty> : (
          <MetricMatrix caption="Food cost of sales by month."
            columns={[{ key: 'cost', label: 'Cost' }, { key: 'pct', label: '% of revenue' }, { key: 'rev', label: 'Effective rev' }]}
            rows={cosRows} labelWidth={150} minWidth={420} />
        )}
      </Container>

      <Container title="Labour" subtitle="kitchen payroll against rooms revenue · healthy 25–35%" density="compact">
        {labRows.length === 0 ? <Empty>No payroll posted for {year}.</Empty> : (
          <MetricMatrix caption="Labour cost ratio by month."
            columns={[{ key: 'cost', label: 'Payroll' }, { key: 'pct', label: '% of revenue' }]}
            rows={labRows} labelWidth={150} minWidth={340} />
        )}
      </Container>
    </>
  );
}

// ─── Ledger ────────────────────────────────────────────────────────────────

async function LedgerTab({ pid, money }: { pid: number; money: (n: number) => string }) {
  const rows = (await getFolioVsGl()).filter((r) => {
    const p = r.property_id;
    return p === undefined || p === null || Number(p) === pid;
  });

  const matrix: MatrixRow[] = rows
    .sort((a, b) => String(b.period_yyyymm).localeCompare(String(a.period_yyyymm)))
    .slice(0, 14)
    .map((r) => {
      const pct = num(r.folio_pct_of_gl);
      return {
        key: String(r.period_yyyymm),
        label: String(r.period_yyyymm),
        unit: 'folio vs general ledger',
        cells: {
          folio: { value: money(num(r.folio_total)) },
          gl:    { value: money(num(r.gl_total)) },
          delta: { value: money(num(r.delta_total_usd)),
                   tone: Math.abs(num(r.delta_total_usd)) > 1000 ? 'neg' : 'mute' },
          pct:   { value: pct > 0 ? `${pct.toFixed(1)}%` : '—',
                   tone: pct >= 97 && pct <= 103 ? 'pos' : 'warn' },
        },
      };
    });

  return (
    <Container
      title="Ledger · folio ↔ GL"
      subtitle="the bookkeeper's reconciliation — kept, but behind its own tab instead of opening the page. Folio is live POS receipts; GL lags about a month."
      density="compact"
    >
      {matrix.length === 0 ? <Empty>No reconciliation rows for this property.</Empty> : (
        <MetricMatrix caption="Cloudbeds folio against QuickBooks general ledger by month."
          columns={[
            { key: 'folio', label: 'Folio' }, { key: 'gl', label: 'GL' },
            { key: 'delta', label: 'Δ' }, { key: 'pct', label: 'Folio % GL' },
          ]}
          rows={matrix} labelWidth={150} minWidth={460} />
      )}
    </Container>
  );
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

function FeedList({ rows, sym }: { rows: Awaited<ReturnType<typeof getTxns>>; sym: string }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.map((t, i) => (
        <li key={`${t.transaction_id}-${i}`} style={{
          display: 'grid', gridTemplateColumns: '84px 1fr auto', gap: 10, alignItems: 'baseline',
          padding: '6px 8px', borderRadius: 3, fontSize: 12,
          background: i % 2 ? 'var(--paper, #FFFFFF)' : 'transparent',
        }}>
          <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10.5, color: 'var(--ink-soft, #5A5A5A)' }}>
            {(t.local_laos_str ?? t.transaction_date ?? '').toString().slice(0, 16).replace('T', ' ')}
          </span>
          <span style={{ color: 'var(--ink, #1B1B1B)', minWidth: 0 }}>
            {t.description ?? '—'}
            <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-soft, #5A5A5A)' }}>
              {t.item_category_name ?? 'uncategorised'}
            </span>
          </span>
          <span style={{ fontFamily: 'var(--mono, monospace)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {sym}{Math.round(num(t.amount)).toLocaleString('en-US')}
          </span>
        </li>
      ))}
    </ul>
  );
}
