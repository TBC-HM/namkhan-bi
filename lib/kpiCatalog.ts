// lib/kpiCatalog.ts — server-side cached fetch of public.v_kpi_catalog.
// Used by /api/kpi-catalog to serve individual entries to client tiles.

import { getSupabaseAdmin } from './supabaseAdmin';

export interface KpiEntry {
  kpi_number: number;
  kpi_name: string;
  family: string | null;
  section: string | null;
  status: string | null;
  definition_status: string | null;
  gold_view: string | null;
  meaning_plain: string | null;
  formula_plain: string | null;
  watch_out: string | null;
}

// Module-level cache — survives across requests within the same serverless instance.
let _catalog: Record<string, KpiEntry> | null = null;
let _fetchedAt = 0;
const TTL_MS = 5 * 60 * 1000;

export async function fetchKpiCatalog(): Promise<Record<string, KpiEntry>> {
  if (_catalog && Date.now() - _fetchedAt < TTL_MS) return _catalog;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_kpi_catalog').select('*');
  const map: Record<string, KpiEntry> = {};
  for (const row of (data ?? []) as KpiEntry[]) {
    map[row.kpi_name] = row;
    if (row.gold_view) map[row.gold_view] = row;
  }
  _catalog = map;
  _fetchedAt = Date.now();
  return map;
}

/** Look up a single entry by kpi_name OR gold_view. Returns null if not found. */
export async function getKpiEntry(key: string): Promise<KpiEntry | null> {
  const catalog = await fetchKpiCatalog();
  return catalog[key] ?? null;
}
