// app/sales/page.tsx
// PBS #204 — Sales HoD landing on shared primitive.
// PBS 2026-07-07 — evaluate sales rules server-side + pass insights to HodLanding.
// Sales brief A3 (2026-07-30) — counters read public.v_sales_inquiries (bridge over
// sales.inquiries; the old 'sales_inquiries' relation never existed → silent 0s),
// and hardcoded cfg kpiTiles are replaced with live-derived tiles (static fallback
// only when a source query fails).

import HodLanding from '@/app/_components/HodLanding';
import { type KpiTileProps } from '@/app/(cockpit)/_design';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { evaluateSalesRules, type SalesContext, type SalesTargets } from '@/lib/rules/sales';

export const dynamic = 'force-dynamic';

async function buildSalesContext(propertyId: number): Promise<SalesContext> {
  const sb = getSupabaseAdmin();
  const currency = propertyId === 1000001 ? '€' : '$';

  // Guardrail thresholds
  const targets: SalesTargets = {};
  try {
    const { data } = await sb
      .from('guardrails')
      .select('rule_key, threshold_val')
      .eq('property_id', propertyId).eq('domain', 'sales').eq('active', true);
    for (const g of (data ?? []) as Array<{ rule_key: string; threshold_val: number | string }>) {
      const n = typeof g.threshold_val === 'string' ? Number(g.threshold_val) : g.threshold_val;
      if (!Number.isFinite(n)) continue;
      if (g.rule_key === 'inquiry_response_hours') targets.inquiry_response_hours = n;
      else if (g.rule_key === 'conversion_rate') targets.conversion_rate = n;
      else if (g.rule_key === 'cost_per_lead_max') targets.cost_per_lead_max = n;
      else if (g.rule_key === 'group_lead_time_days') targets.group_lead_time_days = n;
    }
  } catch { /* ignore */ }

  // Live inquiry counters via the PostgREST bridge view (L5).
  let openInquiries = 0;
  let oldestInquiryHours: number | null = null;
  try {
    const { count } = await sb
      .from('v_sales_inquiries')
      .select('id', { head: true, count: 'exact' })
      .eq('property_id', propertyId)
      .in('status', ['open', 'new', 'pending']);
    openInquiries = count ?? 0;
    if (openInquiries > 0) {
      const { data: oldest } = await sb
        .from('v_sales_inquiries')
        .select('created_at')
        .eq('property_id', propertyId)
        .in('status', ['open', 'new', 'pending'])
        .order('created_at', { ascending: true })
        .limit(1);
      const iso = (oldest?.[0] as { created_at?: string } | undefined)?.created_at;
      if (iso) oldestInquiryHours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
    }
  } catch { /* bridge missing = leave silent */ }

  return {
    currencySymbol: currency,
    openInquiries,
    oldestInquiryHours,
    inquiryConversionPct: null,
    costPerLead: null,
    avgGroupLeadTime: null,
    targets,
  };
}

// Live KPI tiles (brief scope 2): inbox / leads / proposals / accounts from real
// tables instead of the hardcoded cfg defaults ("INBOX 12", "WIN % 34%").
async function buildLiveTiles(propertyId: number, openInquiries: number): Promise<KpiTileProps[] | undefined> {
  const sb = getSupabaseAdmin();
  try {
    const [leadsRes, proposalsRes, accountsRes] = await Promise.all([
      sb.from('v_leads').select('id', { head: true, count: 'exact' }).eq('property_id', propertyId),
      sb.schema('sales').from('proposals').select('id', { head: true, count: 'exact' }).eq('property_id', propertyId),
      sb.schema('sales').from('accounts').select('id', { head: true, count: 'exact' }).eq('property_id', propertyId),
    ]);
    return [
      { label: 'OPEN INQUIRIES', value: String(openInquiries), size: 'sm', footnote: 'live · v_sales_inquiries' },
      { label: 'LEADS', value: String(leadsRes.count ?? 0), size: 'sm', footnote: 'pipeline total' },
      { label: 'PROPOSALS', value: String(proposalsRes.count ?? 0), size: 'sm', footnote: 'all statuses' },
      { label: 'ACCOUNTS', value: String(accountsRes.count ?? 0), size: 'sm', footnote: 'B2B partner book' },
    ];
  } catch {
    return undefined; // fall back to cfg static tiles
  }
}

export default async function SalesPage() {
  const pid = PROPERTY_ID;
  const ctx = await buildSalesContext(pid);
  const insights = evaluateSalesRules(ctx);
  const liveTiles = await buildLiveTiles(pid, ctx.openInquiries);

  const activeTargets = Object.entries(ctx.targets)
    .map(([k, v]) => `${k}=${v}`).join(' · ') || 'no DB targets · using fallback defaults';

  return (
    <HodLanding
      slug="sales"
      liveTiles={liveTiles}
      conclusions={{
        insights,
        title: 'CONCLUSIONS · sales funnel · inquiries · conversion',
        subtitle: `Live: ${ctx.openInquiries} open inquiries · DB targets: ${activeTargets}`,
      }}
    />
  );
}
