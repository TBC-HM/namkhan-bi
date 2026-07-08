// app/revenue/rateplans/dead/page.tsx
// 2026-05-22 — ported off legacy <Page>/<Panel>/<KpiBox> shell onto primitives.
// Property-aware via propertyId prop (default = Namkhan). Reads from the
// cross-property bridges (v_rate_plans_all + v_reservations_unified) so Donna
// gets her own dead-plan list when accessed via /h/1000001/revenue/rateplans/dead.

import TenantLink from '@/components/nav/TenantLink';
import {
  DashboardPage, Container, KpiTile, Chart,
  type DashboardTab, type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { PROPERTY_ID, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  propertyId?: number;
}

interface DeadRatePlan {
  rate_id: number;
  rate_name: string;
  rate_type: string | null;
  is_active: boolean;
  updated_at: string | null;
}

interface UsedRatePlan {
  rate_plan: string;
  bookings: number;
  last_booking: string | null;
}

function ageDays(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

export default async function DeadRatePlansPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const isNamkhan = pid === PROPERTY_ID;
  const basePath = isNamkhan ? '/revenue/rateplans' : `/h/${pid}/revenue/rateplans`;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/rateplans'),
  }));

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

  const [plansRes, resRes] = await Promise.all([
    supabase.from('v_rate_plans_all')
      .select('rate_id, rate_name, rate_type, is_active, updated_at')
      .eq('property_id', pid)
      .eq('is_active', true)
      .order('rate_name')
      .limit(500),
    supabase.from('v_reservations_unified')
      .select('rate_plan, booking_date')
      .eq('property_id', pid)
      .gte('booking_date', ninetyDaysAgo)
      .limit(5000),
  ]);

  const active = ((plansRes.data ?? []) as DeadRatePlan[]);
  const used = new Map<string, UsedRatePlan>();
  for (const r of (resRes.data ?? []) as Array<{ rate_plan: string | null; booking_date: string | null }>) {
    if (!r.rate_plan) continue;
    const cur = used.get(r.rate_plan) ?? { rate_plan: r.rate_plan, bookings: 0, last_booking: null };
    cur.bookings += 1;
    if (r.booking_date && (!cur.last_booking || r.booking_date > cur.last_booking)) cur.last_booking = r.booking_date;
    used.set(r.rate_plan, cur);
  }
  const totalBookings = (resRes.data ?? []).length;

  const deadPlans = active.filter((p) => !used.has(p.rate_name));
  const livePlans = active.filter((p) => used.has(p.rate_name));
  const deadPct = active.length > 0 ? (deadPlans.length / active.length) * 100 : 0;
  deadPlans.sort((a, b) => (a.updated_at ?? '').localeCompare(b.updated_at ?? ''));

  // KPI tiles
  const tiles: KpiTileProps[] = [
    { label: 'Active plans',    value: active.length,       size: 'sm', footnote: 'is_active = true · cross-property bridge',
      status: active.length > 0 ? 'green' : 'grey' },
    { label: 'Dead (90d)',      value: deadPlans.length,    size: 'sm', footnote: '0 reservations in 90d',
      status: deadPlans.length === 0 ? 'green' : deadPlans.length <= 5 ? 'amber' : 'red' },
    { label: 'Dead share',      value: `${deadPct.toFixed(1)}%`, size: 'sm', footnote: 'dead ÷ active',
      status: deadPct <= 20 ? 'green' : deadPct <= 50 ? 'amber' : 'red' },
    { label: 'Booked plans',    value: livePlans.length,    size: 'sm', footnote: '≥ 1 booking in 90d',
      status: livePlans.length > 0 ? 'green' : 'grey' },
    { label: 'Bookings (90d)',  value: totalBookings,       size: 'sm', footnote: 'total reservations · 90d window',
      status: 'grey' },
  ];

  // Tables — pre-formatted strings, no functions cross primitives
  const deadRows = deadPlans.map((p) => ({
    plan:        p.rate_name,
    type:        p.rate_type ?? '—',
    last_seen:   ageDays(p.updated_at) != null ? `${ageDays(p.updated_at)}d ago` : '—',
    actions:     `${basePath}?rate_id=${p.rate_id}`,
    plan_name:   p.rate_name,
    rate_id:     String(p.rate_id),
  }));
  const deadCols: ChartSeries[] = [
    { key: 'type',      label: 'Type' },
    { key: 'last_seen', label: 'Last updated' },
  ];

  const liveRowsRaw = livePlans
    .map((p) => ({ ...p, ...used.get(p.rate_name)! }))
    .sort((a, b) => b.bookings - a.bookings);
  const liveRows = liveRowsRaw.map((p) => ({
    plan:         p.rate_name,
    type:         p.rate_type ?? '—',
    bookings:     p.bookings.toLocaleString(),
    last_booking: p.last_booking ?? '—',
  }));
  const liveCols: ChartSeries[] = [
    { key: 'type',         label: 'Type' },
    { key: 'bookings',     label: 'Bookings (90d)' },
    { key: 'last_booking', label: 'Last booking' },
  ];

  const chatHref = isNamkhan ? '/revenue/legacy' : `/h/${pid}/revenue/legacy`;

  return (
    <DashboardPage
      title="Revenue · Dead rate plans"
      subtitle={`Plans with 0 bookings in 90d · ${active.length} active${deadPlans.length > 0 ? ` · ${deadPlans.length} dead` : ''}`}
      tabs={tabs}
      action={
        <TenantLink href={basePath} style={primaryBtnStyle}>{`← Back to Rate plans`}</TenantLink>
      }
    >
      <div style={fullRow}>
        <Container title="Dead plans · headline" subtitle="active · dead · booked · 90d bookings" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      <div style={fullRow}>
        <Container
          title="Plans with zero bookings in the last 90 days"
          subtitle={`${deadPlans.length} dead · sorted by oldest update first`}
        >
          {deadPlans.length === 0 ? (
            <div style={emptyStyle}>
              Every active rate plan has produced at least one reservation in the last 90 days. Nothing to clean up.
            </div>
          ) : (
            <>
              <Chart variant="table" data={deadRows} xKey="plan" series={deadCols}
                empty={{ title: 'No dead plans' }} />
              <div style={ctaHintStyle}>
                Plans listed above are <strong>active but unused</strong>. Decision points: deactivate in the PMS
                or re-promote via a channel push. To discuss any single plan with Vector,{' '}
                <TenantLink href={chatHref} style={chatLinkStyle}>open the chat</TenantLink> and paste the plan name.
              </div>
            </>
          )}
        </Container>
      </div>

      <div style={fullRow}>
        <Container
          title="Plans booked in the last 90 days"
          subtitle={`${livePlans.length} live · sorted by bookings desc`}
        >
          {livePlans.length === 0 ? (
            <div style={emptyStyle}>No active rate plans have produced bookings in 90 days.</div>
          ) : (
            <Chart variant="table" data={liveRows} xKey="plan" series={liveCols}
              empty={{ title: 'No live plans' }} />
          )}
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Source" subtitle="data lineage" density="compact" status="grey">
          <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
            <code>public.v_rate_plans_all</code> (UNION of <code>pms.rate_plans_cb</code> + <code>pms.rate_plans_mews</code>)
            joined to <code>public.v_reservations_unified.rate_plan</code> over a 90-day window. To deactivate a plan,
            use the PMS rate manager — this dashboard is read-only.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: 24, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic', textAlign: 'center', fontSize: 12,
};
const ctaHintStyle: React.CSSProperties = {
  marginTop: 12, padding: '10px 14px', background: 'var(--bg, #F4EFE2)', borderRadius: 4,
  fontSize: 12, lineHeight: 1.5, color: 'var(--ink, #1B1B1B)',
};
const chatLinkStyle: React.CSSProperties = { color: 'var(--brass, #B8542A)', fontWeight: 600 };
const primaryBtnStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4, background: 'var(--paper, #FFFFFF)',
  border: '1px solid var(--hairline, #E6DFCC)', color: 'var(--ink, #1B1B1B)', textDecoration: 'none',
};
