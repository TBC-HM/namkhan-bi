// lib/studio/server.ts
// SERVER-ONLY helpers shared by the Studio API routes: definition sanitizing
// and the whitelisted read path (public.fn_studio_query — SECURITY DEFINER,
// view/column/operator whitelists enforced in SQL). No raw SQL surface.

import { supabase } from '@/lib/supabase';
import type { StudioRow, StudioTemplateDefinition } from './types';

const ALLOWED_OPS = new Set(['=', '!=', '>', '>=', '<', '<=', 'ilike']);
const ALLOWED_AGGS = new Set(['sum', 'avg', 'min', 'max', 'count']);

export function sanitizeDefinition(raw: unknown): StudioTemplateDefinition | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  const schema = d.schema === 'kpi' ? 'kpi' : d.schema === 'public' ? 'public' : null;
  const view = typeof d.view === 'string' ? d.view : '';
  if (!schema || !/^v_[a-z0-9_]+$/.test(view)) return null;

  const columns = Array.isArray(d.columns)
    ? d.columns.filter((c): c is string => typeof c === 'string' && /^[a-z0-9_]+$/i.test(c))
    : [];
  const filters = Array.isArray(d.filters)
    ? d.filters
        .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
        .map((f) => ({
          col: String(f.col ?? ''),
          op: String(f.op ?? '='),
          value: String(f.value ?? ''),
        }))
        .filter((f) => /^[a-z0-9_]+$/i.test(f.col) && ALLOWED_OPS.has(f.op))
    : [];
  const groupBy = Array.isArray(d.groupBy)
    ? d.groupBy.filter((g): g is string => typeof g === 'string' && /^[a-z0-9_]+$/i.test(g))
    : [];
  const aggregations = Array.isArray(d.aggregations)
    ? d.aggregations
        .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
        .map((a) => ({ col: String(a.col ?? ''), fn: String(a.fn ?? '') }))
        .filter((a) => /^[a-z0-9_]+$/i.test(a.col) && ALLOWED_AGGS.has(a.fn))
    : [];
  const computed = Array.isArray(d.computed)
    ? d.computed
        .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
        .map((c) => ({ name: String(c.name ?? ''), expr: String(c.expr ?? '') }))
        .filter((c) => /^[a-z0-9_ ]{1,64}$/i.test(c.name) && c.expr.length > 0 && c.expr.length <= 500)
    : [];
  const limit = Math.min(Math.max(Number(d.limit) || 1000, 1), 5000);

  return {
    schema,
    view,
    columns,
    filters: filters as StudioTemplateDefinition['filters'],
    groupBy,
    aggregations: aggregations as StudioTemplateDefinition['aggregations'],
    computed,
    limit,
  };
}

export async function fetchStudioRows(def: StudioTemplateDefinition): Promise<StudioRow[]> {
  const { data, error } = await supabase.rpc('fn_studio_query', {
    p_schema: def.schema,
    p_view: def.view,
    p_columns: def.columns.length ? def.columns : null,
    p_filters: def.filters,
    p_limit: def.limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioRow[];
}
