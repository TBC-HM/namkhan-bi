// app/revenue/pace/page.tsx — REDESIGN 2026-05-05 (recovery rewrite)
// compset-style: PageHeader + PaceStatusHeader + PaceGraphs (incl. real pace curve) + KpiBox + PaceTableClient.
//
// SR-RM rule: backward windows make NO sense on Pace. CSS greys backward chips.

import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { capacityFor, capacityRnRange, CAPACITY_PIVOT, CAPACITY_PRE, CAPACITY_POST } from '@/lib/capacity';
import { getPaceCurve } from '@/lib/pulseData';

import PaceStatusHeader from './_components/PaceStatusHeader';
import PaceGraphs, { type BucketRow } from './_components/PaceGraphs';
import PaceBucketsTable from './_components/PaceTableClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PaceRow {
  night_date: string;
  confirmed_rooms: number;
  confirmed_revenue: number;
  cancelled_rooms: number;
}

interface SearchParams { win?: string; gran?: string }

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
  const period = resolvePeriod({ win });

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
  const straddles = fromIso < CAPACITY_PIVOT && toIso >= CAPACITY_PIVOT;
  const stlyCoverage = stlyMap.size;

  const buckets = bucketRows(rows, gran, stlyMap, fromIso, toIso);
  const stlyRnTotal = buckets.reduce((s, b) => s + b.stlyRn, 0);
  const stlyPctOverall = stlyRnTotal > 0 ? (totalRns / stlyRnTotal) * 100 : 0;

  const winLabels: Record<string, string> = {
    next7: 'Next 7d', next30: 'Next 30d', next90: 'Next 90d', next180: 'Next 180d', next365: 'Next 365d',
  };
  const granLabels: Record<string, string> = { day: 'Day', week: 'Week', month: 'Month' };

  const formatLabel = (key: string) => (gran === 'month' ? fmtMonth(key) : key.slice(5));

  return (
    <>
      <style>{`
        .filter-btn:not(.fwd):not([href*="seg="]):not([href*="cmp="]):not([href*="cap="]) {
          opacity: 0.35;
          pointer-events: none;
        }
      `}</style>

      <PageHeader
        pillar="Revenue"
        tab="Pace"
        title={<>What's <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>on the books</em> ahead.</>}
        lede={`${winLabels[win]} · ${period.days} nights · ${totalRns} OTB RN · OCC ${occ.toFixed(1)}% · ADR $${adr.toFixed(0)} · vs STLY ${stlyPctOverall.toFixed(0)}%`}
      />

      <PaceStatusHeader
        windowLabel={winLabels[win]}
        rangeLabel={`${fromIso} → ${toIso}`}
        capacityRn={capacityRn}
        straddles={straddles}
        capacityPivot={CAPACITY_PIVOT}
        capacityPre={CAPACITY_PRE}
        capacityPost={CAPACITY_POST}
        stlySource="actuals_proxy"
        stlyCoverage={stlyCoverage}
        totalDays={period.days}
      />

      <PaceGraphs paceCurve={paceCurve} buckets={buckets} formatLabel={formatLabel} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={totalRns} unit="count" label="OTB room nights" />
        <KpiBox value={totalRev} unit="usd" label="OTB revenue" />
        <KpiBox value={adr} unit="usd" label="OTB ADR" />
        <KpiBox value={occ} unit="pct" label="OTB occupancy" />
        <KpiBox value={cxlRate} unit="pct" label="Cancel rate" />
        <KpiBox value={stlyPctOverall} unit="pct" label="vs STLY" />
      </div>

      {/* Granularity chips */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 18, marginBottom: 8 }}>
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
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
          {buckets.length} bucket{buckets.length === 1 ? '' : 's'} · forward windows in top filter strip ↑
        </span>
      </div>

      <div style={{ marginTop: 6 }}>
        <SectionHead title="Pace by stay-bucket" emphasis={`${buckets.length} ${gran}s`} sub={`${winLabels[win]} · STLY = same dates last year (actuals proxy)`} source="v_otb_pace · mv_kpi_daily" />
        <PaceBucketsTable rows={buckets} gran={gran} />
      </div>
    </>
  );
}

function SectionHead({ title, emphasis, sub, source }: { title: string; emphasis?: string; sub?: string; source?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.1 }}>
          {title}
          {emphasis && <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{emphasis}</span>}
        </div>
        {sub && <div style={{ marginTop: 2, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{sub}</div>}
      </div>
      {source && <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{source}</span>}
    </div>
  );
}
