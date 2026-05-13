// app/revenue/rateplans/dead/page.tsx
// PBS 2026-05-09: "Check where it makes sense to integrate CTAs … give you an
// example … dead rate plan". Surfaces every active rate plan with zero
// reservations in the last 90 days, with a clear "deactivate or re-promote"
// CTA per row.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { REVENUE_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

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

async function getRatePlans(): Promise<{ active: DeadRatePlan[]; used: Map<string, UsedRatePlan>; totalBookings: number }> {
  const sb = getSupabaseAdmin();

  const [plansRes, resRes] = await Promise.all([
    sb.from('rate_plans')
      .select('rate_id,rate_name,rate_type,is_active,updated_at')
      .eq('is_active', true)
      .order('rate_name', { ascending: true })
      .limit(500),
    sb.from('reservations')
      .select('rate_plan,booking_date')
      .gte('booking_date', new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10))
      .limit(5000),
  ]);

  const used = new Map<string, UsedRatePlan>();
  for (const r of (resRes.data ?? []) as Array<{ rate_plan: string | null; booking_date: string | null }>) {
    if (!r.rate_plan) continue;
    const cur = used.get(r.rate_plan) ?? { rate_plan: r.rate_plan, bookings: 0, last_booking: null };
    cur.bookings += 1;
    if (r.booking_date && (!cur.last_booking || r.booking_date > cur.last_booking)) {
      cur.last_booking = r.booking_date;
    }
    used.set(r.rate_plan, cur);
  }

  return {
    active: (plansRes.data ?? []) as DeadRatePlan[],
    used,
    totalBookings: (resRes.data ?? []).length,
  };
}

function ageDays(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function DeadRatePlansPage() {
  const { active, used, totalBookings } = await getRatePlans();

  const deadPlans  = active.filter((p) => !used.has(p.rate_name));
  const livePlans  = active.filter((p) =>  used.has(p.rate_name));
  const deadPct    = active.length > 0 ? (deadPlans.length / active.length) * 100 : 0;

  // Sort dead plans by age (most stale first based on updated_at).
  deadPlans.sort((a, b) => {
    const aDate = a.updated_at ?? '';
    const bDate = b.updated_at ?? '';
    return aDate.localeCompare(bDate);
  });

  return (
    <Page
      eyebrow="Revenue · Rate plans"
      title={<>Dead <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>rate plans</em></>}
      subPages={REVENUE_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={active.length}     unit="count" label="Active plans"      tooltip="Rate plans with is_active = true. Source: public.rate_plans." />
        <KpiBox value={deadPlans.length}  unit="count" label="Dead (90d)"        tooltip="Active plans with zero reservations in the last 90 days." />
        <KpiBox value={deadPct}           unit="pct"   label="Dead share"        tooltip="Dead ÷ active × 100. Each dead plan adds operational + parity risk." />
        <KpiBox value={livePlans.length}  unit="count" label="Booked plans"      tooltip="Active plans with ≥ 1 reservation in the last 90 days." />
        <KpiBox value={totalBookings}     unit="count" label="Bookings (90d)"    tooltip="Total reservations created in the last 90 days." />
      </div>

      <Panel
        title="Plans with zero bookings in the last 90 days"
        eyebrow={`${deadPlans.length} dead`}
        actions={<ArtifactActions context={{ kind: 'panel', title: 'Dead rate plans', dept: 'revenue' }} />}
      >
        {deadPlans.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>
            Every active rate plan has produced at least one reservation in the last 90 days. Nothing to clean up.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Rate plan</th>
                  <th>Type</th>
                  <th className="num">Last updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {deadPlans.map((p) => {
                  const age = ageDays(p.updated_at);
                  return (
                    <tr key={p.rate_id}>
                      <td className="lbl"><strong>{p.rate_name}</strong></td>
                      <td className="lbl text-mute">{p.rate_type ?? '—'}</td>
                      <td className="num">{age != null ? `${age}d ago` : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link href={`/revenue/rateplans?rate_id=${p.rate_id}`} style={S.cta}>review</Link>
                          <Link href={`/cockpit/chat?dept=revenue&q=${encodeURIComponent(`Should I deactivate the rate plan "${p.rate_name}" (rate_id=${p.rate_id})? It has had 0 bookings in 90 days.`)}`} style={S.ctaPrimary}>↗ Ask Vector</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Plans booked in the last 90 days" eyebrow={`${livePlans.length} live`}>
        {livePlans.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>No active rate plans have produced bookings in 90 days.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Rate plan</th>
                  <th>Type</th>
                  <th className="num">Bookings (90d)</th>
                  <th className="num">Last booking</th>
                </tr>
              </thead>
              <tbody>
                {livePlans
                  .map((p) => ({ ...p, ...used.get(p.rate_name)! }))
                  .sort((a, b) => b.bookings - a.bookings)
                  .map((p) => (
                    <tr key={p.rate_id}>
                      <td className="lbl"><strong>{p.rate_name}</strong></td>
                      <td className="lbl text-mute">{p.rate_type ?? '—'}</td>
                      <td className="num">{p.bookings.toLocaleString()}</td>
                      <td className="num">{p.last_booking ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ marginTop: 14, fontSize: 11, color: '#7d7565' }}>
        Source: <code style={{ color: '#a8854a' }}>public.rate_plans</code> joined to{' '}
        <code style={{ color: '#a8854a' }}>public.reservations.rate_plan</code> over a 90-day window. To
        deactivate a plan, use the Cloudbeds rate manager — this dashboard is read-only.
      </div>
    </Page>
  );
}

const S: Record<string, React.CSSProperties> = {
  cta: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700,
    color: 'var(--line-soft)', background: 'transparent',
    border: '1px solid #2a2520', padding: '4px 8px', borderRadius: 3, textDecoration: 'none',
  },
  ctaPrimary: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700,
    color: '#0a0a0a', background: '#a8854a',
    border: '1px solid #2a2520', padding: '4px 8px', borderRadius: 3, textDecoration: 'none',
  },
};
