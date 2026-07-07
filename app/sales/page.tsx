// app/sales/page.tsx
// PBS #204 — Sales HoD landing on shared primitive.
// PBS 2026-07-07 — evaluate sales rules server-side + pass insights to HodLanding.

import HodLanding from '@/app/_components/HodLanding';
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

  // Live inquiry counters — best-effort. Any table miss just leaves rules silent.
  let openInquiries = 0;
  let oldestInquiryHours: number | null = null;
  try {
    const { count } = await sb
      .from('sales_inquiries')
      .select('id', { head: true, count: 'exact' })
      .eq('property_id', propertyId)
      .in('status', ['open', 'new', 'pending']);
    openInquiries = count ?? 0;
    if (openInquiries > 0) {
      const { data: oldest } = await sb
        .from('sales_inquiries')
        .select('created_at')
        .eq('property_id', propertyId)
        .in('status', ['open', 'new', 'pending'])
        .order('created_at', { ascending: true })
        .limit(1);
      const iso = (oldest?.[0] as { created_at?: string } | undefined)?.created_at;
      if (iso) oldestInquiryHours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
    }
  } catch { /* table missing = leave silent */ }

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

export default async function SalesPage() {
  const pid = PROPERTY_ID;
  const ctx = await buildSalesContext(pid);
  const insights = evaluateSalesRules(ctx);

  const activeTargets = Object.entries(ctx.targets)
    .map(([k, v]) => `${k}=${v}`).join(' · ') || 'no DB targets · using fallback defaults';

  return (
    <HodLanding
      slug="sales"
      conclusions={{
        insights,
        title: 'CONCLUSIONS · sales funnel · inquiries · conversion',
        subtitle: `Live: ${ctx.openInquiries} open inquiries · DB targets: ${activeTargets}`,
      }}
    />
  );
}
