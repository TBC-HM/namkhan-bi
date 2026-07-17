// app/h/[property_id]/settings/guardrails/page.tsx
// PBS 2026-07-07: property-scoped mirror of /settings/guardrails.
// v2 2026-07-07 evening: adds live/data-missing/not-wired status dot per row
// via lib/rules/wiring.ts + server-side data probes.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import GuardrailsClient from '@/app/settings/guardrails/_components/GuardrailsClient';
import { computeRuleStatus, type ProbeResult, type RuleStatus } from '@/lib/rules/wiring';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

interface GuardrailRow {
  id: number;
  property_id: number;
  domain: string;
  rule_key: string;
  threshold_kind: string;
  threshold_val: number | string;
  active: boolean;
  is_dynamic: boolean;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

async function runProbes(propertyId: number): Promise<Record<string, ProbeResult>> {
  const sb = getSupabaseAdmin();
  const [kpi, reviews, campaigns, campaignRcpt, mvGuest, vDirectory] = await Promise.all([
    sb.rpc('fn_revenue_hod_today_kpi', { p_property_id: propertyId }),
    sb.from('mkt_reviews').select('id', { head: true, count: 'exact' }).eq('property_id', propertyId),
    sb.from('campaigns').select('id', { head: true, count: 'exact' }).eq('property_id', propertyId),
    sb.from('campaign_recipients').select('id', { head: true, count: 'exact' }).eq('property_id', propertyId),
    sb.from('mv_guest_profile').select('property_id', { head: true, count: 'exact' }).eq('property_id', propertyId),
    sb.from('v_directory_full').select('property_id', { head: true, count: 'exact' }).eq('property_id', propertyId),
  ]);

  function probe(res: { data?: unknown; error?: { message: string } | null; count?: number | null }, label: string): ProbeResult {
    if (res.error) return { ok: true, reason: `probe unavailable (${res.error.message})` };
    if (res.count == null) return { ok: true, reason: 'count unavailable · optimistic' };
    if (res.count === 0)  return { ok: false, reason: `${label} has 0 rows for this property` };
    return { ok: true };
  }

  const results: Record<string, ProbeResult> = {};
  const kpiRow = ((kpi.data ?? []) as unknown as Array<Record<string, unknown>>)[0];
  const okKpi = !kpi.error && kpiRow != null;
  results['fn_revenue_hod_today_kpi'] = okKpi ? { ok: true } : { ok: false, reason: kpi.error?.message ?? 'RPC returned no row' };
  results['getPulseTodayPickup'] = okKpi ? { ok: true } : { ok: false, reason: 'PMS pipeline unreachable (KPI RPC failed)' };
  results['pms.v_reservations']  = okKpi ? { ok: true } : { ok: false, reason: 'PMS pipeline unreachable (KPI RPC failed)' };
  results['mkt_reviews']         = probe(reviews,      'mkt_reviews');
  results['campaigns']           = probe(campaigns,    'campaigns');
  results['campaign_recipients'] = probe(campaignRcpt, 'campaign_recipients');
  results['mv_guest_profile']    = probe(mvGuest,      'mv_guest_profile');
  results['v_directory_full']    = probe(vDirectory,   'v_directory_full');
  return results;
}

export default async function PropertyGuardrailsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('guardrails')
    .select('id, property_id, domain, rule_key, threshold_kind, threshold_val, active, is_dynamic, notes, updated_at, updated_by')
    .eq('property_id', propertyId)
    .order('domain', { ascending: true })
    .order('rule_key', { ascending: true });

  const rows: GuardrailRow[] = (data as GuardrailRow[]) ?? [];

  const probeResults = await runProbes(propertyId).catch(() => ({} as Record<string, ProbeResult>));
  const statusById: Record<number, RuleStatus> = {};
  for (const r of rows) statusById[r.id] = computeRuleStatus(r.domain, r.rule_key, r.active, probeResults);

  const total = rows.length;
  const activeCount = rows.filter(r => r.active).length;
  const liveCount = rows.filter(r => statusById[r.id]?.status === 'live').length;
  const missingCount = rows.filter(r => {
    const s = statusById[r.id]?.status;
    return r.active && (s === 'data_missing' || s === 'not_wired');
  }).length;

  const lastUpdatedRow = rows.reduce<GuardrailRow | null>((acc, r) => {
    if (!r.updated_at) return acc;
    if (!acc || !acc.updated_at) return r;
    return new Date(r.updated_at) > new Date(acc.updated_at) ? r : acc;
  }, null);
  const byDomain = new Map<string, number>();
  for (const r of rows) byDomain.set(r.domain, (byDomain.get(r.domain) ?? 0) + 1);
  let biggestDomain = '—';
  let biggestCount = 0;
  for (const [d, c] of byDomain.entries()) {
    if (c > biggestCount) { biggestDomain = d; biggestCount = c; }
  }

  const lastUpdatedLabel = lastUpdatedRow?.updated_at
    ? new Date(lastUpdatedRow.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    : '—';
  const lastUpdatedRuleLabel = lastUpdatedRow
    ? `${lastUpdatedRow.domain} · ${lastUpdatedRow.rule_key}`
    : '—';

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Settings · Guardrails"
        tabs={[
          { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
          { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails`, active: true },
          { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
        ]}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <GuardrailsClient
            rows={rows}
            statusById={statusById}
            stats={{
              total,
              activeCount,
              liveCount,
              missingCount,
              lastUpdatedLabel,
              lastUpdatedRuleLabel,
              biggestDomain,
              biggestCount,
            }}
          />
        </div>
      </DashboardPage>
    </div>
  );
}