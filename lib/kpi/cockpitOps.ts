// lib/kpi/cockpitOps.ts
// tile-truth-wiring (goal 42, 2026-07-29): single-source live values for the
// cockpit/holding ops KPI tiles that were previously HARDCODED in
// lib/dept-cfg/index.ts (AGENTS 65 · DEPLOYS 12 · TICKETS 8 · SLA 94% …).
// A fake number is worse than no number — every consumer of these tiles
// (app/holding/it, app/holding/ceo, app/holding/legal, app/it, app/architect)
// now reads public.v_cockpit_ops_kpis / public.v_legal_cases_summary through
// these helpers and renders '—' when the fetch fails.
//
// SERVER-ONLY: imports lib/supabase (service-role client). Do not import
// from 'use client' files.

import { supabase } from '@/lib/supabase';

export interface CockpitOpsKpis {
  agents_active: number;
  tickets_open: number;
  tickets_awaits_user: number;
  deploys_24h: number;
  /** false when deploy.deployments has no row in 30 days — the ingestion feed is
   *  offline, so deploys_24h=0 would be a FALSE zero. Render '—' instead. */
  deploys_feed_live: boolean;
  /** % of tickets (30d) whose first cockpit_audit_log action landed ≤5 min after creation. Null when no tickets in window. */
  sla_triage_pct: number | null;
  properties_count: number;
}

export interface LegalCasesSummary {
  cases_active: number;
  cases_total: number;
}

/** Live ops KPIs from public.v_cockpit_ops_kpis. Returns null on any error. */
export async function fetchCockpitOpsKpis(): Promise<CockpitOpsKpis | null> {
  try {
    const { data, error } = await supabase
      .from('v_cockpit_ops_kpis')
      .select('*')
      .single();
    if (error || !data) return null;
    return data as unknown as CockpitOpsKpis;
  } catch {
    return null;
  }
}

/** Aggregate legal case counts (counts only — no case details by design). Returns null on any error. */
export async function fetchLegalCasesSummary(): Promise<LegalCasesSummary | null> {
  try {
    const { data, error } = await supabase
      .from('v_legal_cases_summary')
      .select('*')
      .single();
    if (error || !data) return null;
    return data as unknown as LegalCasesSummary;
  } catch {
    return null;
  }
}

/** Format a numeric KPI for a tile; '—' for null/undefined (honest empty state). */
export function tileNum(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

/** Format a percentage KPI for a tile; '—' when null. */
export function tilePct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${v}%`;
}

/**
 * DEPLOYS tile value + footnote (verifier objection, tile-truth-wiring 2026-07-29):
 * the deploy ingestion feed died 2026-05-17, so a live-wired "0 · last 24h" is a
 * false zero — the exact disease this brief exists to kill. When the feed has no
 * row in 30 days (deploys_feed_live=false) render '—' with an honest footnote.
 */
export function tileDeploys(ops: CockpitOpsKpis | null): { value: string; footnote: string } {
  if (!ops) return { value: '—', footnote: 'last 24h' };
  if (!ops.deploys_feed_live) return { value: '—', footnote: 'deploy feed offline' };
  return { value: tileNum(ops.deploys_24h), footnote: 'last 24h' };
}
