// app/_components/registry/types.ts
// Shape of public.v_container_registry + v_graph_registry rows.

export type RenderType = 'kpi_strip' | 'table' | 'top_n_drill' | 'month_table' | 'chart' | 'room_intel';
export type FormatToken = 'text' | 'int' | 'eur' | 'lak' | 'usd' | 'pct' | 'date' | 'month' | 'money';
export type PropertyScope = 'both' | 'donna' | 'namkhan';
export type ChartType = 'bar' | 'line' | 'pie';

export interface ColumnSpec {
  key: string;
  label: string;
  format: FormatToken;
  align?: 'left' | 'right' | 'center';
}

export interface ContainerRegistryRow {
  container_code: string;
  container_name: string;
  page_slug: string;
  display_order: number | null;
  description: string | null;
  subtitle: string | null;
  bound_views: string[];
  render_type: RenderType;
  columns_spec: ColumnSpec[];
  primary_filter: string | null;
  month_field: string | null;
  drill_view: string | null;
  drill_key: string | null;
  default_sort: string | null;
  property_scope: PropertyScope;
  active: boolean;
}

export interface GraphRegistryRow {
  graph_code: string;
  graph_name: string;
  chart_type: ChartType;
  view_name: string;
  section: string;
  label_col: string;
  value_col: string;
  series_col: string | null;
  primary_filter: string | null;
  property_scope: PropertyScope;
  display_order: number | null;
  description: string | null;
  active: boolean;
}

export interface RenderableItem {
  kind: 'container' | 'graph';
  displayOrder: number;
  container?: ContainerRegistryRow;
  graph?: GraphRegistryRow;
}

export type DataRow = Record<string, unknown>;

export const NAMKHAN_ID = 260955;
export const DONNA_ID = 1000001;

export function propertyCurrencySymbol(propertyId: number): string {
  if (propertyId === DONNA_ID)   return '€';
  if (propertyId === NAMKHAN_ID) return '₭';
  return '$';
}

export function scopeMatches(scope: PropertyScope, propertyId: number): boolean {
  if (scope === 'both') return true;
  if (scope === 'donna')   return propertyId === DONNA_ID;
  if (scope === 'namkhan') return propertyId === NAMKHAN_ID;
  return false;
}

// 'public.v_x' → 'v_x' for supabase.from()
export function stripPublicPrefix(viewName: string): string {
  return viewName.replace(/^public\./, '').replace(/^kpi\./, '');
}

// 'total_leakage_eur DESC' → { col, ascending }
export function parseSort(sort: string | null): { col: string; ascending: boolean } | null {
  if (!sort) return null;
  const parts = sort.trim().split(/\s+/);
  const col = parts[0];
  const dir = (parts[1] ?? 'ASC').toUpperCase();
  return { col, ascending: dir !== 'DESC' };
}
