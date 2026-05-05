// app/revenue/compset/_components/scoring/types.ts
// Types for the scoring-settings page. Mirror public.v_compset_scoring_config /
// public.v_compset_scoring_config_audit / public.v_compset_event_types.
//
// dow_scores keys are numeric strings ("0".."6") in the DB (Sun..Sat). The
// editor displays them as Sun..Sat and submits them back as numeric-string
// keyed objects so the existing RPC + view contract stays intact.
//
// lead_time_bands is an ARRAY of bands, each: { label, score, max_days }.
// Bands are sorted ascending by max_days; the implicit min for band[i] is
// (band[i-1].max_days + 1) or 0 for the first row. Validation enforces strict
// ascending max_days.

export type DowScoreKey = '0' | '1' | '2' | '3' | '4' | '5' | '6';
export const DOW_KEYS: DowScoreKey[] = ['0', '1', '2', '3', '4', '5', '6'];
export const DOW_LABELS: Record<DowScoreKey, string> = {
  '0': 'Sun',
  '1': 'Mon',
  '2': 'Tue',
  '3': 'Wed',
  '4': 'Thu',
  '5': 'Fri',
  '6': 'Sat',
};

export type LeadTimeBand = {
  label: string;
  score: number;
  max_days: number;
};

export type ScoringConfigRow = {
  config_id: string;
  version: number;
  is_active: boolean;
  weight_dow: number | string;
  weight_event: number | string;
  weight_lead_time: number | string;
  weight_peak_bonus: number | string;
  dow_scores: Record<string, number>;
  lead_time_bands: LeadTimeBand[];
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  activated_at: string | null;
  retired_at: string | null;
};

export type ScoringConfigAuditRow = {
  audit_id: string;
  config_id: string;
  version: number;
  action: string;
  changed_by: string | null;
  changed_at: string | null;
  reason: string | null;
  diff: Record<string, unknown> | null;
};

export type EventTypeRow = {
  type_code: string;
  display_name: string;
  category: string | null;
  default_demand_score: number | null;
  marketing_lead_days_min: number | null;
  marketing_lead_days_max: number | null;
  scrape_lead_days_min: number | null;
  scrape_lead_days_max: number | null;
  default_source_markets: string[] | null;
  notes: string | null;
};

export type AgentSettingsRow = {
  agent_id: string;
  code: string;
  name: string;
  status: string | null;
  pillar: string | null;
  runtime_settings: Record<string, unknown> | null;
  locked_by_mandate: {
    monthly_budget_usd?: number | null;
    month_to_date_cost_usd?: number | null;
    mandate_rules?: MandateRule[] | null;
  } | null;
};

export type MandateRule = {
  rule_type: string | null;
  applies_to: string | null;
  numeric_value: number | null;
  text_value: string | null;
  unit: string | null;
  severity: 'block' | 'warn' | string | null;
  notes: string | null;
};

// VersionRow + buildVersionRows live here (server-safe) so a server component
// can call them. The 'use client' VersionHistoryTable.tsx imports them but
// can't export server helpers itself.
export type VersionRow = ScoringConfigRow & {
  last_audit_reason: string | null;
  last_audit_action: string | null;
  last_audit_changed_at: string | null;
};

export function buildVersionRows(
  configs: ScoringConfigRow[],
  audits: ScoringConfigAuditRow[],
): VersionRow[] {
  const latestByConfig = new Map<string, ScoringConfigAuditRow>();
  for (const a of audits) {
    const cur = latestByConfig.get(a.config_id);
    if (!cur || (a.changed_at ?? '') > (cur.changed_at ?? '')) {
      latestByConfig.set(a.config_id, a);
    }
  }
  return configs.map((c) => {
    const a = latestByConfig.get(c.config_id);
    return {
      ...c,
      last_audit_reason: a?.reason ?? null,
      last_audit_action: a?.action ?? null,
      last_audit_changed_at: a?.changed_at ?? null,
    };
  });
}
