// lib/inv-data.ts
// Phase 2.5 Inventory module — typed data fetchers.
// Schemas: inv, fa, proc, suppliers (all in pgrst.db_schemas as of 2026-05-02).
//
// Pattern mirrors lib/data.ts:
//   const data = await getInvOverview();
//   const item = await getItemDetail(itemId);
//
// Server-side only. Run from server components / route handlers.

import { supabase } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface InvItem {
  item_id: string;
  sku: string;
  item_name: string;
  description: string | null;
  category_id: number;
  uom_id: number;
  default_location_id: number | null;
  primary_vendor_id: string | null;
  alternate_vendor_id: string | null;
  last_unit_cost_lak: number | null;
  last_unit_cost_usd: number | null;
  fx_rate_used: number | null;
  reorder_point: number | null;
  reorder_quantity: number | null;
  shelf_life_days: number | null;
  is_perishable: boolean;
  storage_temp: string | null;
  gl_account_code: string | null;
  catalog_status: 'approved' | 'pending_review' | 'deprecated' | 'rejected';
  is_active: boolean;
  notes: string | null;
}

export interface StockOnHand {
  item_id: string;
  sku: string;
  item_name: string;
  category_id: number;
  category_name: string;
  total_on_hand: number;
  value_usd_estimate: number;
  locations_with_stock: number;
  last_movement_at: string | null;
  last_count_at: string | null;
}

export interface ParStatus {
  item_id: string;
  sku: string;
  item_name: string;
  location_id: number;
  location_name: string;
  par_quantity: number;
  effective_min: number;
  effective_max: number;
  on_hand: number;
  par_status: 'stock_out' | 'reorder_now' | 'below_par' | 'overstocked' | 'ok';
  pct_of_par: number | null;
  short_quantity: number;
  last_unit_cost_usd: number | null;
  reorder_value_usd: number;
  primary_vendor_id: string | null;
}

export interface HeatmapCell {
  location_id: number;
  location_name: string;
  category_id: number;
  category_name: string;
  stock_out_count: number;
  reorder_count: number;
  below_par_count: number;
  overstocked_count: number;
  ok_count: number;
  total_items: number;
  health_color: 'red' | 'amber' | 'blue' | 'green';
}

export interface SlowMover {
  item_id: string;
  sku: string;
  item_name: string;
  category_id: number;
  category_name: string;
  units_90d: number;
  units_per_day: number;
  units_per_week: number;
  last_unit_cost_usd: number | null;
  total_on_hand: number | null;
  value_usd_estimate: number | null;
}

export interface DaysOfCover {
  item_id: string;
  sku: string;
  item_name: string;
  on_hand: number;
  burn_per_day: number;
  days_of_cover: number | null;
  par_quantity: number | null;
  days_until_par: number | null;
  reorder_point: number | null;
  days_until_reorder: number | null;
}

export interface ExpiringSoon {
  batch_movement_id: number;
  item_id: string;
  sku: string;
  item_name: string;
  location_id: number;
  location_name: string;
  batch_code: string | null;
  expiry_date: string;
  days_until_expiry: number;
  received_quantity: number;
  current_on_hand: number;
  last_unit_cost_usd: number | null;
  at_risk_value_usd: number | null;
}

export interface UsageTrend {
  item_id: string;
  week_start: string;
  units_consumed: number;
  units_received: number;
  avg_weekly_consumed: number;
}

export interface FaAsset {
  asset_id: string;
  asset_tag: string;
  name: string;
  category_id: number;
  location: string | null;
  status: string;
  condition: string | null;
  purchase_date: string | null;
  in_service_date: string | null;
  purchase_cost_usd: number | null;
  useful_life_years: number | null;
  depreciation_method: string | null;
  residual_value_usd: number;
  insurance_value_usd: number | null;
  warranty_expiry: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  supplier_id: string | null;
  gl_account_code: string | null;
}

export interface FaDepreciation {
  asset_id: string;
  asset_tag: string;
  name: string;
  category_name: string;
  usali_dept: string | null;
  location: string | null;
  purchase_date: string | null;
  purchase_cost_usd: number | null;
  residual_value_usd: number;
  useful_life_years: number | null;
  depreciation_method: string;
  depreciable_base_usd: number;
  years_in_service: number | null;
  book_value_usd: number | null;
  monthly_depreciation_usd: number;
  period_yyyymm: number;
  status: string;
}

export interface CapexLine {
  capex_id: string;
  capex_code: string | null;
  fiscal_year: number;
  fiscal_quarter: number | null;
  title: string;
  description: string | null;
  category_id: number | null;
  estimated_cost_usd: number | null;
  preferred_supplier_id: string | null;
  expected_irr_pct: number | null;
  payback_months: number | null;
  expected_useful_life_years: number | null;
  business_case: string | null;
  status:
    | 'proposed'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'ordered'
    | 'received'
    | 'cancelled';
  proposed_at: string;
  approved_at: string | null;
  converted_to_asset_id: string | null;
}

export interface ProcRequest {
  pr_id: string;
  pr_number: string | null;
  pr_title: string;
  requesting_dept: string | null;
  delivery_location_id: number | null;
  needed_by_date: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  total_estimated_usd: number | null;
  business_justification: string | null;
  status: string;
  required_approver_role: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface PurchaseOrder {
  po_id: string;
  po_number: string | null;
  source_pr_id: string | null;
  vendor_id: string;
  delivery_location_id: number | null;
  expected_delivery_date: string | null;
  total_usd: number | null;
  status: string;
  qb_bill_ref: string | null;
  qb_billed_date: string | null;
  notes: string | null;
}

// ============================================================================
// OVERVIEW (Page 1)
// ============================================================================

export async function getInvOverview() {
  const [
    stockOnHand,
    slowMoversCount,
    belowParCount,
    lastCount,
    openVarianceSum,
    pendingReceives,
    heatmap,
    capexFy,
    depCurrent,
    openRequests,
    expiring,
    topMovers,
  ] = await Promise.all([
    supabase.schema('inv').from('v_inv_stock_on_hand').select('value_usd_estimate, total_on_hand'),
    supabase
      .schema('inv')
      .from('v_inv_slow_movers')
      .select('item_id', { count: 'exact', head: true }),
    supabase
      .schema('inv')
      .from('v_inv_par_status')
      .select('item_id', { count: 'exact', head: true })
      .in('par_status', ['stock_out', 'below_par', 'reorder_now']),
    supabase
      .schema('inv')
      .from('counts')
      .select('count_date')
      .order('count_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema('inv')
      .from('count_lines')
      .select('variance_value_usd'),
    supabase
      .schema('procurement')
      .from('purchase_orders')
      .select('po_id', { count: 'exact', head: true })
      .in('status', ['sent', 'partially_received']),
    supabase.schema('inv').from('v_inv_heatmap_health').select('*'),
    supabase
      .schema('fa')
      .from('capex_pipeline')
      .select('capex_id, title, estimated_cost_usd, fiscal_quarter, status, expected_irr_pct')
      .eq('fiscal_year', new Date().getFullYear())
      .order('estimated_cost_usd', { ascending: false })
      .limit(10),
    supabase.schema('fa').from('v_fa_depreciation_current').select('*'),
    supabase.schema('procurement').from('v_proc_open_requests').select('*').limit(5),
    supabase
      .schema('inv')
      .from('v_inv_expiring_soon')
      .select('*')
      .lt('days_until_expiry', 30)
      .order('days_until_expiry')
      .limit(10),
    supabase
      .schema('inv')
      .from('v_inv_usage_trend')
      .select('item_id, units_consumed'),
  ]);

  const invValue = (stockOnHand.data ?? []).reduce(
    (s, r: any) => s + Number(r.value_usd_estimate ?? 0),
    0,
  );
  const variances = (openVarianceSum.data ?? [])
    .map((r: any) => Number(r.variance_value_usd ?? 0))
    .filter((n) => n !== 0);
  const openVarianceUsd = variances.reduce((s, n) => s + Math.abs(n), 0);

  // Aggregate top movers across the 12 weeks (sum units consumed per item)
  const moverMap = new Map<string, number>();
  for (const r of (topMovers.data ?? []) as any[]) {
    moverMap.set(r.item_id, (moverMap.get(r.item_id) ?? 0) + Number(r.units_consumed ?? 0));
  }
  const topMoversList = [...moverMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([item_id, total]) => ({ item_id, total }));

  return {
    invValue,
    slowMoversCount: slowMoversCount.count ?? 0,
    belowParCount: belowParCount.count ?? 0,
    lastCountDate: (lastCount.data as any)?.count_date ?? null,
    openVarianceUsd,
    pendingReceivesCount: pendingReceives.count ?? 0,
    heatmap: (heatmap.data ?? []) as HeatmapCell[],
    capexFy: (capexFy.data ?? []) as CapexLine[],
    depCurrent: (depCurrent.data ?? []) as FaDepreciation[],
    openRequests: (openRequests.data ?? []) as any[],
    expiring: (expiring.data ?? []) as ExpiringSoon[],
    topMoversList,
  };
}

// ============================================================================
// ITEM DETAIL (Page 2)
// ============================================================================

export async function getItemDetail(itemId: string) {
  const [item, stock, parStatus, movements, usage, cover, expiry, photos] = await Promise.all([
    supabase
      .schema('inv')
      .from('items')
      .select('*, categories:category_id(name), units:uom_id(code, name)')
      .eq('item_id', itemId)
      .maybeSingle(),
    supabase
      .schema('inv')
      .from('v_inv_stock_on_hand')
      .select('*')
      .eq('item_id', itemId)
      .maybeSingle(),
    supabase.schema('inv').from('v_inv_par_status').select('*').eq('item_id', itemId),
    supabase
      .schema('inv')
      .from('movements')
      .select(
        '*, locations:location_id(location_name), supplier:vendor_id(name)',
      )
      .eq('item_id', itemId)
      .order('moved_at', { ascending: false })
      .limit(20),
    supabase.schema('inv').from('v_inv_usage_trend').select('*').eq('item_id', itemId),
    supabase
      .schema('inv')
      .from('v_inv_days_of_cover')
      .select('*')
      .eq('item_id', itemId)
      .maybeSingle(),
    supabase.schema('inv').from('v_inv_expiring_soon').select('*').eq('item_id', itemId),
    supabase.schema('inv').from('photos').select('*').eq('item_id', itemId).order('display_order'),
  ]);

  return {
    item: item.data as any,
    stock: (stock.data ?? null) as StockOnHand | null,
    parStatus: (parStatus.data ?? []) as ParStatus[],
    movements: (movements.data ?? []) as any[],
    usage: (usage.data ?? []) as UsageTrend[],
    cover: (cover.data ?? null) as DaysOfCover | null,
    expiry: (expiry.data ?? []) as ExpiringSoon[],
    photos: (photos.data ?? []) as any[],
  };
}

// ============================================================================
// SHOP (Page 3)
// ============================================================================

export async function getShopCatalog(filter: { categoryId?: number; q?: string } = {}) {
  let q = supabase
    .schema('inv')
    .from('items')
    .select(
      `item_id, sku, item_name, last_unit_cost_usd, default_location_id,
       categories:category_id(name),
       units:uom_id(code, name)`,
    )
    .eq('is_active', true)
    .eq('catalog_status', 'approved')
    .order('item_name');

  if (filter.categoryId) q = q.eq('category_id', filter.categoryId);
  if (filter.q) q = q.ilike('item_name', `%${filter.q}%`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}

// ============================================================================
// REQUESTS (Page 4)
// ============================================================================

export async function getRequests(filter: { status?: string[]; createdBy?: string } = {}) {
  let q = supabase
    .schema('procurement')
    .from('requests')
    .select(
      `pr_id, pr_number, pr_title, requesting_dept, priority,
       total_estimated_usd, status, required_approver_role,
       submitted_at, created_by, needed_by_date, created_at`,
    )
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (filter.status && filter.status.length) q = q.in('status', filter.status);
  if (filter.createdBy) q = q.eq('created_by', filter.createdBy);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProcRequest[];
}

export async function getRequestDetail(prId: string) {
  const [pr, items, log] = await Promise.all([
    supabase
      .schema('procurement')
      .from('requests')
      .select('*, location:delivery_location_id(location_name)')
      .eq('pr_id', prId)
      .maybeSingle(),
    supabase
      .schema('procurement')
      .from('request_items')
      .select('*, item:item_id(sku, item_name), supplier:preferred_supplier_id(name)')
      .eq('pr_id', prId),
    supabase.schema('procurement').from('approval_log').select('*').eq('pr_id', prId).order('occurred_at'),
  ]);
  return {
    pr: pr.data as any,
    items: (items.data ?? []) as any[],
    log: (log.data ?? []) as any[],
  };
}

// ============================================================================
// PURCHASE ORDERS (Page 5)
// ============================================================================

export async function getPurchaseOrders(filter: { status?: string[] } = {}) {
  let q = supabase
    .schema('procurement')
    .from('purchase_orders')
    .select(
      `po_id, po_number, total_usd, expected_delivery_date, status, qb_bill_ref,
       vendor:vendor_id(name)`,
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (filter.status && filter.status.length) q = q.in('status', filter.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getPoKpis() {
  const [openPrs, openPos, awaiting, leadTime] = await Promise.all([
    supabase
      .schema('procurement')
      .from('requests')
      .select('pr_id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .is('converted_to_po_id', null),
    supabase
      .schema('procurement')
      .from('purchase_orders')
      .select('po_id', { count: 'exact', head: true })
      .in('status', ['draft', 'sent', 'partially_received']),
    supabase
      .schema('procurement')
      .from('purchase_orders')
      .select('po_id', { count: 'exact', head: true })
      .in('status', ['sent', 'partially_received']),
    supabase.schema('procurement').from('suppliers').select('lead_time_days'),
  ]);
  const leadDays = (leadTime.data ?? [])
    .map((r: any) => Number(r.lead_time_days))
    .filter((n) => !isNaN(n) && n > 0);
  const avgLead = leadDays.length ? leadDays.reduce((s, n) => s + n, 0) / leadDays.length : null;
  return {
    openPrsAwaitingPo: openPrs.count ?? 0,
    openPosCount: openPos.count ?? 0,
    awaitingReceiptCount: awaiting.count ?? 0,
    avgLeadDays: avgLead,
  };
}

// ============================================================================
// CATALOG ADMIN (Page 6)
// ============================================================================

export async function getCatalogProposals(status: 'pending_review' | 'approved' | 'rejected' = 'pending_review') {
  const { data, error } = await supabase
    .schema('procurement')
    .from('new_item_proposals')
    .select(
      `proposal_id, proposed_name, proposed_description, estimated_unit_cost_usd,
       expected_monthly_usage, justification, photo_storage_path,
       proposed_at, proposed_by, status, reviewer_notes,
       category:category_id(name),
       uom:uom_id(code, name),
       likely_vendor:likely_vendor_id(name)`,
    )
    .eq('status', status)
    .order('proposed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

// ============================================================================
// ASSETS (Page 7)
// ============================================================================

export async function getAssetsRegister() {
  const [assets, dep, kpis] = await Promise.all([
    supabase
      .schema('fa')
      .from('assets')
      .select(
        `asset_id, asset_tag, name, location, status, condition,
         category:category_id(name),
         supplier:supplier_id(name)`,
      )
      .order('asset_tag'),
    supabase.schema('fa').from('v_fa_depreciation_current').select('asset_id, book_value_usd, monthly_depreciation_usd'),
    Promise.all([
      supabase
        .schema('fa')
        .from('maintenance_log')
        .select('log_id', { count: 'exact', head: true })
        .gte('next_due_date', new Date().toISOString().slice(0, 10))
        .lte(
          'next_due_date',
          new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        ),
      supabase
        .schema('fa')
        .from('assets')
        .select('asset_id', { count: 'exact', head: true })
        .eq('status', 'disposed')
        .gte('disposal_date', `${new Date().getFullYear()}-01-01`),
    ]),
  ]);

  const depByAsset = new Map<string, { book: number; monthly: number }>();
  for (const r of (dep.data ?? []) as any[]) {
    depByAsset.set(r.asset_id, {
      book: Number(r.book_value_usd ?? 0),
      monthly: Number(r.monthly_depreciation_usd ?? 0),
    });
  }
  const totalNbv = [...depByAsset.values()].reduce((s, x) => s + x.book, 0);
  const annualDepreciation =
    [...depByAsset.values()].reduce((s, x) => s + x.monthly, 0) * 12;

  return {
    assets: ((assets.data ?? []) as any[]).map((a) => ({
      ...a,
      nbv: depByAsset.get(a.asset_id)?.book ?? null,
    })),
    kpis: {
      totalNbv,
      annualDepreciation,
      maintenanceDue: kpis[0].count ?? 0,
      disposedYtd: kpis[1].count ?? 0,
    },
  };
}

export async function getAssetDetail(assetId: string) {
  const [asset, dep, mlog, docs] = await Promise.all([
    supabase
      .schema('fa')
      .from('assets')
      .select(
        `*, category:category_id(name, default_useful_life_years, default_depreciation_method),
         supplier:supplier_id(name, code, email, phone)`,
      )
      .eq('asset_id', assetId)
      .maybeSingle(),
    supabase
      .schema('fa')
      .from('v_fa_depreciation_current')
      .select('*')
      .eq('asset_id', assetId)
      .maybeSingle(),
    supabase
      .schema('fa')
      .from('maintenance_log')
      .select('*, vendor:vendor_id(name)')
      .eq('asset_id', assetId)
      .order('event_date', { ascending: false }),
    supabase.schema('fa').from('documents').select('*').eq('asset_id', assetId).order('uploaded_at', { ascending: false }),
  ]);
  return {
    asset: asset.data as any,
    dep: (dep.data ?? null) as FaDepreciation | null,
    mlog: (mlog.data ?? []) as any[],
    docs: (docs.data ?? []) as any[],
  };
}

// ============================================================================
// CAPEX (Page 8)
// ============================================================================

export async function getCapexPipeline(fiscalYear: number) {
  const { data, error } = await supabase
    .schema('fa')
    .from('capex_pipeline')
    .select(
      `capex_id, capex_code, title, description, fiscal_quarter, status,
       estimated_cost_usd, expected_irr_pct, payback_months,
       expected_useful_life_years, business_case,
       category:category_id(name)`,
    )
    .eq('fiscal_year', fiscalYear)
    .order('estimated_cost_usd', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

// ============================================================================
// COUNTS (Page 9)
// ============================================================================

export async function getOpenCountsForLocation(locationId: number) {
  // Items expected at location with current par + balance (for the count UI)
  const { data, error } = await supabase
    .schema('inv')
    .from('par_levels')
    .select(
      `item_id, par_quantity,
       item:item_id(sku, item_name, last_unit_cost_usd, category:category_id(name)),
       balance:stock_balance!stock_balance_item_id_fkey(quantity_on_hand)`,
    )
    .eq('location_id', locationId);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getRecentCounts() {
  const { data, error } = await supabase
    .schema('inv')
    .from('counts')
    .select(
      `count_id, count_date, count_type, status, counted_by, approved_by,
       location:location_id(location_name)`,
    )
    .order('count_date', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as any[];
}

// ============================================================================
// LOOKUPS (shared across pages)
// ============================================================================

export async function getInvLocations() {
  const { data } = await supabase
    .schema('inv')
    .from('locations')
    .select('location_id, code, location_name, area_type, responsible_dept')
    .eq('is_active', true)
    .order('location_name');
  return (data ?? []) as any[];
}

export async function getInvCategories() {
  const { data } = await supabase
    .schema('inv')
    .from('categories')
    .select('category_id, code, name, usali_dept')
    .eq('is_active', true)
    .order('name');
  return (data ?? []) as any[];
}

export async function getSuppliers() {
  const { data } = await supabase
    .schema('procurement')
    .from('suppliers')
    .select('supplier_id, code, name, lead_time_days, payment_terms, currency, status')
    .eq('status', 'active')
    .order('name');
  return (data ?? []) as any[];
}
