// app/operations/inventory/_data.ts
//
// Shared server-side data helpers for the inventory module.
// Uses service-role client because anon has no grants on inv/fa/suppliers/proc.
// Same pattern as /api/marketing/upload.

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
}

export async function getInventorySnapshot(): Promise<InvSnapshotKpis> {
  const empty: InvSnapshotKpis = {
    itemsActive: 0, itemsTotal: 0, belowPar: 0, slowMovers: 0,
    inventoryValueUsd: 0, openPosUsd: 0, pendingRequests: 0,
    suppliersActive: 0, localSourcingPct: 0, capexProposedUsd: 0, capexApprovedUsd: 0, faNbvUsd: 0,
  };
  let admin;
  try { admin = getSupabaseAdmin(); } catch { return empty; }

  const [items, stock, pars, openPos, openPrs, sups, capex, fa] = await Promise.all([
    safe(admin.schema('inv').from('items').select('item_id, last_unit_cost_usd, is_active').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('stock_balance').select('item_id, location_id, quantity_on_hand, last_movement_at').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('inv').from('par_levels').select('item_id, location_id, par_quantity').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('proc').from('purchase_orders').select('total_usd, status').in('status', ['draft','sent','partially_received']).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('proc').from('requests').select('pr_id, status').in('status', ['submitted','pending_gm','pending_owner']).then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('suppliers').from('suppliers').select('supplier_id, status, is_local_sourcing').eq('status', 'active').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('fa').from('capex_pipeline').select('estimated_cost_usd, status').then(r => r.data ?? []), [] as any[]),
    safe(admin.schema('fa').from('assets').select('purchase_cost_usd, residual_value_usd, in_service_date, useful_life_years, status').eq('status', 'in_service').then(r => r.data ?? []), [] as any[]),
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
  const today = new Date();
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
