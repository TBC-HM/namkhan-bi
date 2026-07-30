// lib/studio/engine.ts
// Spreadsheet Studio v1 — server-side shaping of rows fetched via
// public.fn_studio_query (whitelisted, read-only). Grouping, aggregation and
// computed columns run HERE (platform-computed, Option A per brief §9.4) —
// never in sheet formulas, never as SQL assembled from user input.

import { evaluateExpr } from './expr';
import type {
  StudioAggregation,
  StudioComputedColumn,
  StudioRow,
  StudioTemplateDefinition,
} from './types';

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function groupAggregate(
  rows: StudioRow[],
  groupBy: string[],
  aggregations: StudioAggregation[],
): StudioRow[] {
  if (groupBy.length === 0) return rows;
  const buckets = new Map<string, { key: StudioRow; members: StudioRow[] }>();
  for (const row of rows) {
    const keyParts = groupBy.map((g) => String(row[g] ?? ''));
    const key = keyParts.join(' ');
    let bucket = buckets.get(key);
    if (!bucket) {
      const keyRow: StudioRow = {};
      for (const g of groupBy) keyRow[g] = row[g] ?? null;
      bucket = { key: keyRow, members: [] };
      buckets.set(key, bucket);
    }
    bucket.members.push(row);
  }

  const out: StudioRow[] = [];
  for (const { key, members } of buckets.values()) {
    const agg: StudioRow = { ...key };
    for (const a of aggregations) {
      const label = `${a.fn}_${a.col}`;
      if (a.fn === 'count') {
        agg[label] = members.length;
        continue;
      }
      const nums = members.map((m) => toNum(m[a.col])).filter((n): n is number => n != null);
      if (nums.length === 0) {
        agg[label] = null;
        continue;
      }
      switch (a.fn) {
        case 'sum': agg[label] = nums.reduce((s, n) => s + n, 0); break;
        case 'avg': agg[label] = nums.reduce((s, n) => s + n, 0) / nums.length; break;
        case 'min': agg[label] = Math.min(...nums); break;
        case 'max': agg[label] = Math.max(...nums); break;
      }
    }
    out.push(agg);
  }
  return out;
}

function addComputedColumns(rows: StudioRow[], computed: StudioComputedColumn[]): StudioRow[] {
  if (computed.length === 0) return rows;
  return rows.map((row) => {
    const next: StudioRow = { ...row };
    for (const c of computed) {
      try {
        next[c.name] = evaluateExpr(c.expr, next);
      } catch {
        next[c.name] = null;
      }
    }
    return next;
  });
}

/** Shape raw view rows per the template definition (group → aggregate → compute). */
export function shapeRows(rows: StudioRow[], def: StudioTemplateDefinition): StudioRow[] {
  const grouped = groupAggregate(rows, def.groupBy ?? [], def.aggregations ?? []);
  return addComputedColumns(grouped, def.computed ?? []);
}

/** Column order for output: keys of the first row, stable. */
export function columnOrder(rows: StudioRow[]): string[] {
  return rows.length ? Object.keys(rows[0]) : [];
}
