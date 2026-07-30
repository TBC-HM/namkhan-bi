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

// ── r2 additions (brief §9.2 registry surface, §10.2 user docs, §10.3 scratch) ──

export interface StudioWorkbookRow {
  id: string;
  scope: 'holding' | 'property';
  property_id: number | null;
  sheet_id: string | null;
  url: string | null;
  type: string;                    // xlsx_export | custom_scratch | (later) gsheet
  owner: string;
  source_modules: string[];
  template_id: string | null;
  template_version: number | null;
  status: string;
  access_classification: string;
  parent_workbook_id: string | null;
  derived_by: string | null;
  derived_at: string | null;
  last_refresh: string | null;
  data_timestamp: string | null;
  created_at: string;
  /** snapshot->>'name' — set for scratch sheets, null for exports */
  display_name: string | null;
}

export interface StudioUserDocRow {
  id: string;
  owner: string;
  level: 'holding' | 'property';
  property_id: number | null;
  filename: string;
  storage_path: string;
  size_bytes: number;
  mime: string | null;
  tags: string[];
  brain_excluded: boolean;
  uploaded_at: string;
}

export interface StudioDocsUsage {
  doc_count: number;
  total_bytes: number;
}

/** From-scratch sheet grid — plain values only, snapshot-on-save (§10.3). */
export interface StudioScratchSnapshot {
  name: string;
  cols: string[];
  rows: string[][];
}
