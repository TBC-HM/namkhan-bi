// app/revenue/pace/page.tsx
// Revenue › Pace — forward-looking on-the-books from public.v_otb_pace.
//
// SR-RM critique: backward windows (Today/7d/30d/90d/YTD/L12M) make NO sense on Pace.
// "OTB last 30 days" is a contradiction — those nights are already actualized.
// Page greys out backward chips via CSS override; only forward chips drive the view.

import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { resolvePeriod, type WindowKey } from '@/lib/period';

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

const ROOM_CAPACITY = 20; // public.rooms count

function bucketRows(rows: PaceRow[], gran: 'day' | 'week' | 'month') {
  const buckets = new Map<string, { rns: number; rev: number; cxl: number; days: number }>();
  for (const r of rows) {
    const d = new Date(r.night_date);
    let key: string;
    if (gran === 'month') {
      key = r.night_date.slice(0, 7);
    } else if (gran === 'week') {
      const dow = d.getUTCDay();
      const diff = (dow + 6) % 7;
      const monday = new Date(d.getTime() - diff * 86400000);
      key = monday.toISOString().slice(0, 10);
    } else {
      key = r.night_date;
    }
    const cur = buckets.get(key) ?? { rns: 0, rev: 0, cxl: 0, days: 0 };
    cur.rns += Number(r.confirmed_rooms) || 0;
    cur.rev += Number(r.confirmed_revenue) || 0;
    cur.cxl += Number(r.cancelled_rooms) || 0;
    cur.days += 1;
    buckets.set(key, cur);
  }
  return Array.from(buckets.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => a.key.localeCompare(b.key));
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

  const rows = await getPace(fromIso, toIso);

  const totalRns = rows.reduce((s, r) => s + (Number(r.confirmed_rooms) || 0), 0);
  const totalRev = rows.reduce((s, r) => s + (Number(r.confirmed_revenue) || 0), 0);
  const totalCxl = rows.reduce((s, r) => s + (Number(r.cancelled_rooms) || 0), 0);
  const adr = totalRns > 0 ? totalRev / totalRns : 0;
  const capacityRn = ROOM_CAPACITY * period.days;
  const occ = capacityRn > 0 ? (totalRns / capacityRn) * 100 : 0;
  const cxlRate = totalRns + totalCxl > 0 ? (totalCxl / (totalRns + totalCxl)) * 100 : 0;

  const buckets = bucketRows(rows, gran);
  const maxRns = Math.max(1, ...buckets.map((b) => b.rns));

  const winLabels: Record<string, string> = {
    next7: 'Next 7d', next30: 'Next 30d', next90: 'Next 90d', next180: 'Next 180d', next365: 'Next 365d',
  };
  const granLabels: Record<string, string> = { day: 'Day', week: 'Week', month: 'Month' };

  return (
    <>
      {/* CSS: grey out backward filter chips on this page */}
      <style>{`
        .filter-btn:not(.fwd):not([href*="seg="]):not([href*="cmp="]):not([href*="cap="]) {
          opacity: 0.35;
          pointer-events: none;
        }
      `}</style>

      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: '#4a4538' }}>Revenue</strong> › Pace
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 30 }}>
        Pace · <em style={{ color: '#a17a4f' }}>{winLabels[win]} · by {granLabels[gran].toLowerCase()}</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>
        Forward on-the-books from <code>public.v_otb_pace</code>. Window <strong>{period.label}</strong> ({fromIso} → {toIso}, {period.days} nights × {ROOM_CAPACITY} rooms = {capacityRn} capacity).
        <br />
        <span style={{ fontSize: 11, color: '#8a8170' }}>
          Backward chips greyed out — pace is forward-looking by definition.
        </span>
      </div>

      {/* Granularity chips */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Granularity</span>
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
                border: '1px solid #d9d2bc',
                background: active ? '#4a4538' : '#fff',
                color: active ? '#fff' : '#4a4538',
                fontSize: 12,
                textDecoration: 'none',
                textTransform: 'capitalize',
              }}
            >
              {g}
            </a>
          );
        })}
        <span style={{ marginLeft: 12, fontSize: 11, color: '#8a8170' }}>
          Forward window selectors are at the top filter strip ↑
        </span>
      </div>

      {/* KPI strip — 6 tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
        <Kpi scope="OTB room nights" value={totalRns.toLocaleString()} sub={`${period.days} nights window`} />
        <Kpi scope="OTB revenue" value={`USD ${(totalRev / 1000).toFixed(1)}k`} sub={`${rows.length} active dates`} />
        <Kpi scope="OTB ADR" value={`USD ${adr.toFixed(0)}`} sub="rev ÷ RNs" />
        <Kpi scope="OTB occupancy" value={`${occ.toFixed(1)}%`} sub={`vs ${capacityRn} capacity`} tone={occ > 70 ? 'up' : occ < 30 ? 'warn' : 'flat'} />
        <Kpi scope="Cancellation rate" value={`${cxlRate.toFixed(1)}%`} sub={`${totalCxl} cancelled RN`} tone={cxlRate > 10 ? 'warn' : 'flat'} />
        <Kpi scope="STLY delta" value="lorem" sub="needs snapshot history" lorem />
      </div>

      {/* Chart: OTB by bucket */}
      <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 17 }}>
            On-the-books by stay-{gran}
          </h2>
          <span style={{ fontSize: 11, color: '#8a8170' }}>{buckets.length} bucket{buckets.length === 1 ? '' : 's'} · max {maxRns} RN</span>
        </div>
        {buckets.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#8a8170', fontSize: 12 }}>
            No on-the-books in this window.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, minHeight: 200, padding: '8px 0', borderBottom: '1px solid #e6dfc9' }}>
            {buckets.map((b) => {
              const h = (b.rns / maxRns) * 180;
              const adrB = b.rns > 0 ? b.rev / b.rns : 0;
              return (
                <div
                  key={b.key}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}
                  title={`${b.key} · ${b.rns} RN · USD ${b.rev.toFixed(0)} · ADR USD ${adrB.toFixed(0)}`}
                >
                  <span style={{ fontSize: 10, color: '#4a4538', marginBottom: 2 }}>{b.rns}</span>
                  <div
                    style={{
                      width: '100%',
                      height: h,
                      background: 'linear-gradient(180deg, #a17a4f 0%, #d4b88e 100%)',
                      borderRadius: '3px 3px 0 0',
                      minHeight: 2,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        {buckets.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {buckets.map((b) => (
              <div key={b.key} style={{ flex: 1, fontSize: 9.5, color: '#8a8170', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {gran === 'month' ? fmtMonth(b.key) : b.key.slice(5)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail table */}
      <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f7f3e7', textAlign: 'left', color: '#8a8170', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>{granLabels[gran]}</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Days</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>OTB RN</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Revenue</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>ADR</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Occ %</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Cancel</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>STLY</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => {
              const adrB = b.rns > 0 ? b.rev / b.rns : 0;
              const cap = b.days * ROOM_CAPACITY;
              const occB = cap > 0 ? (b.rns / cap) * 100 : 0;
              return (
                <tr key={b.key} style={{ borderTop: '1px solid #f0eadb' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                    {gran === 'month' ? fmtMonth(b.key) : b.key}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: '#8a8170' }}>{b.days}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{b.rns}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>USD {b.rev.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: '#8a8170' }}>USD {adrB.toFixed(0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: occB > 70 ? '#1f6f43' : occB < 30 ? '#a83232' : '#4a4538' }}>{occB.toFixed(1)}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: b.cxl > 0 ? '#a83232' : '#8a8170' }}>{b.cxl || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#c5b89a', fontStyle: 'italic' }}>lorem</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#e6f4ec', border: '1px solid #aed6c0', borderRadius: 6, color: '#1f5f3a', fontSize: 11.5 }}>
        <strong>✓ Wired.</strong> Real OTB pace from <code>public.v_otb_pace</code>. KPIs + chart + table all driven by URL <code>?win=</code> + <code>?gran=</code>. Forward windows: Next 7 / 30 / 90 / 180 / 365 (top filter strip). STLY column needs snapshot history table — pending.
      </div>
    </>
  );
}

function Kpi({ scope, value, sub, tone = 'flat', lorem = false }: { scope: string; value: string; sub: string; tone?: 'flat' | 'up' | 'warn' | 'bad'; lorem?: boolean }) {
  const c = tone === 'up' ? '#1f6f43' : tone === 'warn' ? '#a17a4f' : tone === 'bad' ? '#a83232' : '#4a4538';
  return (
    <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{scope}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 500, color: lorem ? '#c5b89a' : c, fontStyle: lorem ? 'italic' : 'normal', margin: '2px 0' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8a8170' }}>{sub}</div>
    </div>
  );
}
