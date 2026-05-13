// app/revenue/pace/page.tsx — wired to <Page> shell (PBS manifesto 2026-05-09).
// First real sub-page using Page + Panel + Brief + ArtifactActions.
// Data fetching unchanged; chrome moved onto canonical primitives.
//
// SR-RM rule: backward windows make NO sense on Pace. CSS greys backward chips.

import KpiBox from '@/components/kpi/KpiBox';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import ArtifactActions from '@/components/page/ArtifactActions';
import PeriodSelectorRow from '@/components/page/PeriodSelectorRow';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { capacityFor, capacityRnRange } from '@/lib/capacity';
import { getPaceCurve } from '@/lib/pulseData';

import PaceGraphs, { type BucketRow } from './_components/PaceGraphs';
import PaceBucketsTable from './_components/PaceTableClient';
import { REVENUE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PaceRow {
  night_date: string;
  confirmed_rooms: number;
  confirmed_revenue: number;
  cancelled_rooms: number;
}

interface SearchParams { win?: string; gran?: string; cmp?: string }

const VALID_FWD: WindowKey[] = ['next7', 'next30', 'next90', 'next180', 'next365'];

function parseWin(raw: string | undefined): WindowKey {
  return (VALID_FWD.includes(raw as WindowKey) ? raw : 'next90') as WindowKey;
}
function parseGran(raw: string | undefined): 'day' | 'week' | 'month' {
  if (raw === 'day' || raw === 'week' || raw === 'month') return raw;
  return 'month';
}

async function getPace(fromDate: string, toDate: string): Promise<PaceRow[]> {
  const { data, error } = await supabase
    .from('v_otb_pace')
    .select('night_date, confirmed_rooms, confirmed_revenue, cancelled_rooms')
    .eq('property_id', PROPERTY_ID)
    .gte('night_date', fromDate)
    .lte('night_date', toDate)
    .order('night_date');
  if (error) {
    console.error('[pace] error', error);
    return [];
  }
  return (data ?? []) as PaceRow[];
}

// STLY actuals proxy: same calendar dates -1 year from mv_kpi_daily.
async function getStlyActuals(fromDate: string, toDate: string): Promise<Map<string, { rns: number; rev: number }>> {
  const shift = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  };
  const { data } = await supabase
    .from('mv_kpi_daily')
    .select('night_date, rooms_sold, rooms_revenue')
    .eq('property_id', PROPERTY_ID)
    .gte('night_date', shift(fromDate))
    .lte('night_date', shift(toDate));
  const out = new Map<string, { rns: number; rev: number }>();
  for (const r of ((data ?? []) as any[])) {
    out.set(String(r.night_date), {
      rns: Number(r.rooms_sold ?? 0),
      rev: Number(r.rooms_revenue ?? 0),
    });
  }
  return out;
}

function bucketRows(
  rows: PaceRow[],
  gran: 'day' | 'week' | 'month',
  stlyByDate: Map<string, { rns: number; rev: number }>,
  fromIso: string,
  toIso: string,
): BucketRow[] {
  const buckets = new Map<string, { rns: number; rev: number; cxl: number; days: number; stlyRn: number; stlyRev: number }>();
  for (const r of rows) {
    const d = new Date(r.night_date);
    let key: string;
    if (gran === 'month') key = r.night_date.slice(0, 7);
    else if (gran === 'week') {
      const dow = d.getUTCDay();
      const diff = (dow + 6) % 7;
      const monday = new Date(d.getTime() - diff * 86400000);
      key = monday.toISOString().slice(0, 10);
    } else key = r.night_date;
    const cur = buckets.get(key) ?? { rns: 0, rev: 0, cxl: 0, days: 0, stlyRn: 0, stlyRev: 0 };
    cur.rns += Number(r.confirmed_rooms) || 0;
    cur.rev += Number(r.confirmed_revenue) || 0;
    cur.cxl += Number(r.cancelled_rooms) || 0;
    cur.days += 1;
    // shift this night to STLY
    const shifted = (() => {
      const t = new Date(r.night_date + 'T00:00:00Z');
      t.setUTCFullYear(t.getUTCFullYear() - 1);
      return t.toISOString().slice(0, 10);
    })();
    const stly = stlyByDate.get(shifted);
    if (stly) {
      cur.stlyRn += stly.rns;
      cur.stlyRev += stly.rev;
    }
    buckets.set(key, cur);
  }
  return Array.from(buckets.entries()).map(([key, v]) => {
    let cap = 0;
    if (gran === 'month') {
      const monthStart = key + '-01';
      const next = new Date(key + '-01T00:00:00Z');
      next.setUTCMonth(next.getUTCMonth() + 1);
      const monthEnd = new Date(next.getTime() - 86400000).toISOString().slice(0, 10);
      const winFrom = monthStart < fromIso ? fromIso : monthStart;
      const winTo = monthEnd > toIso ? toIso : monthEnd;
      cap = capacityRnRange(winFrom, winTo);
    } else if (gran === 'week') {
      const winFrom = key < fromIso ? fromIso : key;
      const weekEnd = new Date(key + 'T00:00:00Z');
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const weTo = weekEnd.toISOString().slice(0, 10) > toIso ? toIso : weekEnd.toISOString().slice(0, 10);
      cap = capacityRnRange(winFrom, weTo);
    } else {
      cap = capacityFor(key);
    }
    return { key, ...v, capacity: cap };
  }).sort((a, b) => a.key.localeCompare(b.key));
}

function fmtMonth(yyyymm: string) {
  const [y, m] = yyyymm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

export default async function PacePage({ searchParams }: { searchParams: SearchParams }) {
  const win = parseWin(searchParams.win);
  const gran = parseGran(searchParams.gran);
  // PBS 2026-05-09: forward `cmp` so the universal CompareSelector reflects
  // the active state. Pace's own STLY proxy still drives compare numbers.
  const period = resolvePeriod({ win, cmp: searchParams.cmp });

  const fromIso = period.from;
  const toIso = period.to;

  const [rows, stlyMap, paceCurve] = await Promise.all([
    getPace(fromIso, toIso),
    getStlyActuals(fromIso, toIso),
    getPaceCurve(30, 30).catch(() => []),
  ]);

  const totalRns = rows.reduce((s, r) => s + (Number(r.confirmed_rooms) || 0), 0);
  const totalRev = rows.reduce((s, r) => s + (Number(r.confirmed_revenue) || 0), 0);
  const totalCxl = rows.reduce((s, r) => s + (Number(r.cancelled_rooms) || 0), 0);
  const adr = totalRns > 0 ? totalRev / totalRns : 0;
  const capacityRn = capacityRnRange(fromIso, toIso);
  const occ = capacityRn > 0 ? (totalRns / capacityRn) * 100 : 0;
  const cxlRate = totalRns + totalCxl > 0 ? (totalCxl / (totalRns + totalCxl)) * 100 : 0;

  const buckets = bucketRows(rows, gran, stlyMap, fromIso, toIso);
  const stlyRnTotal = buckets.reduce((s, b) => s + b.stlyRn, 0);
  const stlyRevTotal = buckets.reduce((s, b) => s + b.stlyRev, 0);
  const stlyPctOverall = stlyRnTotal > 0 ? (totalRns / stlyRnTotal) * 100 : 0;

  // PBS 2026-05-09: compare numbers for KpiBox `compare` prop. Pace doesn't
  // use f_overview_kpis, so we derive deltas from the STLY proxy (mv_kpi_daily
  // shifted -1y). Only meaningful when cmp != none and STLY had coverage.
  const cmpActive = period.cmp !== 'none' && stlyRnTotal > 0;
  const cmpLabel = period.cmpLabel ? period.cmpLabel.replace(/^vs\s+/i, '') : '';
  const stlyAdr = stlyRnTotal > 0 ? stlyRevTotal / stlyRnTotal : 0;
  const stlyOcc = capacityRn > 0 ? (stlyRnTotal / capacityRn) * 100 : 0;
  const cmpRns = cmpActive ? totalRns - stlyRnTotal : null;
  const cmpRev = cmpActive ? totalRev - stlyRevTotal : null;
  const cmpAdrDelta = cmpActive ? adr - stlyAdr : null;
  const cmpOccDelta = cmpActive ? occ - stlyOcc : null;

  const granLabels: Record<string, string> = { day: 'Day', week: 'Week', month: 'Month' };

  const formatLabel = (key: string) => (gran === 'month' ? fmtMonth(key) : key.slice(5));

  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string, signal?: string) => ({ kind, title, signal, dept: 'revenue' as const });

  return (
    <Page
      eyebrow="Revenue · Pace"
      title={<>What&apos;s <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>on the books</em> ahead.</>}
      subPages={REVENUE_SUBPAGES}
    >
      <style>{`
        .filter-btn:not(.fwd):not([href*="seg="]):not([href*="cmp="]):not([href*="cap="]) {
          opacity: 0.35;
          pointer-events: none;
        }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={totalRns} unit="count" label="OTB room nights"
          compare={cmpRns != null ? { value: cmpRns, unit: 'count', period: cmpLabel } : undefined}
          tooltip="Sum of confirmed room-nights on the books for the forward window. Source: pace_otb (Cloudbeds)." />
        <KpiBox value={totalRev} unit="usd"   label="OTB revenue"
          compare={cmpRev != null ? { value: cmpRev, unit: 'usd', period: cmpLabel } : undefined}
          tooltip="Confirmed forward revenue (USD) for this window. Source: pace_otb." />
        <KpiBox value={adr} unit="usd"        label="OTB ADR"
          compare={cmpAdrDelta != null ? { value: cmpAdrDelta, unit: 'usd', period: cmpLabel } : undefined}
          tooltip="OTB revenue ÷ OTB room-nights. Reflects price already locked in." />
        <KpiBox value={occ} unit="pct"        label="OTB occupancy"
          compare={cmpOccDelta != null ? { value: cmpOccDelta, unit: 'pp', period: cmpLabel } : undefined}
          tooltip="OTB room-nights ÷ capacity room-nights × 100." />
        <KpiBox value={cxlRate} unit="pct"    label="Cancel rate"     tooltip="Cancelled reservations ÷ total reservations × 100, for this forward window." />
        <KpiBox value={stlyPctOverall} unit="pct" label="vs STLY"     tooltip="OTB this window vs same time last year (% change)." />
      </div>

      {/* Canonical period chooser + granularity dropdown — under the KPI tile row. */}
      <PeriodSelectorRow
        basePath="/revenue/pace"
        win={period.win}
        cmp={period.cmp}
        includeForward
        preserve={{ gran }}
        rightSlot={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="t-eyebrow">GRANULARITY</span>
            {(['day', 'week', 'month'] as const).map((g) => {
              const active = g === gran;
              const params = new URLSearchParams();
              if (win !== 'next90') params.set('win', win);
              if (g !== 'month') params.set('gran', g);
              const href = `/revenue/pace${params.toString() ? '?' + params.toString() : ''}`;
              return (
                <a
                  key={g}
                  href={href}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: '1px solid var(--paper-deep)',
                    background: active ? 'var(--moss)' : 'var(--paper-warm)',
                    color: active ? 'var(--paper-warm)' : 'var(--ink-soft)',
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-extra)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  {granLabels[g]}
                </a>
              );
            })}
          </div>
        }
      />

      <Panel title="Pace curves & buckets" eyebrow="hero" actions={<ArtifactActions context={ctx('panel', 'Pace curves & buckets')} />}>
        <PaceGraphs paceCurve={paceCurve} buckets={buckets} formatLabel={formatLabel} />
      </Panel>

      <div style={{ height: 14 }} />

      <Panel
        title={`Pace by stay-bucket · ${buckets.length} ${gran}s`}
        eyebrow="v_otb_pace · mv_kpi_daily"
        actions={<ArtifactActions context={ctx('table', `Pace by stay-bucket · ${gran}`)} />}
      >
        <PaceBucketsTable rows={buckets} gran={gran} />
      </Panel>
    </Page>
  );
}
