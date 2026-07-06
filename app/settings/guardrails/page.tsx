// app/settings/guardrails/page.tsx
// PBS 2026-07-06 late evening: single-page editor for every guardrail threshold.
// Domains: retention · reputation · newsletter · observations (+ revenue/operations later).
// Reads public.guardrails; writes via public.fn_guardrail_update RPC.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import GuardrailsClient from './_components/GuardrailsClient';

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
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export default async function GuardrailsSettingsPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('guardrails')
    .select('id, property_id, domain, rule_key, threshold_kind, threshold_val, active, notes, updated_at, updated_by')
    .eq('property_id', PROPERTY_ID)
    .order('domain', { ascending: true })
    .order('rule_key', { ascending: true });

  const rows: GuardrailRow[] = (data as GuardrailRow[]) ?? [];

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Settings · Guardrails"
        subtitle="Every rule threshold used by the HoD Conclusions blocks. Edit inline — takes effect on next page render."
      >
        <div style={{ gridColumn:'1 / -1' }}>
          <GuardrailsClient rows={rows} />
        </div>
      </DashboardPage>
    </div>
  );
}
