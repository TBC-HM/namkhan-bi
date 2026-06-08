// app/operations/activities/page.tsx
// PBS 2026-06-09 #136 — Activities ops page (new, B&W primitives).
// Layout mirrors /operations/restaurant + /operations/spa:
//   KPI tiles → operating snapshot, cost/margin → catalog table → top sellers.
// Data sources:
//   public.v_activity_catalog (bridges sales.activity_catalog + content.activities_catalog)

import FilterStrip from '@/components/nav/FilterStrip';
import { DashboardPage, Container, KpiTile, Chart, type KpiTileProps, type DashboardTab, type ChartSeries } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const FX_LAK_PER_USD = 21800;
const fmtUsd  = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtLak  = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('en-US')} LAK`;
const fmtPct  = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;
const lakToUsd = (lak: number | null | undefined) => (Number(lak) || 0) / FX_LAK_PER_USD;

interface ActivityRow {
  activity_id: string;
  property_id: number;
  name: string;
  category: string | null;
  duration_min: number | null;
  group_type: string | null;
  cost_lak: number | null;
  sell_lak: number | null;
  margin_pct: number | null;
  popularity_score: number | null;
  is_signature: boolean | null;
  weather_dependent: boolean | null;
  season_from: string | null;
  season_to: string | null;
  is_active: boolean | null;
  is_complimentary: boolean | null;
  status: string | null;
}

export default async function ActivitiesPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const pid = PROPERTY_ID;

  const { data } = await supabase
    .from('v_activity_catalog')
    .select('*')
    .eq('property_id', pid)
    .order('popularity_score', { ascending: false });

  const rows = (data ?? []) as ActivityRow[];
  const active     = rows.filter((r) => r.is_active !== false && (r.status ?? 'active') === 'active');
  const signature  = active.filter((r) => r.is_signature);
  const comp       = active.filter((r) => r.is_complimentary);
  const paid       = active.filter((r) => !r.is_complimentary && (r.sell_lak ?? 0) > 0);
  const weather    = active.filter((r) => r.weather_dependent);

  // Margin / pricing stats
  const margins  = paid.map((r) => Number(r.margin_pct ?? 0)).filter((x) => x > 0);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
  const avgSellUsd = paid.length ? paid.reduce((s, r) => s + lakToUsd(r.sell_lak), 0) / paid.length : 0;
  const avgCostUsd = paid.length ? paid.reduce((s, r) => s + lakToUsd(r.cost_lak), 0) / paid.length : 0;
  const totalPotentialMarginUsd = paid.reduce((s, r) => s + (lakToUsd(r.sell_lak) - lakToUsd(r.cost_lak)), 0);

  // Category breakdown
  const byCategory = new Map<string, { count: number; signature: number }>();
  for (const r of active) {
    const cat = String(r.category ?? 'OTHER').toUpperCase();
    const cur = byCategory.get(cat) ?? { count: 0, signature: 0 };
    cur.count += 1;
    if (r.is_signature) cur.signature += 1;
    byCategory.set(cat, cur);
  }
  const catRows = Array.from(byCategory.entries())
    .map(([cat, v]) => ({ category: cat, count: v.count, signature: v.signature }))
    .sort((a, b) => b.count - a.count);

  const row1: KpiTileProps[] = [
    { label: 'Active offers',  value: active.length,    footnote: `${rows.length - active.length} archived`,                  status: active.length > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Paid catalogue', value: paid.length,      footnote: `${comp.length} complimentary`,                              status: paid.length > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Signature',      value: signature.length, footnote: 'marked is_signature in sales.activity_catalog',             status: signature.length > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Avg sell',       value: fmtUsd(avgSellUsd), footnote: 'USD · paid offers',                                       status: 'grey', size: 'sm' },
    { label: 'Avg cost',       value: fmtUsd(avgCostUsd), footnote: 'USD · paid offers',                                       status: 'grey', size: 'sm' },
    { label: 'Avg margin %',   value: fmtPct(avgMargin),  footnote: 'target ≥ 50%',
      status: (avgMargin >= 50 ? 'green' : avgMargin >= 30 ? 'amber' : 'red') as 'green'|'amber'|'red', size: 'sm' },
  ];

  const row2: KpiTileProps[] = [
    { label: 'Potential margin / cohort', value: fmtUsd(totalPotentialMarginUsd), footnote: 'sum(sell − cost) · USD',                                status: 'grey', size: 'sm' },
    { label: 'Weather-dependent',         value: weather.length,                  footnote: 'season/weather risk',                                    status: weather.length > 0 ? 'amber' : 'green', size: 'sm' },
    { label: 'Categories',                value: catRows.length,                  footnote: `${catRows[0]?.category ?? '—'} dominates`,               status: 'grey', size: 'sm' },
    { label: 'Avg duration',              value: active.length ? `${Math.round(active.reduce((s, r) => s + Number(r.duration_min || 0), 0) / active.length)} min` : '—', footnote: 'minutes', status: 'grey', size: 'sm' },
    { label: 'Bookings',                  value: '—',                              footnote: 'no GL feed yet · POS integration pending',                status: 'grey', size: 'sm' },
    { label: 'GOP %',                     value: '—',                              footnote: 'P&L surfaces once activity dept maps in QB',              status: 'grey', size: 'sm' },
  ];

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/activities') })) as DashboardTab[];

  // Catalogue table data
  const catalogTable = active.slice(0, 50).map((r) => ({
    name:      r.name,
    category:  String(r.category ?? '—').toLowerCase(),
    duration:  r.duration_min ? `${r.duration_min} min` : '—',
    type:      r.is_complimentary ? 'comp' : 'paid',
    cost:      r.cost_lak ? fmtUsd(lakToUsd(r.cost_lak)) : '—',
    sell:      r.sell_lak ? fmtUsd(lakToUsd(r.sell_lak)) : '—',
    margin:    r.margin_pct != null ? fmtPct(Number(r.margin_pct)) : '—',
    signature: r.is_signature ? '★' : '',
    weather:   r.weather_dependent ? '☔' : '',
  }));
  const catalogCols: ChartSeries[] = [
    { key: 'name',      label: 'Activity' },
    { key: 'category',  label: 'Category' },
    { key: 'duration',  label: 'Duration' },
    { key: 'type',      label: 'Type' },
    { key: 'cost',      label: 'Cost' },
    { key: 'sell',      label: 'Sell' },
    { key: 'margin',    label: 'Margin %' },
    { key: 'signature', label: '★' },
    { key: 'weather',   label: '☔' },
  ];

  // Category breakdown chart
  const catChart = catRows.map((r) => ({ category: r.category, count: r.count, signature: r.signature }));

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em',
  };

  return (
    <DashboardPage
      title={`Activities catalogue · ${period.label}`}
      subtitle="Operations · Activities · live from public.v_activity_catalog"
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle="catalogue size · paid vs complimentary · signature offers" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <Container title="Margin & risk" subtitle="potential margin if entire cohort sells once · weather + seasonal risk" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row2.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <FilterStrip showForward={false} showCompare={false} showSegment={false} liveSource="PMS · live" />

        <Container title="Catalogue by category" subtitle="active offers per category · signature highlighted">
          <Chart variant="bar" data={catChart} xKey="category"
            series={[
              { key: 'count',     label: 'Total active' },
              { key: 'signature', label: 'Signature' },
            ]}
            height={260}
            empty={{ title: 'No active activities', hint: 'sales.activity_catalog has no rows for this property' }}
          />
        </Container>

        <Container title={`Catalogue · ${active.length} active offers`} subtitle="popularity-sorted · cost/sell shown in USD via 21,800 FX">
          <Chart variant="table" data={catalogTable} xKey="name" series={catalogCols} empty={{ title: 'No catalogue rows' }} />
        </Container>

        <details>
          <summary style={summaryStyle}>Booking trend (coming soon)</summary>
          <div style={{ marginTop: 10, padding: 14, fontSize: 13, color: '#5A5A5A', background: '#FAFAFA', border: '1px solid #E0E0E0', borderRadius: 6 }}>
            Activity POS / GL feed not wired yet. When QB maps an `Activities` USALI sub-dept, the same
            DeptTrendChart + PnlGrid pattern as Restaurant/Spa will surface here automatically.
          </div>
        </details>
      </div>
    </DashboardPage>
  );
}
