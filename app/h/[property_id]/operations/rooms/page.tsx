// app/h/[property_id]/operations/rooms/page.tsx
// PBS 2026-07-08 (Helper I) — Donna Rooms ops. Uses kpi.v_kpi_daily (via public bridge)
// for occupancy/ADR/RevPAR, and v_dept_revenue_monthly for monthly rooms revenue.
// EUR currency. Namkhan redirects.

import TenantLink from '@/components/nav/TenantLink';
import { redirect } from 'next/navigation';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { supabase } from '@/lib/supabase';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const fmtEurStr = (n: number) => `€${Math.round(Number(n) || 0).toLocaleString('en-GB')}`;
const fmtInt = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('en-GB')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

const monthLabel = (yyyymm: string): string => {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

function MonthlyBars({ rows, colorRev }: { rows: Array<{ period: string; value: number }>; colorRev: string }) {
  if (rows.length === 0) return <div style={{ padding: 20, fontSize: 13, color: '#5A5A5A' }}>No monthly data.</div>;
  const maxRev = Math.max(...rows.map(r => r.value), 1);
  const barW = 40, gap = 24, chartH = 180, padT = 20, padB = 30;
  const width = rows.length * (barW + gap) + gap;
  return (
    <div style={{ overflowX: 'auto', paddingTop: 8, paddingBottom: 8 }}>
      <svg width={width} height={chartH + padT + padB} style={{ display: 'block' }}>
        {rows.map((r, i) => {
          const x = gap + i * (barW + gap);
          const h = (r.value / maxRev) * chartH;
          const y = padT + chartH - h;
          return (
            <g key={r.period}>
              <rect x={x} y={y} width={barW} height={h} fill={colorRev} />
              <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fontSize="10" fill="#5A5A5A">{monthLabel(r.period)}</text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="#000" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{fmtEurStr(r.value)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface DailyRow { night_date: string; rooms_sold: number; rooms_available: number; adr: number; occupancy_pct: number; revpar: number; rooms_revenue: number; }
function DailyRoomsTable({ rows }: { rows: DailyRow[] }) {
  if (rows.length === 0) return <div style={{ padding: 20, fontSize: 13, color: '#5A5A5A' }}>No daily data.</div>;
  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #000', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#5A5A5A' };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 12, color: '#000', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' };
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #E0E0E0', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' }}>
        <thead><tr><th style={th}>Night</th><th style={thR}>Rooms sold</th><th style={thR}>Avail</th><th style={thR}>Occ %</th><th style={thR}>ADR (€)</th><th style={thR}>RevPAR (€)</th><th style={thR}>Rooms rev (€)</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.night_date}>
              <td style={td}>{String(r.night_date).slice(0, 10)}</td>
              <td style={tdR}>{fmtInt(r.rooms_sold)}</td>
              <td style={tdR}>{fmtInt(r.rooms_available)}</td>
              <td style={tdR}>{fmtPct(r.occupancy_pct)}</td>
              <td style={tdR}>{fmtEurStr(r.adr)}</td>
              <td style={tdR}>{fmtEurStr(r.revpar)}</td>
              <td style={tdR}>{fmtEurStr(r.rooms_revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DonnaRoomsPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/rooms');

  const opPeriodRaw = typeof searchParams.op === 'string' ? searchParams.op : '30d';
  const opPeriod = (['yesterday', '7d', '30d', 'ytd'].includes(opPeriodRaw) ? opPeriodRaw : '30d') as 'yesterday' | '7d' | '30d' | 'ytd';
  const opToday = new Date(); opToday.setUTCHours(0, 0, 0, 0);
  const opToIso = opToday.toISOString().slice(0, 10);
  const opFromIso = (() => {
    const d = new Date(opToday);
    if (opPeriod === 'yesterday') { d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
    if (opPeriod === '7d') { d.setUTCDate(d.getUTCDate() - 6); return d.toISOString().slice(0, 10); }
    if (opPeriod === '30d') { d.setUTCDate(d.getUTCDate() - 29); return d.toISOString().slice(0, 10); }
    return `${opToday.getUTCFullYear()}-01-01`;
  })();
  const opEndIso = opPeriod === 'yesterday'
    ? (() => { const d = new Date(opToday); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })()
    : opToIso;
  const opLabel = opPeriod === 'yesterday' ? 'Yesterday' : opPeriod === '7d' ? 'Last 7 days' : opPeriod === '30d' ? 'Last 30 days' : 'YTD';

  const [dailyResp, monthlyResp] = await Promise.all([
    supabase.from('mv_kpi_daily')
      .select('night_date, rooms_sold, rooms_available, adr, occupancy_pct, revpar, rooms_revenue')
      .eq('property_id', propertyId)
      .gte('night_date', opFromIso).lte('night_date', opEndIso)
      .order('night_date', { ascending: false }).then(r => r),
    supabase.from('v_dept_revenue_monthly')
      .select('period_yyyymm, usali_subdept, folio_revenue, tx_count')
      .eq('property_id', propertyId).eq('usali_dept', 'Rooms')
      .order('period_yyyymm', { ascending: true }).then(r => r),
  ]);

  type MonthRow = { period_yyyymm: string; usali_subdept: string | null; folio_revenue: number | string; tx_count: number };
  const daily = ((dailyResp.data ?? []) as DailyRow[]);
  const monthly = (monthlyResp.data ?? []) as MonthRow[];

  // Aggregate operating snapshot from daily
  const roomsSold = daily.reduce((s, r) => s + Number(r.rooms_sold ?? 0), 0);
  const roomsAvail = daily.reduce((s, r) => s + Number(r.rooms_available ?? 0), 0);
  const roomsRev = daily.reduce((s, r) => s + Number(r.rooms_revenue ?? 0), 0);
  const occPct = roomsAvail > 0 ? (roomsSold / roomsAvail) * 100 : 0;
  const adr = roomsSold > 0 ? roomsRev / roomsSold : 0;
  const revpar = roomsAvail > 0 ? roomsRev / roomsAvail : 0;

  // Monthly aggregates
  const monthMap: Record<string, { transient: number; upsell: number; other: number; tx: number }> = {};
  for (const r of monthly) {
    const m = String(r.period_yyyymm);
    if (!monthMap[m]) monthMap[m] = { transient: 0, upsell: 0, other: 0, tx: 0 };
    const rev = Number(r.folio_revenue ?? 0);
    if (r.usali_subdept === 'Transient') monthMap[m].transient += rev;
    else if (r.usali_subdept === 'Upsell') monthMap[m].upsell += rev;
    else monthMap[m].other += rev;
    monthMap[m].tx += Number(r.tx_count ?? 0);
  }
  const monthRows = Object.entries(monthMap)
    .map(([period, v]) => ({ period, value: v.transient + v.upsell + v.other, transient: v.transient, upsell: v.upsell, tx: v.tx }))
    .sort((a, b) => a.period.localeCompare(b.period));
  const totalRev = monthRows.reduce((s, r) => s + r.value, 0);
  const totalUpsell = monthRows.reduce((s, r) => s + r.upsell, 0);

  const row1: KpiTileProps[] = [
    { label: 'Rooms revenue', value: roomsRev, currency: 'EUR', footnote: `PMS · ${opLabel}`, status: roomsRev > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Rooms sold', value: fmtInt(roomsSold), footnote: `${opLabel}`, status: roomsSold > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Occupancy', value: fmtPct(occPct), footnote: `${fmtInt(roomsSold)}/${fmtInt(roomsAvail)} · ${opLabel}`, status: occPct >= 60 ? 'green' : occPct >= 40 ? 'amber' : 'grey', size: 'sm' },
    { label: 'ADR', value: adr, currency: 'EUR', footnote: `rev ÷ rn · ${opLabel}`, status: 'grey', size: 'sm' },
    { label: 'RevPAR', value: revpar, currency: 'EUR', footnote: `rev ÷ avail · ${opLabel}`, status: 'grey', size: 'sm' },
    { label: 'Available rn', value: fmtInt(roomsAvail), footnote: opLabel, status: 'grey', size: 'sm' },
  ];

  const opPillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: active ? '#FFFFFF' : '#000', background: active ? '#000' : 'transparent',
    border: 'none', cursor: 'pointer', fontWeight: active ? 600 : 500, textDecoration: 'none',
  });
  const opPills = (
    <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 4, border: '1px solid #E0E0E0', overflow: 'hidden' }}>
      {(['yesterday', '7d', '30d', 'ytd'] as const).map((p) => (
        <TenantLink key={p} href={`?op=${p}`} style={opPillStyle(opPeriod === p)}>
          {p === 'yesterday' ? 'Yesterday' : p === '7d' ? '7d' : p === '30d' ? '30d' : 'YTD'}
        </TenantLink>
      ))}
    </div>
  );
  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/rooms') }));
  const summaryStyle: React.CSSProperties = { cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em' };

  return (
    <DashboardPage title="Rooms" subtitle={`Operations · Rooms · Mews-derived PMS · Donna Portals · property_id=${propertyId}`} tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle={`kpi.v_kpi_daily · rooms KPIs · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <Container title="Monthly rooms revenue" subtitle={`Cloudbeds folio (rooms dept) · all-time total ${fmtEurStr(totalRev)} · Upsell ${fmtEurStr(totalUpsell)}`} density="compact">
          <MonthlyBars rows={monthRows} colorRev="#1c4d3a" />
        </Container>

        <details open>
          <summary style={summaryStyle}>Daily rooms KPIs · {opLabel} ({daily.length} rows)</summary>
          <div style={{ marginTop: 10 }}><DailyRoomsTable rows={daily} /></div>
        </details>
      </div>
    </DashboardPage>
  );
}
