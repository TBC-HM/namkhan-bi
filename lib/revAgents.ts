// lib/revAgents.ts
// D11: defensive fetch of revenue-related agents from Supabase governance schema.
// If RLS blocks anon key OR governance.* isn't readable, returns null and the mockup placeholders stay.

import { supabase } from './supabase';

export interface AgentRow {
  code: string;
  name: string;
  pillar: string;
  status: string;            // running / idle / paused
  schedule_human: string | null;
  prompt_version: string | null;
  est_monthly_cost_usd: number | null;
}

/**
 * Best-effort fetch of revenue-pillar agents.
 * Returns null on any error — caller falls back to mockup placeholder UI.
 */
export async function getRevenueAgents(): Promise<AgentRow[] | null> {
  try {
    // Try the direct view first
    const { data, error } = await supabase
      .schema('governance')
      .from('agents')
      .select('code, name, pillar, status, schedule_human')
      .eq('pillar', 'revenue');

    if (error || !data) return null;
    return (data as AgentRow[]) ?? null;
  } catch {
    return null;
  }
}
