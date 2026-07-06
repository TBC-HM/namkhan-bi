// app/operations/overview/page.tsx
// PBS 2026-07-07 late evening: Operations Overview is a REAL dept summary — not
// a link farm. Departments and Suppliers are top-level tabs, not sub-cards here.
// Shows live headline KPIs (in-house · arrivals · covers · capture rate) and 4
// domain summary cards (F&B / Spa / Activities / Retail) pulled from gold views.

import { DashboardPage, Container, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface LiveRow {
  in_house: number | null;
  arriving_today: number | null;
  departing_today: number | null;
  otb_next_90d: number | null;
}
interface FnbRow { covers_last_30d: number | null; capture_rate_pct: number | null; }
interface SpaRow { tickets_last_30d: number | null; capture_rate_pct: number | null; }
interface ActRow { tickets_last_30d: number | null; capture_rate_pct: number | null; }

export default async function OperationsOverviewPage() {
  const cfg = DEPT_CFG.operations;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/operations/overview',
  }));

  const sb = getSupabaseAdmin();
  const results = await Promise.allSettled([
    sb.from('v_overview_live').select('in_house, arriving_today, departing_today, otb_next_90d').eq('property_id', PROPERTY_ID).maybeSingle(),
    sb.from('v_fnb_snapshot').select('covers_last_30d, capture_rate_pct').eq('property_id', PROPERTY_ID).maybeSingle(),
    sb.from('v_spa_snapshot').select('tickets_last_30d, capture_rate_pct').eq('property_id', PROPERTY_ID).maybeSingle(),
    sb.from('v_activities_snapshot').select('tickets_last_30d, capture_rate_pct').eq('property_id', PROPERTY_ID).maybeSingle(),
  ]);

  function pick<T>(idx: number): T | null {
    const r = results[idx];
    if (r.status !== 'fulfilled') return null;
    const v = r.value as { data?: T | null } | null;
    return (v?.data ?? null) as T | null;
  }
  const live = pick<LiveRow>(0);
  const fnb  = pick<FnbRow>(1);
  const spa  = pick<SpaRow>(2);
  const act  = pick<ActRow>(3);

  const tiles: KpiTileProps[] = [
    { label: 'In-house',        value: Number(live?.in_house ?? 0),         size: 'sm' },
    { label: 'Arriving today',  value: Number(live?.arriving_today ?? 0),   size: 'sm' },
    { label: 'Departing today', value: Number(live?.departing_today ?? 0),  size: 'sm' },
    { label: 'OTB · next 90d',  value: Number(live?.otb_next_90d ?? 0),     size: 'sm', footnote: 'room-nights' },
  ];

  return (
    <DashboardPage title="Operations · Overview" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        <Container title="F&B" density="compact">
          <div style={row}><span style={lbl}>Covers · last 30d</span><span style={val}>{fmtNum(fnb?.covers_last_30d)}</span></div>
          <div style={row}><span style={lbl}>Capture rate</span><span style={val}>{fmtPct(fnb?.capture_rate_pct)}</span></div>
        </Container>

        <Container title="Spa" density="compact">
          <div style={row}><span style={lbl}>Tickets · last 30d</span><span style={val}>{fmtNum(spa?.tickets_last_30d)}</span></div>
          <div style={row}><span style={lbl}>Capture rate</span><span style={val}>{fmtPct(spa?.capture_rate_pct)}</span></div>
        </Container>

        <Container title="Activities" density="compact">
          <div style={row}><span style={lbl}>Tickets · last 30d</span><span style={val}>{fmtNum(act?.tickets_last_30d)}</span></div>
          <div style={row}><span style={lbl}>Capture rate</span><span style={val}>{fmtPct(act?.capture_rate_pct)}</span></div>
        </Container>

        <Container title="Rooms" density="compact">
          <div style={row}><span style={lbl}>In-house now</span><span style={val}>{fmtNum(live?.in_house)}</span></div>
          <div style={row}><span style={lbl}>OTB · next 90d</span><span style={val}>{fmtNum(live?.otb_next_90d)}</span></div>
        </Container>
      </div>
    </DashboardPage>
  );
}

function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—';
  return Math.round(Number(v)).toLocaleString('en-US');
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return Number(v).toFixed(0) + '%';
}

const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 };
const lbl: React.CSSProperties = { color: '#5A5A5A' };
const val: React.CSSProperties = { color: '#1B1B1B', fontWeight: 600, fontVariantNumeric: 'tabular-nums' };
