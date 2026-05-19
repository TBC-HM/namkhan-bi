// app/h/[property_id]/cockpit/supabase/lib/types.ts
// Row shape mirrors public.v_cockpit_inventory.

export type InventoryKind = 'kpi' | 'container' | 'graph' | 'component';
export type DataStatus = 'live' | 'partial' | 'blocked';
export type StatusColor = 'red' | 'green' | 'amber';

export interface InventoryRow {
  kind: InventoryKind;
  code: string;
  name: string;
  section: string | null;
  data_status: DataStatus | null;
  primary_view: string | null;
  served_by_namkhan: boolean | null;
  served_by_donna: boolean | null;
  notes: string | null;
  chart_type: string | null;
  page_slug: string | null;
  bound_views: string[] | null;
  is_wired: boolean;
  status_color: StatusColor;
}

export type TabKey = 'kpi' | 'container' | 'graph' | 'component';
export type PropertyFilter = 'all' | 'namkhan' | 'donna' | 'both';
export type StatusFilter = 'all' | 'wired' | 'not_wired' | 'live';
