// app/operations/inventory/_data.ts
//
// Shared server-side data helpers for the inventory module.
// Uses service-role client because anon has no grants on inv/fa/suppliers/proc/gl.
// Same pattern as /api/marketing/upload.
//
// LIVE WIRING NOTE 2026-05-03:
// The /operations/inventory/suppliers list + detail pages now read from the
// `gl.*` schema (real QuickBooks vendors, 135 rows; 1,799 transaction lines)
// instead of the seeded `suppliers.*` tables. The seeded `suppliers.*` schema
// is kept for future procurement-curated supplier records (with reliability/
// quality scoring + contacts + alternates) but is no longer surfaced in the UI.
//
// Routing key for the gl-vendor detail page is `vendor_name` URL-encoded
// (gl.* views don't expose vendor_id consistently; vendor_name is unique).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const safe = async <T,>(p: PromiseLike<T>, fallback: T): Promise<T> => {
  try { return await Promise.resolve(p); } catch { return fallback; }
};

export interface InvSnapshotKpis {
  itemsActive: number;
  itemsTotal: number;
  belowPar: number;
  slowMovers: number;
  inventoryValueUsd: number;
  openPosUsd: number;
  pendingRequests: number;
  suppliersActive: number;
  localSourcingPct: number;
  capexProposedUsd: number;
  capexApprovedUsd: number;
  faNbvUsd: number;
  wastageValueMtdUsd: number;
  cogs90dUsd: number;
  stockTurnAnnualized: number | null;
}

export async function getInventorySnapshot(): Promise<InvSnapshotKpis> {
  const empty: InvSnapshotKpis = {
    itemsActive: 0, itemsTotal: 0, belowPar: 0, slowMovers: 0,
    inventoryValueUsd: 0, openPosUsd: 0, pendingRequests: 0,
    suppliersActive: 0, localSourcingPct: 0, capexProposedUsd: 0, capexApprovedUsd: 0, faNbvUsd: 0,
    wastageValueMtdUsd: 0, cogs90dUsd: 0, stockTurnAnnualized: null,
  };
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return empty; }

  // Compute wastage + COGS window dates
  const today = new Date();
  const monthStartIso = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0,10);
  const ninetyDaysAgoIso = new Date(today.getTime() - 90 * 24 * 3600 * 1000).toISOString().slice(0,10);

  const [items, stock, pars, openPos, openPrs, sups, capex, fa, wastage, cogs] = await Promise.all([
    safe(admin.schema('inv').from('items').select('item_id, last_unit_cost_usd, is_active').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('stock_balance').select('item_id, location_id, quantity_on_hand, last_movement_at').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('par_levels').select('item_id, location_id, par_quantity').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('proc').from('purchase_orders').select('total_usd, status').in('status', ['draft','sent','partially_received']).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('proc').from('requests').select('pr_id, status').in('status', ['submitted','pending_gm','pending_owner']).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('suppliers').from('suppliers').select('supplier_id, status, is_local_sourcing').eq('status', 'active').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('fa').from('capex_pipeline').select('estimated_cost_usd, status').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('fa').from('assets').select('purchase_cost_usd, residual_value_usd, in_service_date, useful_life_years, status').eq('status', 'in_service').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('movements').select('total_cost_usd').eq('movement_type', 'write_off').gte('movement_date', monthStartIso).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('movements').select('total_cost_usd, movement_type').in('movement_type', ['consume','issue']).gte('movement_date', ninetyDaysAgoIso).then(r => r.data ?? []), [] as any[]),
  ]);

  const itemCostBySku = new Map<string, number>();
  items.forEach((it: any) => { itemCostBySku.set(it.item_id, Number(it.last_unit_cost_usd ?? 0)); });

  const parByPair = new Map<string, number>();
  pars.forEach((p: any) => { parByPair.set(`${p.item_id}::${p.location_id}`, Number(p.par_quantity)); });

  let inventoryValueUsd = 0;
  let belowPar = 0;
  const SLOW_DAYS = 60;
  const now = Date.now();
  let slowMovers = 0;
  stock.forEach((s: any) => {
    const cost = itemCostBySku.get(s.item_id) ?? 0;
    inventoryValueUsd += Number(s.quantity_on_hand) * cost;
    const par = parByPair.get(`${s.item_id}::${s.location_id}`);
    if (par != null && Number(s.quantity_on_hand) < par) belowPar++;
    if (s.last_movement_at) {
      const ageDays = (now - new Date(s.last_movement_at).getTime()) / (24 * 3600 * 1000);
      if (ageDays > SLOW_DAYS && Number(s.quantity_on_hand) > 0) slowMovers++;
    }
  });

  const openPosUsd = openPos.reduce((s: number, p: any) => s + Number(p.total_usd ?? 0), 0);
  const localCount = sups.filter((s: any) => s.is_local_sourcing).length;
  const localPct = sups.length > 0 ? (localCount / sups.length) * 100 : 0;

  const capexProposed = capex.filter((c: any) => ['proposed','under_review'].includes(c.status))
    .reduce((s: number, c: any) => s + Number(c.estimated_cost_usd ?? 0), 0);
  const capexApproved = capex.filter((c: any) => c.status === 'approved')
    .reduce((s: number, c: any) => s + Number(c.estimated_cost_usd ?? 0), 0);

  // Net book value: cost − accumulated depreciation (straight-line)
  // (uses outer `today` already declared above)
  const faNbv = fa.reduce((sum: number, a: any) => {
    const cost = Number(a.purchase_cost_usd ?? 0);
    const residual = Number(a.residual_value_usd ?? 0);
    const life = Number(a.useful_life_years ?? 1);
    if (!a.in_service_date || life <= 0) return sum + cost;
    const yrsInSvc = (today.getTime() - new Date(a.in_service_date).getTime()) / (365.25 * 24 * 3600 * 1000);
    const annualDep = (cost - residual) / life;
    const accDep = Math.min(Math.max(yrsInSvc, 0) * annualDep, cost - residual);
    return sum + Math.max(cost - accDep, residual);
  }, 0);

  // Wastage MTD — write_off movements valued at recorded total_cost_usd
  const wastageValueMtdUsd = wastage.reduce((s: number, m: any) => s + Number(m.total_cost_usd ?? 0), 0);

  // COGS rolling 90d (consume + issue value), annualized stock turn = (cogs * 365/90) / avg_inv
  const cogs90dUsd = cogs.reduce((s: number, m: any) => s + Number(m.total_cost_usd ?? 0), 0);
  const stockTurnAnnualized = (inventoryValueUsd > 0 && cogs90dUsd > 0)
    ? (cogs90dUsd * (365 / 90)) / inventoryValueUsd
    : null;

  return {
    itemsActive: items.filter((i: any) => i.is_active).length,
    itemsTotal: items.length,
    belowPar,
    slowMovers,
    inventoryValueUsd,
    openPosUsd,
    pendingRequests: openPrs.length,
    suppliersActive: sups.length,
    localSourcingPct: localPct,
    capexProposedUsd: capexProposed,
    capexApprovedUsd: capexApproved,
    faNbvUsd: faNbv,
    wastageValueMtdUsd,
    cogs90dUsd,
    stockTurnAnnualized,
  };
}

// Heatmap: stock health by category × location bucket
export type StockHealth = 'ok' | 'low' | 'out' | 'overstock' | 'empty';
export interface HeatmapCell {
  category_code: string;
  category_name: string;
  location_code: string;
  location_name: string;
  health: StockHealth;
  item_count: number;
}

export async function getStockHeatmap(): Promise<HeatmapCell[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }

  const [items, stock, pars, cats, locs] = await Promise.all([
    safe(admin.schema('inv').from('items').select('item_id, category_id').eq('is_active', true).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('stock_balance').select('item_id, location_id, quantity_on_hand').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('par_levels').select('item_id, location_id, par_quantity, max_quantity').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('categories').select('category_id, code, name').eq('is_active', true).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('locations').select('location_id, code, location_name').eq('is_active', true).then(r => r.data ?? []), [] as any[]),
  ]);

  const itemToCategory = new Map<string, number>();
  items.forEach((it: any) => itemToCategory.set(it.item_id, it.category_id));

  const parMap = new Map<string, { par: number; max: number | null }>();
  pars.forEach((p: any) => {
    parMap.set(`${p.item_id}::${p.location_id}`, {
      par: Number(p.par_quantity),
      max: p.max_quantity != null ? Number(p.max_quantity) : null,
    });
  });

  // Group stock by (category, location)
  const grid = new Map<string, { ok: number; low: number; out: number; overstock: number }>();
  stock.forEach((s: any) => {
    const catId = itemToCategory.get(s.item_id);
    if (catId == null) return;
    const key = `${catId}::${s.location_id}`;
    const par = parMap.get(`${s.item_id}::${s.location_id}`);
    let bucket: 'ok' | 'low' | 'out' | 'overstock' = 'ok';
    const qty = Number(s.quantity_on_hand);
    if (qty <= 0) bucket = 'out';
    else if (par && qty < par.par) bucket = 'low';
    else if (par?.max && qty > par.max) bucket = 'overstock';
    const g = grid.get(key) ?? { ok: 0, low: 0, out: 0, overstock: 0 };
    g[bucket]++;
    grid.set(key, g);
  });

  const out: HeatmapCell[] = [];
  cats.forEach((cat: any) => {
    locs.forEach((loc: any) => {
      const g = grid.get(`${cat.category_id}::${loc.location_id}`);
      let health: StockHealth = 'empty';
      let count = 0;
      if (g) {
        count = g.ok + g.low + g.out + g.overstock;
        if (g.out > 0) health = 'out';
        else if (g.low > 0) health = 'low';
        else if (g.overstock > 0) health = 'overstock';
        else if (g.ok > 0) health = 'ok';
      }
      out.push({
        category_code: cat.code,
        category_name: cat.name,
        location_code: loc.code,
        location_name: loc.location_name,
        health,
        item_count: count,
      });
    });
  });
  return out;
}

export interface CapexRow {
  capex_code: string | null;
  title: string;
  fiscal_year: number;
  fiscal_quarter: number | null;
  category_code: string | null;
  estimated_cost_usd: number | null;
  expected_irr_pct: number | null;
  payback_months: number | null;
  status: string;
  proposed_at: string;
}

export async function getCapexPipeline(): Promise<CapexRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const [capex, cats] = await Promise.all([
    safe(admin.schema('fa').from('capex_pipeline').select('capex_code, title, fiscal_year, fiscal_quarter, category_id, estimated_cost_usd, expected_irr_pct, payback_months, status, proposed_at').order('proposed_at', { ascending: false }).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('fa').from('categories').select('category_id, code').then(r => r.data ?? []), [] as any[]),
  ]);
  const catMap = new Map<number, string>();
  cats.forEach((c: any) => catMap.set(c.category_id, c.code));
  return capex.map((c: any) => ({
    capex_code: c.capex_code,
    title: c.title,
    fiscal_year: c.fiscal_year,
    fiscal_quarter: c.fiscal_quarter,
    category_code: c.category_id != null ? (catMap.get(c.category_id) ?? null) : null,
    estimated_cost_usd: c.estimated_cost_usd != null ? Number(c.estimated_cost_usd) : null,
    expected_irr_pct: c.expected_irr_pct != null ? Number(c.expected_irr_pct) : null,
    payback_months: c.payback_months != null ? Number(c.payback_months) : null,
    status: c.status,
    proposed_at: c.proposed_at,
  }));
}

export interface AssetRow {
  asset_tag: string;
  name: string;
  category_code: string | null;
  category_name: string | null;
  location: string | null;
  manufacturer: string | null;
  purchase_date: string | null;
  purchase_cost_usd: number | null;
  useful_life_years: number | null;
  nbv_usd: number | null;
  condition: string | null;
  status: string;
}

export async function getAssetRegister(): Promise<AssetRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const [assets, cats] = await Promise.all([
    safe(admin.schema('fa').from('assets').select('asset_tag, name, category_id, location, manufacturer, purchase_date, in_service_date, purchase_cost_usd, residual_value_usd, useful_life_years, condition, status').order('purchase_date', { ascending: false }).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('fa').from('categories').select('category_id, code, name').then(r => r.data ?? []), [] as any[]),
  ]);
  const catMap = new Map<number, { code: string; name: string }>();
  cats.forEach((c: any) => catMap.set(c.category_id, { code: c.code, name: c.name }));

  const today = new Date();
  return assets.map((a: any) => {
    const cost = Number(a.purchase_cost_usd ?? 0);
    const residual = Number(a.residual_value_usd ?? 0);
    const life = Number(a.useful_life_years ?? 0);
    let nbv = cost;
    if (a.in_service_date && life > 0) {
      const yrsInSvc = (today.getTime() - new Date(a.in_service_date).getTime()) / (365.25 * 24 * 3600 * 1000);
      const annualDep = (cost - residual) / life;
      const accDep = Math.min(Math.max(yrsInSvc, 0) * annualDep, cost - residual);
      nbv = Math.max(cost - accDep, residual);
    }
    const cat = a.category_id != null ? catMap.get(a.category_id) : null;
    return {
      asset_tag: a.asset_tag,
      name: a.name,
      category_code: cat?.code ?? null,
      category_name: cat?.name ?? null,
      location: a.location,
      manufacturer: a.manufacturer,
      purchase_date: a.purchase_date,
      purchase_cost_usd: cost,
      useful_life_years: life,
      nbv_usd: nbv,
      condition: a.condition,
      status: a.status,
    };
  });
}

export interface PoRow {
  po_number: string | null;
  vendor_name: string | null;
  delivery_location: string | null;
  expected_delivery_date: string | null;
  total_usd: number | null;
  status: string;
  issued_at: string | null;
}

export async function getOpenPOs(): Promise<PoRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const [pos, sups, locs] = await Promise.all([
    safe(admin.schema('proc').from('purchase_orders').select('po_number, vendor_id, delivery_location_id, expected_delivery_date, total_usd, status, issued_at').order('issued_at', { ascending: false }).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('suppliers').from('suppliers').select('supplier_id, name').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('locations').select('location_id, location_name').then(r => r.data ?? []), [] as any[]),
  ]);
  const supMap = new Map<string, string>();
  sups.forEach((s: any) => supMap.set(s.supplier_id, s.name));
  const locMap = new Map<number, string>();
  locs.forEach((l: any) => locMap.set(l.location_id, l.location_name));
  return pos.map((p: any) => ({
    po_number: p.po_number,
    vendor_name: supMap.get(p.vendor_id) ?? null,
    delivery_location: p.delivery_location_id != null ? locMap.get(p.delivery_location_id) ?? null : null,
    expected_delivery_date: p.expected_delivery_date,
    total_usd: p.total_usd != null ? Number(p.total_usd) : null,
    status: p.status,
    issued_at: p.issued_at,
  }));
}

export interface PrRow {
  pr_number: string | null;
  pr_title: string;
  requesting_dept: string | null;
  delivery_location: string | null;
  needed_by_date: string | null;
  priority: string;
  total_estimated_usd: number | null;
  status: string;
  submitted_at: string | null;
}

export async function getOpenRequests(): Promise<PrRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const [prs, locs] = await Promise.all([
    safe(admin.schema('proc').from('requests').select('pr_number, pr_title, requesting_dept, delivery_location_id, needed_by_date, priority, total_estimated_usd, status, submitted_at').order('submitted_at', { ascending: false }).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('locations').select('location_id, location_name').then(r => r.data ?? []), [] as any[]),
  ]);
  const locMap = new Map<number, string>();
  locs.forEach((l: any) => locMap.set(l.location_id, l.location_name));
  return prs.map((p: any) => ({
    pr_number: p.pr_number,
    pr_title: p.pr_title,
    requesting_dept: p.requesting_dept,
    delivery_location: p.delivery_location_id != null ? locMap.get(p.delivery_location_id) ?? null : null,
    needed_by_date: p.needed_by_date,
    priority: p.priority,
    total_estimated_usd: p.total_estimated_usd != null ? Number(p.total_estimated_usd) : null,
    status: p.status,
    submitted_at: p.submitted_at,
  }));
}

export interface SupplierRow {
  code: string;
  name: string;
  supplier_type: string | null;
  country: string;
  city: string | null;
  is_local: boolean;
  reliability: number | null;
  quality: number | null;
  lead_time_days: number | null;
  payment_terms_days: number | null;
}

export async function getSuppliers(): Promise<SupplierRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const { data } = await safe(admin.schema('suppliers').from('suppliers')
    .select('code, name, supplier_type, country, city, is_local_sourcing, reliability_score, quality_score, lead_time_days, payment_terms_days')
    .eq('status', 'active').order('reliability_score', { ascending: false }), { data: [] as any[] });
  return (data ?? []).map((s: any) => ({
    code: s.code,
    name: s.name,
    supplier_type: s.supplier_type,
    country: s.country,
    city: s.city,
    is_local: !!s.is_local_sourcing,
    reliability: s.reliability_score != null ? Number(s.reliability_score) : null,
    quality: s.quality_score != null ? Number(s.quality_score) : null,
    lead_time_days: s.lead_time_days,
    payment_terms_days: s.payment_terms_days,
  }));
}

// ============================================================================
// /operations/inventory/stock — Stock-on-hand · Days of cover · Slow movers
// ============================================================================

export interface StockOnHandRow {
  item_id: string;
  sku: string;
  item_name: string;
  category_id: number | null;
  category_name: string | null;
  total_on_hand: number;
  value_usd_estimate: number | null;
  locations_with_stock: number;
  last_movement_at: string | null;
  last_count_at: string | null;
  // Units sold (consume + issue) windowed. null = no movements yet → renders "—".
  sold_ytd: number | null;
  sold_30d: number | null;
}

export async function getStockOnHand(): Promise<StockOnHandRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }

  const today = new Date();
  const ytdStartIso = `${today.getUTCFullYear()}-01-01`;
  const thirtyDaysAgoIso = new Date(today.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [stockRes, mvRes] = await Promise.all([
    safe(
      admin.schema('inv').from('v_inv_stock_on_hand')
        .select('item_id, sku, item_name, category_id, category_name, total_on_hand, value_usd_estimate, locations_with_stock, last_movement_at, last_count_at')
        .order('value_usd_estimate', { ascending: false, nullsFirst: false }),
      { data: [] as any[] }
    ),
    safe(
      admin.schema('inv').from('movements')
        .select('item_id, quantity, movement_date')
        .in('movement_type', ['consume', 'issue'])
        .gte('movement_date', ytdStartIso),
      { data: [] as any[] }
    ),
  ]);

  const ytdByItem = new Map<string, number>();
  const last30ByItem = new Map<string, number>();
  (mvRes.data ?? []).forEach((m: any) => {
    const qty = Math.abs(Number(m.quantity ?? 0));
    if (!Number.isFinite(qty) || qty === 0) return;
    ytdByItem.set(m.item_id, (ytdByItem.get(m.item_id) ?? 0) + qty);
    if (m.movement_date && m.movement_date >= thirtyDaysAgoIso) {
      last30ByItem.set(m.item_id, (last30ByItem.get(m.item_id) ?? 0) + qty);
    }
  });

  return (stockRes.data ?? []).map((r: any) => ({
    item_id: r.item_id,
    sku: r.sku,
    item_name: r.item_name,
    category_id: r.category_id,
    category_name: r.category_name,
    total_on_hand: Number(r.total_on_hand ?? 0),
    value_usd_estimate: r.value_usd_estimate != null ? Number(r.value_usd_estimate) : null,
    locations_with_stock: Number(r.locations_with_stock ?? 0),
    last_movement_at: r.last_movement_at,
    last_count_at: r.last_count_at,
    sold_ytd: ytdByItem.has(r.item_id) ? ytdByItem.get(r.item_id) ?? null : null,
    sold_30d: last30ByItem.has(r.item_id) ? last30ByItem.get(r.item_id) ?? null : null,
  }));
}

export interface DaysOfCoverRow {
  item_id: string;
  sku: string;
  item_name: string;
  on_hand: number;
  burn_per_day: number | null;
  days_of_cover: number | null;
  par_quantity: number | null;
  days_until_par: number | null;
  reorder_point: number | null;
  days_until_reorder: number | null;
}

export async function getDaysOfCover(): Promise<DaysOfCoverRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const { data } = await safe(
    admin.schema('inv').from('v_inv_days_of_cover')
      .select('item_id, sku, item_name, on_hand, burn_per_day, days_of_cover, par_quantity, days_until_par, reorder_point, days_until_reorder')
      .order('days_of_cover', { ascending: true, nullsFirst: false }),
    { data: [] as any[] }
  );
  return (data ?? []).map((r: any) => ({
    item_id: r.item_id,
    sku: r.sku,
    item_name: r.item_name,
    on_hand: Number(r.on_hand ?? 0),
    burn_per_day: r.burn_per_day != null ? Number(r.burn_per_day) : null,
    days_of_cover: r.days_of_cover != null ? Number(r.days_of_cover) : null,
    par_quantity: r.par_quantity != null ? Number(r.par_quantity) : null,
    days_until_par: r.days_until_par != null ? Number(r.days_until_par) : null,
    reorder_point: r.reorder_point != null ? Number(r.reorder_point) : null,
    days_until_reorder: r.days_until_reorder != null ? Number(r.days_until_reorder) : null,
  }));
}

export interface SlowMoverRow {
  item_id: string;
  sku: string;
  item_name: string;
  category_name: string | null;
  units_90d: number;
  units_per_day: number | null;
  units_per_week: number | null;
  last_unit_cost_usd: number | null;
  total_on_hand: number;
  value_usd_estimate: number | null;
}

export async function getSlowMovers(): Promise<SlowMoverRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const { data } = await safe(
    admin.schema('inv').from('v_inv_slow_movers')
      .select('item_id, sku, item_name, category_name, units_90d, units_per_day, units_per_week, last_unit_cost_usd, total_on_hand, value_usd_estimate')
      .order('value_usd_estimate', { ascending: false, nullsFirst: false }),
    { data: [] as any[] }
  );
  return (data ?? []).map((r: any) => ({
    item_id: r.item_id,
    sku: r.sku,
    item_name: r.item_name,
    category_name: r.category_name,
    units_90d: Number(r.units_90d ?? 0),
    units_per_day: r.units_per_day != null ? Number(r.units_per_day) : null,
    units_per_week: r.units_per_week != null ? Number(r.units_per_week) : null,
    last_unit_cost_usd: r.last_unit_cost_usd != null ? Number(r.last_unit_cost_usd) : null,
    total_on_hand: Number(r.total_on_hand ?? 0),
    value_usd_estimate: r.value_usd_estimate != null ? Number(r.value_usd_estimate) : null,
  }));
}

export interface ExpiringRow {
  item_id: string;
  sku: string;
  item_name: string;
  location_name: string | null;
  batch_code: string | null;
  expiry_date: string | null;
  days_until_expiry: number | null;
  current_on_hand: number;
  at_risk_value_usd: number | null;
}

export async function getExpiringSoon(): Promise<ExpiringRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const { data } = await safe(
    admin.schema('inv').from('v_inv_expiring_soon')
      .select('item_id, sku, item_name, location_name, batch_code, expiry_date, days_until_expiry, current_on_hand, at_risk_value_usd')
      .order('days_until_expiry', { ascending: true, nullsFirst: false }),
    { data: [] as any[] }
  );
  return (data ?? []).map((r: any) => ({
    item_id: r.item_id,
    sku: r.sku,
    item_name: r.item_name,
    location_name: r.location_name,
    batch_code: r.batch_code,
    expiry_date: r.expiry_date,
    days_until_expiry: r.days_until_expiry != null ? Number(r.days_until_expiry) : null,
    current_on_hand: Number(r.current_on_hand ?? 0),
    at_risk_value_usd: r.at_risk_value_usd != null ? Number(r.at_risk_value_usd) : null,
  }));
}

// ============================================================================
// /operations/inventory/par — Par status grid
// ============================================================================

export interface ParStatusRow {
  item_id: string;
  sku: string;
  item_name: string;
  location_id: number;
  location_name: string;
  par_quantity: number;
  effective_min: number | null;
  effective_max: number | null;
  on_hand: number;
  par_status: string; // 'ok' | 'below_min' | 'below_par' | 'over_max' | etc.
  pct_of_par: number | null;
  short_quantity: number | null;
  last_unit_cost_usd: number | null;
  reorder_value_usd: number | null;
  primary_vendor_id: string | null;
  primary_vendor_name: string | null;
}

export async function getParStatus(): Promise<ParStatusRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const [parsRes, supsRes] = await Promise.all([
    safe(admin.schema('inv').from('v_inv_par_status')
      .select('item_id, sku, item_name, location_id, location_name, par_quantity, effective_min, effective_max, on_hand, par_status, pct_of_par, short_quantity, last_unit_cost_usd, reorder_value_usd, primary_vendor_id')
      .order('pct_of_par', { ascending: true, nullsFirst: true }),
      { data: [] as any[] }),
    safe(admin.schema('suppliers').from('suppliers').select('supplier_id, name'),
      { data: [] as any[] }),
  ]);
  const supMap = new Map<string, string>();
  (supsRes.data ?? []).forEach((s: any) => supMap.set(s.supplier_id, s.name));
  return (parsRes.data ?? []).map((r: any) => ({
    item_id: r.item_id,
    sku: r.sku,
    item_name: r.item_name,
    location_id: Number(r.location_id),
    location_name: r.location_name,
    par_quantity: Number(r.par_quantity ?? 0),
    effective_min: r.effective_min != null ? Number(r.effective_min) : null,
    effective_max: r.effective_max != null ? Number(r.effective_max) : null,
    on_hand: Number(r.on_hand ?? 0),
    par_status: r.par_status ?? 'unknown',
    pct_of_par: r.pct_of_par != null ? Number(r.pct_of_par) : null,
    short_quantity: r.short_quantity != null ? Number(r.short_quantity) : null,
    last_unit_cost_usd: r.last_unit_cost_usd != null ? Number(r.last_unit_cost_usd) : null,
    reorder_value_usd: r.reorder_value_usd != null ? Number(r.reorder_value_usd) : null,
    primary_vendor_id: r.primary_vendor_id,
    primary_vendor_name: r.primary_vendor_id ? (supMap.get(r.primary_vendor_id) ?? null) : null,
  }));
}

// ============================================================================
// /operations/inventory/suppliers — Supplier register
// ============================================================================

export interface SupplierSummaryRow {
  supplier_id: string;
  code: string;
  name: string;
  legal_name: string | null;
  supplier_type: string | null;
  country: string;
  city: string | null;
  distance_km: number | null;
  is_local_sourcing: boolean;
  email: string | null;
  phone: string | null;
  website: string | null;
  payment_terms_days: number | null;
  currency: string;
  lead_time_days: number | null;
  reliability_score: number | null;
  quality_score: number | null;
  sustainability_score: number | null;
  status: string;
  contact_count: number;
  items_supplied: number;
  last_price_update: string | null;
  alternate_count: number;
}

export async function getSupplierSummaries(): Promise<SupplierSummaryRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const { data } = await safe(
    admin.schema('suppliers').from('v_supplier_summary')
      .select('supplier_id, code, name, legal_name, supplier_type, country, city, distance_km, is_local_sourcing, email, phone, website, payment_terms_days, currency, lead_time_days, reliability_score, quality_score, sustainability_score, status, contact_count, items_supplied, last_price_update, alternate_count')
      .order('reliability_score', { ascending: false, nullsFirst: false }),
    { data: [] as any[] }
  );
  return (data ?? []).map((s: any) => ({
    supplier_id: s.supplier_id,
    code: s.code,
    name: s.name,
    legal_name: s.legal_name,
    supplier_type: s.supplier_type,
    country: s.country,
    city: s.city,
    distance_km: s.distance_km != null ? Number(s.distance_km) : null,
    is_local_sourcing: !!s.is_local_sourcing,
    email: s.email,
    phone: s.phone,
    website: s.website,
    payment_terms_days: s.payment_terms_days,
    currency: s.currency,
    lead_time_days: s.lead_time_days,
    reliability_score: s.reliability_score != null ? Number(s.reliability_score) : null,
    quality_score: s.quality_score != null ? Number(s.quality_score) : null,
    sustainability_score: s.sustainability_score != null ? Number(s.sustainability_score) : null,
    status: s.status,
    contact_count: Number(s.contact_count ?? 0),
    items_supplied: Number(s.items_supplied ?? 0),
    last_price_update: s.last_price_update,
    alternate_count: Number(s.alternate_count ?? 0),
  }));
}

export interface LocalSourcingRow {
  local_supplier_count: number;
  total_supplier_count: number;
  local_supplier_pct: number;
}

export async function getLocalSourcing(): Promise<LocalSourcingRow> {
  const empty: LocalSourcingRow = { local_supplier_count: 0, total_supplier_count: 0, local_supplier_pct: 0 };
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return empty; }
  const { data } = await safe(
    admin.schema('suppliers').from('v_local_sourcing_pct').select('*').limit(1).single(),
    { data: null as any }
  );
  if (!data) return empty;
  return {
    local_supplier_count: Number(data.local_supplier_count ?? 0),
    total_supplier_count: Number(data.total_supplier_count ?? 0),
    local_supplier_pct: Number(data.local_supplier_pct ?? 0),
  };
}

// ============================================================================
// /operations/inventory/suppliers/[id] — Supplier detail
// ============================================================================

export interface SupplierContact {
  contact_id: number;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_primary: boolean;
  notes: string | null;
}

export interface SupplierPriceRow {
  price_id: number;
  effective_date: string;
  inv_sku: string | null;
  unit_price_usd: number | null;
  unit_price_lak: number | null;
  min_order_qty: number | null;
  source: string | null;
  source_ref: string | null;
  notes: string | null;
}

export interface SupplierAlternateRow {
  alt_id: number;
  alternate_supplier_id: string;
  alternate_code: string;
  alternate_name: string;
  preference_rank: number;
  notes: string | null;
}

export interface SupplierItemRow {
  item_id: string;
  sku: string;
  item_name: string;
  category_name: string | null;
  last_unit_cost_usd: number | null;
  is_primary: boolean;
}

export interface SupplierDetailBundle {
  supplier: SupplierSummaryRow | null;
  contacts: SupplierContact[];
  price_history: SupplierPriceRow[];
  alternates: SupplierAlternateRow[];
  items_supplied: SupplierItemRow[];
}

export async function getSupplierDetail(supplierId: string): Promise<SupplierDetailBundle> {
  const empty: SupplierDetailBundle = { supplier: null, contacts: [], price_history: [], alternates: [], items_supplied: [] };
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return empty; }

  const [summaryRes, contactsRes, pricesRes, altsRes, itemsRes, catsRes, allSupsRes] = await Promise.all([
    safe(admin.schema('suppliers').from('v_supplier_summary').select('*').eq('supplier_id', supplierId).limit(1).maybeSingle(),
      { data: null as any }),
    safe(admin.schema('suppliers').from('contacts').select('contact_id, name, title, email, phone, whatsapp, is_primary, notes').eq('supplier_id', supplierId).order('is_primary', { ascending: false }).order('name'),
      { data: [] as any[] }),
    safe(admin.schema('suppliers').from('price_history').select('price_id, effective_date, inv_sku, unit_price_usd, unit_price_lak, min_order_qty, source, source_ref, notes').eq('supplier_id', supplierId).order('effective_date', { ascending: false }).limit(200),
      { data: [] as any[] }),
    safe(admin.schema('suppliers').from('alternates').select('alt_id, alternate_supplier_id, preference_rank, notes').eq('primary_supplier_id', supplierId).order('preference_rank'),
      { data: [] as any[] }),
    safe(admin.schema('inv').from('items').select('item_id, sku, item_name, category_id, last_unit_cost_usd, primary_vendor_id, alternate_vendor_id').or(`primary_vendor_id.eq.${supplierId},alternate_vendor_id.eq.${supplierId}`),
      { data: [] as any[] }),
    safe(admin.schema('inv').from('categories').select('category_id, name'), { data: [] as any[] }),
    safe(admin.schema('suppliers').from('suppliers').select('supplier_id, code, name'), { data: [] as any[] }),
  ]);

  const summary = summaryRes.data ?? null;
  const supplier: SupplierSummaryRow | null = summary ? {
    supplier_id: summary.supplier_id,
    code: summary.code,
    name: summary.name,
    legal_name: summary.legal_name,
    supplier_type: summary.supplier_type,
    country: summary.country,
    city: summary.city,
    distance_km: summary.distance_km != null ? Number(summary.distance_km) : null,
    is_local_sourcing: !!summary.is_local_sourcing,
    email: summary.email,
    phone: summary.phone,
    website: summary.website,
    payment_terms_days: summary.payment_terms_days,
    currency: summary.currency,
    lead_time_days: summary.lead_time_days,
    reliability_score: summary.reliability_score != null ? Number(summary.reliability_score) : null,
    quality_score: summary.quality_score != null ? Number(summary.quality_score) : null,
    sustainability_score: summary.sustainability_score != null ? Number(summary.sustainability_score) : null,
    status: summary.status,
    contact_count: Number(summary.contact_count ?? 0),
    items_supplied: Number(summary.items_supplied ?? 0),
    last_price_update: summary.last_price_update,
    alternate_count: Number(summary.alternate_count ?? 0),
  } : null;

  const catMap = new Map<number, string>();
  (catsRes.data ?? []).forEach((c: any) => catMap.set(c.category_id, c.name));
  const supMap = new Map<string, { code: string; name: string }>();
  (allSupsRes.data ?? []).forEach((s: any) => supMap.set(s.supplier_id, { code: s.code, name: s.name }));

  const contacts: SupplierContact[] = (contactsRes.data ?? []).map((r: any) => ({
    contact_id: Number(r.contact_id),
    name: r.name,
    title: r.title,
    email: r.email,
    phone: r.phone,
    whatsapp: r.whatsapp,
    is_primary: !!r.is_primary,
    notes: r.notes,
  }));

  const price_history: SupplierPriceRow[] = (pricesRes.data ?? []).map((r: any) => ({
    price_id: Number(r.price_id),
    effective_date: r.effective_date,
    inv_sku: r.inv_sku,
    unit_price_usd: r.unit_price_usd != null ? Number(r.unit_price_usd) : null,
    unit_price_lak: r.unit_price_lak != null ? Number(r.unit_price_lak) : null,
    min_order_qty: r.min_order_qty != null ? Number(r.min_order_qty) : null,
    source: r.source,
    source_ref: r.source_ref,
    notes: r.notes,
  }));

  const alternates: SupplierAlternateRow[] = (altsRes.data ?? []).map((r: any) => {
    const alt = supMap.get(r.alternate_supplier_id);
    return {
      alt_id: Number(r.alt_id),
      alternate_supplier_id: r.alternate_supplier_id,
      alternate_code: alt?.code ?? '—',
      alternate_name: alt?.name ?? '—',
      preference_rank: Number(r.preference_rank ?? 0),
      notes: r.notes,
    };
  });

  const items_supplied: SupplierItemRow[] = (itemsRes.data ?? []).map((r: any) => ({
    item_id: r.item_id,
    sku: r.sku,
    item_name: r.item_name,
    category_name: r.category_id != null ? (catMap.get(r.category_id) ?? null) : null,
    last_unit_cost_usd: r.last_unit_cost_usd != null ? Number(r.last_unit_cost_usd) : null,
    is_primary: r.primary_vendor_id === supplierId,
  }));

  return { supplier, contacts, price_history, alternates, items_supplied };
}

// ============================================================================
// GL-DRIVEN SUPPLIERS (live from QuickBooks via gl.* schema)
// ============================================================================
// Wired from gl.v_supplier_overview / v_supplier_transactions /
// v_supplier_account_anomalies / v_supplier_vendor_account / v_top_suppliers_*.
//
// Source-of-truth: `gl.gl_entries.customer_name` (the QB transaction Name field
// on every line — QB combines customers/vendors/employees into one column).
// `v_supplier_overview` filters to qb_txn_type IN
//   ('Bill', 'Bill Payment (Cheque)', 'Cheque', 'Expense', 'Vendor Credit', 'Refund')
// — payable-side only — so it's effectively the "vendors we paid" list.
//
// We DO NOT join gl.vendors anymore (master is empty: 0 with email/category/terms).
// We DO filter to vendors active in 2026 (per PBS — "suppliers we worked with in 2026").
// Vendor routing key = vendor_name (URL-encoded).

const FILTER_YEAR_FROM = '2026-01-01';

export interface GlVendorOverviewRow {
  vendor_name: string;
  line_count: number;
  active_periods: number;
  first_txn_date: string | null;
  last_txn_date: string | null;
  gross_spend_usd: number;
  net_amount_usd: number;
  distinct_accounts: number;
  distinct_classes: number;
  currency_guess: string | null;
  is_active_recent: boolean;
}

export async function getGlVendorOverview(): Promise<GlVendorOverviewRow[]> {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return []; }
  const { data } = await safe(
    admin.schema('gl').from('v_supplier_overview')
      .select('vendor_name, line_count, active_periods, first_txn_date, last_txn_date, gross_spend_usd, net_amount_usd, distinct_accounts, distinct_classes, currency_guess, is_active_recent')
      .gte('last_txn_date', FILTER_YEAR_FROM)
      .order('gross_spend_usd', { ascending: false, nullsFirst: false }),
    { data: [] as any[] }
  );
  return (data ?? []).map((r: any) => ({
    vendor_name: r.vendor_name,
    line_count: Number(r.line_count ?? 0),
    active_periods: Number(r.active_periods ?? 0),
    first_txn_date: r.first_txn_date,
    last_txn_date: r.last_txn_date,
    gross_spend_usd: Number(r.gross_spend_usd ?? 0),
    net_amount_usd: Number(r.net_amount_usd ?? 0),
    distinct_accounts: Number(r.distinct_accounts ?? 0),
    distinct_classes: Number(r.distinct_classes ?? 0),
    currency_guess: r.currency_guess,
    is_active_recent: !!r.is_active_recent,
  }));
}

export interface GlSupplierKpisRow {
  vendor_count: number;
  active_recent_count: number;
  ytd_gross_spend_usd: number;
  current_month_gross_spend_usd: number;
  anomaly_count: number;
  top_vendor_share_pct: number | null;
  top_vendor_name: string | null;
}

export async function getGlSupplierKpis(): Promise<GlSupplierKpisRow> {
  const empty: GlSupplierKpisRow = {
    vendor_count: 0, active_recent_count: 0, ytd_gross_spend_usd: 0,
    current_month_gross_spend_usd: 0, anomaly_count: 0, top_vendor_share_pct: null, top_vendor_name: null,
  };
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return empty; }
  // Filter to 2026-active vendors (PBS: "suppliers we worked with in 2026")
  const [overview, ytdTop, mtdAll, anom] = await Promise.all([
    safe(admin.schema('gl').from('v_supplier_overview')
      .select('vendor_name, gross_spend_usd, is_active_recent')
      .gte('last_txn_date', FILTER_YEAR_FROM),
      { data: [] as any[] }),
    safe(admin.schema('gl').from('v_top_suppliers_ytd').select('vendor_name, gross_spend_usd, rank_ytd').order('rank_ytd').limit(1),
      { data: [] as any[] }),
    safe(admin.schema('gl').from('v_top_suppliers_current_month').select('gross_spend_usd'),
      { data: [] as any[] }),
    safe(admin.schema('gl').from('v_supplier_account_anomalies').select('vendor_name'),
      { data: [] as any[] }),
  ]);
  const ovRows = overview.data ?? [];
  const ytdRows = ytdTop.data ?? [];
  const mtdRows = mtdAll.data ?? [];
  const anomRows = anom.data ?? [];
  const ytdTotal = ovRows.reduce((s: number, r: any) => s + Number(r.gross_spend_usd ?? 0), 0);
  const top = ytdRows[0];
  return {
    vendor_count: ovRows.length,
    active_recent_count: ovRows.filter((r: any) => r.is_active_recent).length,
    ytd_gross_spend_usd: ytdTotal,
    current_month_gross_spend_usd: mtdRows.reduce((s: number, r: any) => s + Number(r.gross_spend_usd ?? 0), 0),
    anomaly_count: anomRows.length,
    top_vendor_share_pct: top && ytdTotal > 0 ? (Number(top.gross_spend_usd) / ytdTotal) * 100 : null,
    top_vendor_name: top?.vendor_name ?? null,
  };
}

export interface GlVendorTransaction {
  entry_id: string;
  txn_date: string;
  period_yyyymm: string;
  qb_txn_type: string | null;
  qb_txn_number: string | null;
  account_id: string | null;
  account_name: string | null;
  usali_subcategory: string | null;
  usali_line_code: string | null;
  usali_department: string | null;
  class_id: string | null;
  memo: string | null;
  amount_usd: number;
  txn_currency: string | null;
  txn_amount_native: number | null;
}

export interface GlVendorAccountSplit {
  period_yyyymm: string;
  account_id: string | null;
  account_name: string | null;
  qb_type: string | null;
  usali_subcategory: string | null;
  usali_line_code: string | null;
  usali_department: string | null;
  class_id: string | null;
  line_count: number;
  gross_amount_usd: number;
  net_amount_usd: number;
  first_txn: string | null;
  last_txn: string | null;
}

export interface GlVendorAnomaly {
  account_id: string | null;
  account_name: string | null;
  gross_amount: number;
  share_of_vendor_spend: number;
}

export interface GlVendorDetailBundle {
  overview: GlVendorOverviewRow | null;
  transactions: GlVendorTransaction[];
  account_splits: GlVendorAccountSplit[];
  anomalies: GlVendorAnomaly[];
}

export async function getGlVendorDetail(vendorName: string): Promise<GlVendorDetailBundle> {
  const empty: GlVendorDetailBundle = { overview: null, transactions: [], account_splits: [], anomalies: [] };
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return empty; }

  const [ovRes, txRes, splitRes, anomRes] = await Promise.all([
    safe(admin.schema('gl').from('v_supplier_overview')
      .select('vendor_name, line_count, active_periods, first_txn_date, last_txn_date, gross_spend_usd, net_amount_usd, distinct_accounts, distinct_classes, currency_guess, is_active_recent')
      .eq('vendor_name', vendorName).limit(1).maybeSingle(),
      { data: null as any }),
    safe(admin.schema('gl').from('v_supplier_transactions')
      .select('entry_id, txn_date, period_yyyymm, qb_txn_type, qb_txn_number, account_id, account_name, usali_subcategory, usali_line_code, usali_department, class_id, memo, amount_usd, txn_currency, txn_amount_native')
      .eq('vendor_name', vendorName).order('txn_date', { ascending: false }).limit(500),
      { data: [] as any[] }),
    safe(admin.schema('gl').from('v_supplier_vendor_account')
      .select('period_yyyymm, account_id, account_name, qb_type, usali_subcategory, usali_line_code, usali_department, class_id, line_count, gross_amount_usd, net_amount_usd, first_txn, last_txn')
      .eq('vendor_name', vendorName).order('gross_amount_usd', { ascending: false, nullsFirst: false }),
      { data: [] as any[] }),
    safe(admin.schema('gl').from('v_supplier_account_anomalies')
      .select('account_id, account_name, gross_amount, share_of_vendor_spend')
      .eq('vendor_name', vendorName).order('share_of_vendor_spend', { ascending: false, nullsFirst: false }),
      { data: [] as any[] }),
  ]);

  const ov = ovRes.data;
  const overview: GlVendorOverviewRow | null = ov ? {
    vendor_name: ov.vendor_name,
    line_count: Number(ov.line_count ?? 0),
    active_periods: Number(ov.active_periods ?? 0),
    first_txn_date: ov.first_txn_date,
    last_txn_date: ov.last_txn_date,
    gross_spend_usd: Number(ov.gross_spend_usd ?? 0),
    net_amount_usd: Number(ov.net_amount_usd ?? 0),
    distinct_accounts: Number(ov.distinct_accounts ?? 0),
    distinct_classes: Number(ov.distinct_classes ?? 0),
    currency_guess: ov.currency_guess,
    is_active_recent: !!ov.is_active_recent,
  } : null;

  return {
    overview,
    transactions: (txRes.data ?? []).map((r: any) => ({
      entry_id: r.entry_id,
      txn_date: r.txn_date,
      period_yyyymm: r.period_yyyymm,
      qb_txn_type: r.qb_txn_type,
      qb_txn_number: r.qb_txn_number,
      account_id: r.account_id,
      account_name: r.account_name,
      usali_subcategory: r.usali_subcategory,
      usali_line_code: r.usali_line_code,
      usali_department: r.usali_department,
      class_id: r.class_id,
      memo: r.memo,
      amount_usd: Number(r.amount_usd ?? 0),
      txn_currency: r.txn_currency,
      txn_amount_native: r.txn_amount_native != null ? Number(r.txn_amount_native) : null,
    })),
    account_splits: (splitRes.data ?? []).map((r: any) => ({
      period_yyyymm: r.period_yyyymm,
      account_id: r.account_id,
      account_name: r.account_name,
      qb_type: r.qb_type,
      usali_subcategory: r.usali_subcategory,
      usali_line_code: r.usali_line_code,
      usali_department: r.usali_department,
      class_id: r.class_id,
      line_count: Number(r.line_count ?? 0),
      gross_amount_usd: Number(r.gross_amount_usd ?? 0),
      net_amount_usd: Number(r.net_amount_usd ?? 0),
      first_txn: r.first_txn,
      last_txn: r.last_txn,
    })),
    anomalies: (anomRes.data ?? []).map((r: any) => ({
      account_id: r.account_id,
      account_name: r.account_name,
      gross_amount: Number(r.gross_amount ?? 0),
      share_of_vendor_spend: Number(r.share_of_vendor_spend ?? 0),
    })),
  };
}
