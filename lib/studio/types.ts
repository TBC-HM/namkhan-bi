// lib/studio/types.ts
// Spreadsheet Studio v1 — shared types (brief module-spreadsheet-studio-v1, goal 46).
// The Studio is a READ-ONLY rendering layer over gold views (ADR-181 renderer
// pattern): canon values are always platform-computed; the Studio never writes
// metric rows.

export interface StudioFilter {
  col: string;
  op: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'ilike';
  value: string;
}

export type StudioAggFn = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface StudioAggregation {
  col: string;
  fn: StudioAggFn;
}

export interface StudioComputedColumn {
  name: string;
  /** Safe expression over row columns — see lib/studio/expr.ts. No SQL, no eval. */
  expr: string;
}

export interface StudioTemplateDefinition {
  schema: 'public' | 'kpi';
  view: string;
  columns: string[];          // empty = all
  filters: StudioFilter[];
  groupBy: string[];          // empty = no grouping
  aggregations: StudioAggregation[];
  computed: StudioComputedColumn[];
  limit: number;
}

export interface StudioCatalogEntry {
  view_schema: string;
  view_name: string;
  family: string | null;
  section: string | null;
  kpi_name: string | null;
  meaning_plain: string | null;
}

export interface StudioViewColumn {
  column_name: string;
  data_type: string;
}

export interface StudioTemplateRow {
  id: string;
  property_id: number;
  name: string;
  definition: StudioTemplateDefinition;
  owner: string;
  version: number;
  status: string;
  updated_at: string;
}

export type StudioRow = Record<string, unknown>;
