// app/revenue/rateplans/page.tsx
// D8 (staged, not deployed): wire Rate Plans mockup KPIs to live rate_plans data.
// Plans configured / Active 90d / Dormant / Retire candidates / Avg ADR / Top 5 share.

import tabRateplans from '../_redesign/tabRateplans';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

function patchKpi(html: string, labelStartsWith: string, newValue: string): string {
  const esc = labelStartsWith.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<div class="kpi-label">\\s*${esc}[^<]*(?:<[^>]+>[^<]*</[^>]+>\\s*)*</div>\\s*<div class="kpi-value"[^>]*>)([^<]*)(</div>)`
  );
  return html.replace(re, (_match, p1: string, _p2: string, p3: string) => p1 + newValue + p3);
}

interface PlanRow {
  rate_plan_id?: string;
  name?: string;
  is_active?: boolean;
  last_booking_date?: string | null;
  bookings_90d?: number | null;
  revenue_90d?: number | null;
  bookings_180d?: number | null;
  adr_90d?: number | null;
}

export default async function RatePlansPage() {
  // Try multiple source patterns — table or view — gracefully fall back if neither exists.
  let plans: PlanRow[] = [];
  try {
    const { data } = await supabase
      .from('rate_plans')
      .select('*')
      .eq('property_id', PROPERTY_ID);
    plans = (data ?? []) as PlanRow[];
  } catch {
    plans = [];
  }

  let html = tabRateplans.replace(/class="tab-content"/, 'class="tab-content active"');

  if (plans.length > 0) {
    const total = plans.length;

    const active90 = plans.filter((p) => Number(p.bookings_90d ?? 0) > 0).length;
    const dormant = plans.filter((p) => {
      const b90 = Number(p.bookings_90d ?? 0);
      const b180 = Number(p.bookings_180d ?? 0);
      return b90 === 0 && b180 > 0;
    }).length;
    const retire = plans.filter((p) => Number(p.bookings_180d ?? 0) === 0).length;

    const activePlans = plans.filter((p) => Number(p.bookings_90d ?? 0) > 0);
    const avgAdr =
      activePlans.length > 0
        ? activePlans.reduce((s, p) => s + Number(p.adr_90d ?? 0), 0) / activePlans.length
        : 0;

    const sortedByRev = [...plans].sort(
      (a, b) => Number(b.revenue_90d ?? 0) - Number(a.revenue_90d ?? 0)
    );
    const totalRev = plans.reduce((s, p) => s + Number(p.revenue_90d ?? 0), 0);
    const top5Rev = sortedByRev.slice(0, 5).reduce((s, p) => s + Number(p.revenue_90d ?? 0), 0);
    const top5Pct = totalRev > 0 ? Math.round((top5Rev / totalRev) * 100) : 0;

    html = patchKpi(html, 'Plans configured',     String(total));
    html = patchKpi(html, 'Active 90d',           String(active90));
    html = patchKpi(html, 'Dormant',              String(dormant));
    html = patchKpi(html, 'Retire candidates',    String(retire));
    if (avgAdr > 0) {
      html = patchKpi(html, 'Avg ADR (active)',   fmtMoney(avgAdr, 'USD'));
    }
    html = patchKpi(html, 'Top 5 plans = revenue', `${top5Pct}%`);
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
