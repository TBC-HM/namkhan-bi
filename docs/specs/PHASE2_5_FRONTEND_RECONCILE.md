# Phase 2.5 Inventory — Frontend Reconcile Map

**Read this alongside the original spec.** It tells you where the spec drifts from the schema actually shipped to cloud, and gives you the exact paths/RPC calls/field names you need.

**Cloud state, verified 2026-05-02:** Supabase project `kpenyneooigsyuuomgct`. 4 schemas (`suppliers`, `fa`, `inv`, `proc`), 28 tables, 11 views, 2 RPCs, 3 triggers, all live. PostgREST `db_schemas` exposes them.

---

## 0 · Find-replace before you start

Spec says these → reality is these:

| Spec text | Cloud reality |
|---|---|
| `qb.inv_*`              | `inv.*`         (e.g. `qb.inv_items` → `inv.items`) |
| `qb.fa_*`               | `fa.*`          (e.g. `qb.fa_assets` → `fa.assets`, `qb.fa_capex_pipeline` → `fa.capex_pipeline`) |
| `qb.proc_*`             | `proc.*`        (e.g. `qb.proc_requests` → `proc.requests`) |
| `dq_findings`           | `gl.dq_findings` |
| `vendors(vendor_name)` join | `suppliers!vendor_id(name)` — see §1 below |
| `supabaseQb`            | `supabase` with `.schema('inv'\|'fa'\|'proc'\|'suppliers')` |

The supabase-js client uses `.schema(name)` to switch the default schema for a query chain:

```ts
const { data } = await supabase.schema('inv').from('items').select('*')
```

---

## 1 · Vendor joins — the one place the spec lies to you

Spec example (page 2):
```ts
.select('*, inv_locations(location_name), vendors(vendor_name)')
```

There is **no `vendors` table in `inv` schema**. The vendor relationship on every operational table FKs to **`suppliers.suppliers`** (UUID `supplier_id`, column `name` — *not* `vendor_name`).

Use this instead:
```ts
.select('*, inv_locations:location_id(location_name), suppliers!vendor_id(name, code, qb_vendor_ref)')
```

Three vendor tables exist. Use them like this:

| Table | When | What's in it |
|---|---|---|
| `suppliers.suppliers` | **Operational reads/writes** — every `vendor_id` FK points here | UUID PK, strategic data (lead time, sustainability, payment terms, distance for local-sourcing %) |
| `gl.vendors` | **QB sync mirror** — read-only display name lookup once QB sync runs tonight | Text PK, columns include `vendor_name` and `display_name` |
| `ops.vendors` | **GONE** — dropped 2026-05-02 | — |

If you want the QB-sourced display name for a vendor:
```ts
.select('*, suppliers!vendor_id(name, qb_vendor_ref, gl_vendors:qb_vendor_ref(vendor_name, display_name))')
```

The cross-schema join works because PostgREST resolves the soft text-FK via `qb_vendor_ref` once the `gl.vendors` row exists.

---

## 2 · Page-by-page status

### Page 1 — Overview · `/ops/inventory`

| Spec query | Reality | Notes |
|---|---|---|
| `from('v_inv_stock_on_hand').select('value_usd_estimate.sum()')` | `inv.v_inv_stock_on_hand` | Exposes per-item totals. Sum across rows for the KPI tile. |
| `from('v_inv_slow_movers').select('*', { count: 'exact', head: true })` | `inv.v_inv_slow_movers` | View hard-codes thresholds (≤5 units in 90d AND on_hand > 0). Filter further if you want UI control. |
| `from('v_inv_par_status').in('par_status', ['stock_out', 'below_par', 'reorder_now'])` | `inv.v_inv_par_status` | Statuses match spec exactly: `stock_out`, `reorder_now`, `below_par`, `overstocked`, `ok` |
| `from('inv_counts').select('count_date').order('count_date', desc).limit(1)` | `inv.counts` | ✓ |
| `from('inv_count_lines').select('variance_value_usd.sum()').neq('variance_value_usd', 0)` | `inv.count_lines` | `variance_value_usd` is a STORED generated column. ✓ |
| `from('v_inv_heatmap_health').select('*')` | `inv.v_inv_heatmap_health` | Returns: stock_out_count, reorder_count, below_par_count, overstocked_count, ok_count, total_items, **health_color** (red/amber/blue/green). Use `health_color` directly for cell bg. |
| `from('v_inv_usage_trend').select('item_id, units_consumed.sum()').order('sum', desc).limit(5)` | `inv.v_inv_usage_trend` | View is per-item-per-week for last 12w. Aggregate as needed. For "Top movers" sum across the 12 weeks per item. |
| `from('fa_capex_pipeline').eq('fiscal_year', 2026).order('estimated_cost_usd', desc)` | `fa.capex_pipeline` | ✓ |
| `from('v_fa_depreciation_current').eq('period_yyyymm', currentPeriod)` | `fa.v_fa_depreciation_current` | View has `period_yyyymm = current month` already baked in. `monthly_depreciation_usd` per asset; sum by `category_name` for the depreciation panel. |
| `from('v_proc_open_requests').limit(5)` | `proc.v_proc_open_requests` | Sorted by priority → submitted_at. ✓ |

**Pending receives KPI** (not in spec queries, but in mockup):
```ts
supabase.schema('proc').from('purchase_orders')
  .select('*', { count: 'exact', head: true })
  .in('status', ['sent', 'partially_received'])
```

**Tactical alerts** ("Spa oil expiry 5 units"):
```ts
supabase.schema('inv').from('v_inv_expiring_soon')
  .select('item_name, current_on_hand, days_until_expiry')
  .lt('days_until_expiry', 30)
  .order('days_until_expiry')
  .limit(10)
```

---

### Page 2 — Item Detail · `/ops/inventory/items/[item_id]`

| Spec query | Reality + change |
|---|---|
| `from('inv_items').select('*, inv_categories(*)').eq('item_id', itemId).single()` | `supabase.schema('inv').from('items').select('*, categories:category_id(*), units:uom_id(*)').eq('item_id', itemId).single()` |
| `from('v_inv_stock_on_hand').eq('item_id', itemId)` | ✓ |
| `from('v_inv_par_status').eq('item_id', itemId)` | Returns rows per location. Group in UI. |
| `from('inv_movements').select('*, inv_locations(location_name), vendors(vendor_name)')` | `supabase.schema('inv').from('movements').select('*, locations:location_id(location_name), suppliers!vendor_id(name)').eq('item_id', itemId).order('moved_at', { ascending: false }).limit(20)`. Note: spec says `movement_date` for ordering — column exists, but `moved_at` is more precise. |
| `from('v_inv_usage_trend').eq('item_id', itemId)` | Returns weekly buckets, last 12 weeks. Render as sparkline. |
| `from('v_inv_days_of_cover').eq('item_id', itemId).single()` | **Returns 3 cover figures** the spec asks for: `days_of_cover` (at burn), `days_until_par` (par_quantity sum), `days_until_reorder` (reorder_point). |
| `from('v_inv_expiring_soon').eq('item_id', itemId)` | Returns batches with expiry inside 60d. |

**Action button → schema mapping:**

| Spec button | Schema action |
|---|---|
| Adjust count | INSERT `inv.movements (movement_type='count_correction', quantity=Δ, location_id, item_id)`. Trigger updates `stock_balance` automatically. **No need for app-side balance maintenance.** |
| Move stock (transfer) | TWO INSERTs: `(transfer_out, location=A, qty=−N, counterparty=B)` then `(transfer_in, location=B, qty=+N, counterparty=A)`. |
| Mark write-off | INSERT `inv.movements (movement_type='write_off', quantity=−N, item_id, location_id)`. Trigger handles balance. |
| Schedule reorder | Route to `/ops/inventory/shop?prefill=<sku>&qty=<N>`. |

**Movement type vocabulary the schema accepts:**
`receive`, `issue`, `consume`, `transfer_in`, `transfer_out`, `count_correction`, `write_off`, `waste`, `open_stock`. (Spec used both `consume` and `issue` — both are valid.)

---

### Page 3 — Shop · `/ops/inventory/shop`

**Catalog cards** — query:
```ts
supabase.schema('inv').from('items')
  .select(`
    item_id, sku, item_name, last_unit_cost_usd, default_location_id,
    categories:category_id(name),
    units:uom_id(code, name),
    photos(storage_path, is_primary),
    par_status:v_inv_par_status!item_id(par_status, on_hand, par_quantity)
  `)
  .eq('is_active', true)
  .eq('catalog_status', 'approved')
```

**PR submit flow** — exactly as spec describes, but the table names change:

```ts
// 1. Insert PR header
const { data: pr } = await supabase.schema('proc').from('requests').insert({
  pr_title, requesting_dept, delivery_location_id,
  needed_by_date, priority, business_justification,
  status: 'draft'
}).select().single()

// 2. Insert line items (computed totals are STORED — don't pre-calculate)
await supabase.schema('proc').from('request_items').insert(
  cart.items.map(c => ({
    pr_id: pr.pr_id,
    item_id: c.item_id,
    quantity: c.qty,
    unit_cost_usd: c.unit_cost_usd
  }))
)

// 3. Submit + auto-route
const { data: status } = await supabase.schema('proc').rpc('proc_pr_submit', {
  p_pr_id: pr.pr_id,
  p_actor_id: user.id
})
// status is 'auto_approved' | 'pending_gm' | 'pending_owner'
```

**RPC signature exactly:**
```
proc.proc_pr_submit(p_pr_id UUID, p_actor_id UUID DEFAULT NULL) RETURNS TEXT
```

The RPC will:
- Aggregate `total_estimated_usd` from the line items (don't pre-compute it)
- Generate `pr_number` like `PR-2026-038`
- Decide approval level using `proc.config.auto_approve_under_usd` ($500 default) and `gm_approval_under_usd` ($5000 default)
- Insert audit row to `proc.approval_log`

**Propose new item flow** — table is `proc.new_item_proposals`:
```ts
await supabase.schema('proc').from('new_item_proposals').insert({
  proposed_name,
  proposed_description,
  category_id,
  uom_id,
  estimated_unit_cost_usd,
  likely_vendor_id,
  expected_monthly_usage,
  justification,
  photo_storage_path,
  status: 'pending_review'  // default — can omit
})
```

---

### Page 4 — Requests Queue · `/ops/inventory/requests`

**List query:**
```ts
supabase.schema('proc').from('requests')
  .select(`
    pr_id, pr_number, pr_title, requesting_dept,
    total_estimated_usd, status, required_approver_role,
    submitted_at, created_by,
    line_count:request_items(count)
  `)
  .order('submitted_at', { ascending: false })
```

**Tab filters:**
- "My requests" → `.eq('created_by', user.id)`
- "Pending my approval" → `.eq('required_approver_role', user.role)` + `.in('status', ['pending_gm','pending_owner'])` (filter further by role)
- "All" → no filter
- "History" → `.in('status', ['approved','rejected','closed'])`

**Approval click — RPC:**
```ts
const { data: newStatus } = await supabase.schema('proc').rpc('proc_pr_decide', {
  p_pr_id,
  p_actor_id: user.id,
  p_actor_role: user.role,           // 'owner' | 'gm' | 'hod'
  p_decision: 'approve',             // | 'send_back' | 'reject'
  p_notes: notes
})
```

RPC validates the actor role:
- `owner` can decide anything
- `gm` can decide PRs requiring `gm` or `auto`
- `hod` (or anyone else) gets a `RAISE EXCEPTION`

**Audit log** for the readonly history panel:
```ts
supabase.schema('proc').from('approval_log')
  .select('*')
  .eq('pr_id', pr_id)
  .order('occurred_at')
```

---

### Page 5 — PO Officer · `/ops/inventory/orders`

**KPI strip:**
```ts
// Open PRs awaiting PO
supabase.schema('proc').from('requests')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'approved')
  .is('converted_to_po_id', null)

// Open POs
supabase.schema('proc').from('purchase_orders')
  .select('*', { count: 'exact', head: true })
  .in('status', ['draft', 'sent', 'partially_received'])

// Awaiting receipt
supabase.schema('proc').from('purchase_orders')
  .select('*', { count: 'exact', head: true })
  .in('status', ['sent', 'partially_received'])

// Avg lead time (suppliers)
supabase.schema('suppliers').from('suppliers').select('lead_time_days.avg()')
```

**PO list:**
```ts
supabase.schema('proc').from('purchase_orders')
  .select(`
    po_id, po_number, total_usd, expected_delivery_date, status, qb_bill_ref,
    vendor:vendor_id(name),
    line_count:po_items(count)
  `)
  .order('created_at', { ascending: false })
```

**Status enum (proc.purchase_orders.status):**
`draft`, `sent`, `partially_received`, `received`, `invoiced`, `closed`, `cancelled`.

**Receipt modal — exact flow:**

```ts
// Step 1: log the receipt event
const { data: receipt } = await supabase.schema('proc').from('receipts').insert({
  po_id,
  po_item_id,
  received_qty,
  batch_code,
  expiry_date,
  quality_check_passed,
  rejected_qty,
  rejection_reason
}).select().single()

// Step 2: create the inv.movement (THIS is what updates stock_balance — the trigger does the rest)
const { data: movement } = await supabase.schema('inv').from('movements').insert({
  item_id,
  location_id: po.delivery_location_id,
  movement_type: 'receive',
  quantity: received_qty,
  unit_cost_usd,            // last-cost trigger updates items.last_unit_cost_usd from this
  unit_cost_lak,
  fx_rate_used,
  total_cost_usd: received_qty * unit_cost_usd,
  total_cost_lak: received_qty * unit_cost_lak,
  vendor_id: po.vendor_id,
  reference_type: 'po',
  reference_id: po.po_id,
  batch_code,
  expiry_date,
  movement_date: new Date()
}).select().single()

// Step 3: link the receipt back to the movement (soft pointer)
await supabase.schema('proc').from('receipts')
  .update({ movement_id: movement.movement_id })
  .eq('receipt_id', receipt.receipt_id)

// Step 4: bump the po_item.quantity_received and maybe close the PO
await supabase.schema('proc').from('po_items')
  .update({ quantity_received: existingQty + received_qty })
  .eq('po_item_id', po_item_id)
```

**No need to manually update `inv.stock_balance` or `inv.items.last_unit_cost_usd` — the trigger does both.**

**Mark invoiced / close PO:**
```ts
supabase.schema('proc').from('purchase_orders').update({
  status: 'invoiced',
  qb_bill_ref: qbBillId,
  qb_billed_date: new Date()
}).eq('po_id', po_id)
```

---

### Page 6 — Catalog Admin · `/ops/inventory/catalog`

**Pending proposals queue:**
```ts
supabase.schema('proc').from('new_item_proposals')
  .select(`
    proposal_id, proposed_name, proposed_description,
    estimated_unit_cost_usd, expected_monthly_usage, justification, photo_storage_path,
    proposed_at, proposed_by,
    category:category_id(name),
    uom:uom_id(code, name),
    likely_vendor:likely_vendor_id(name)
  `)
  .eq('status', 'pending_review')
  .order('proposed_at')
```

**Approve flow:**
```ts
// Step 1: Create catalog item
const { data: item } = await supabase.schema('inv').from('items').insert({
  sku: generated_sku,                 // app-side; SKU pattern your call
  item_name: proposal.proposed_name,
  description: proposal.proposed_description,
  category_id: proposal.category_id,
  uom_id: proposal.uom_id,
  primary_vendor_id: proposal.likely_vendor_id,
  last_unit_cost_usd: proposal.estimated_unit_cost_usd,
  catalog_status: 'approved',
  catalog_approved_by: user.id,
  catalog_approved_at: new Date(),
  is_active: true
}).select().single()

// Step 2: Mark proposal approved + link
await supabase.schema('proc').from('new_item_proposals').update({
  status: 'approved',
  reviewer_id: user.id,
  reviewed_at: new Date(),
  approved_item_id: item.item_id
}).eq('proposal_id', proposalId)
```

**Reject:**
```ts
supabase.schema('proc').from('new_item_proposals').update({
  status: 'rejected',
  reviewer_id: user.id,
  reviewed_at: new Date(),
  reviewer_notes: rejection_reason
}).eq('proposal_id', proposalId)
```

---

### Page 7 — Fixed Assets · `/ops/inventory/assets`

**Asset list:**
```ts
supabase.schema('fa').from('assets')
  .select(`
    asset_id, asset_tag, name, location, status, condition,
    category:category_id(name),
    supplier:supplier_id(name)
  `)
  .order('asset_tag')
```

**Per-asset NBV** (use the depreciation view):
```ts
supabase.schema('fa').from('v_fa_depreciation_current')
  .select('asset_id, book_value_usd, monthly_depreciation_usd, years_in_service')
```

**KPI strip:**
```ts
// Total NBV
supabase.schema('fa').from('v_fa_depreciation_current').select('book_value_usd.sum()')

// Annual depreciation
supabase.schema('fa').from('v_fa_depreciation_current')
  .select('monthly_depreciation_usd.sum()')   // × 12 in JS

// Maintenance due (next 30 days)
supabase.schema('fa').from('maintenance_log')
  .select('*', { count: 'exact', head: true })
  .gte('next_due_date', new Date())
  .lte('next_due_date', addDays(new Date(), 30))

// Disposed YTD
supabase.schema('fa').from('assets')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'disposed')
  .gte('disposal_date', startOfYear(new Date()))
```

**Asset detail card** — all fields are direct columns:

| Spec field | Column on `fa.assets` |
|---|---|
| Acquired | `purchase_date` |
| Acquisition cost | `purchase_cost_usd` |
| Useful life | `useful_life_years` (override) or `categories.default_useful_life_years` |
| Method | `depreciation_method` (override) or `categories.default_depreciation_method` |
| Net book value | `v_fa_depreciation_current.book_value_usd` |
| Accum. depreciation | `purchase_cost_usd - book_value_usd` (compute in UI) |
| Insurance value | `insurance_value_usd` |
| Warranty | `warranty_expiry` |
| Serial # | `serial_number` |
| Vendor | `supplier:supplier_id(name)` |

**Maintenance log:**
```ts
supabase.schema('fa').from('maintenance_log')
  .select('*, vendor:vendor_id(name)')
  .eq('asset_id', asset_id)
  .order('event_date', { ascending: false })
```

**Documents:**
```ts
supabase.schema('fa').from('documents').eq('asset_id', asset_id)
```

---

### Page 8 — Capex Pipeline · `/ops/inventory/capex`

**Kanban columns mapped to status:**

| Column | `status` value |
|---|---|
| Proposed | `proposed` |
| Under review | `under_review` |
| Approved | `approved` |
| Ordered | `ordered` |

(Also exists but not in mockup: `received`, `rejected`, `cancelled`.)

**Card query:**
```ts
supabase.schema('fa').from('capex_pipeline')
  .select(`
    capex_id, title, estimated_cost_usd, fiscal_quarter,
    expected_irr_pct, payback_months, status,
    category:category_id(name)
  `)
  .eq('fiscal_year', selectedYear)
  .order('estimated_cost_usd', { ascending: false })
```

**KPI strip:**
```ts
// Total proposed / approved / ordered
supabase.schema('fa').from('capex_pipeline')
  .select('status, estimated_cost_usd.sum()')
  .eq('fiscal_year', selectedYear)
  .group('status')
```

**"Convert to fixed asset" button** (when status='received'):
```ts
// Insert the asset
const { data: asset } = await supabase.schema('fa').from('assets').insert({
  asset_tag: generated_tag,
  name: capex.title,
  category_id: capex.category_id,
  supplier_id: capex.preferred_supplier_id,
  acquired_via: 'purchase',
  purchase_date: new Date(),
  in_service_date: new Date(),
  purchase_cost_usd: capex.estimated_cost_usd,
  useful_life_years: capex.expected_useful_life_years,
  status: 'in_service'
}).select().single()

// Link back
await supabase.schema('fa').from('capex_pipeline').update({
  converted_to_asset_id: asset.asset_id,
  status: 'received'
}).eq('capex_id', capex.capex_id)
```

---

### Page 9 — Stocktake · `/ops/inventory/counts`

**Load items for the location:**
```ts
supabase.schema('inv').from('par_levels')
  .select(`
    item_id, par_quantity,
    item:item_id(sku, item_name, category_id, last_unit_cost_usd, categories:category_id(name)),
    balance:stock_balance!inner(quantity_on_hand)
  `)
  .eq('location_id', location_id)
  .order('item.category.name')
```

**Submit count:**
```ts
// 1. Header
const { data: count } = await supabase.schema('inv').from('counts').insert({
  count_date: new Date(),
  location_id,
  count_type: 'periodic',
  status: 'submitted'   // skip 'draft' if user hits Submit not Save Draft
}).select().single()

// 2. Lines (variance + variance_value_usd are STORED generated columns — don't compute)
await supabase.schema('inv').from('count_lines').insert(
  rows.map(r => ({
    count_id: count.count_id,
    item_id: r.item_id,
    counted_quantity: r.counted_quantity,
    system_quantity: r.system_quantity,    // snapshot from stock_balance at count time
    unit_cost_usd: r.unit_cost_usd          // for variance valuation
  }))
)

// DQ findings auto-generate via trigger — no extra call needed.
// Spec: "if variance >5% or >$50, generates dq_findings row automatically"
// Trigger inv.fn_count_line_dq does this. Severity: critical (>25% or >$500), high (>5% or >$50), med.
```

**Approve count flow** (manager):
```ts
// 1. Mark count approved
await supabase.schema('inv').from('counts').update({
  status: 'approved',
  approved_by: user.id,
  approved_at: new Date()
}).eq('count_id', count_id)

// 2. For each line with non-zero variance, post a count_correction movement
//    (this resyncs stock_balance with reality — trigger handles balance update)
for (const line of approvedLines) {
  if (line.variance !== 0) {
    await supabase.schema('inv').from('movements').insert({
      item_id: line.item_id,
      location_id: count.location_id,
      movement_type: 'count_correction',
      quantity: line.variance,    // signed — trigger applies the delta
      reference_type: 'count',
      reference_id: count.count_id,
      notes: `Stocktake adjustment from count line ${line.count_line_id}`
    })
  }
}
```

---

## 3 · Triggers — what NOT to manually wire

The schema does these automatically. **Don't write app-side code for them.**

| Trigger | When | What it does |
|---|---|---|
| `inv.fn_movement_backfill_cost` | BEFORE INSERT on `inv.movements` | If outgoing (issue/consume/waste/transfer_out) and `unit_cost_usd` is null, fills from `inv.items.last_unit_cost_usd`. Sets `total_cost_usd = abs(qty) × unit_cost`. |
| `inv.fn_movement_update_balance` | AFTER INSERT on `inv.movements` | Upserts `inv.stock_balance` (qty += movement.quantity). On `receive`, sets `inv.items.last_unit_cost_usd` (LAST-COST method). On `count_correction`, bumps `last_count_at`. |
| `inv.fn_count_line_dq` | AFTER INSERT/UPDATE on `inv.count_lines` | If `\|variance\|/system_quantity > 5%` OR `\|variance_value_usd\| > $50`, inserts/upserts a row in `gl.dq_findings` with severity `critical`/`high`/`med`. Stable fingerprint dedupes. |

So your code for "user adjusts a count" is *just* the movement insert. The balance and last-cost update happen on the DB side.

---

## 4 · RBAC

**Today's RLS is coarse:**
- All authenticated users: read everything in `inv` / `fa` / `proc` / `suppliers`
- Write requires role `owner`, `gm`, or `hod` (any HOD can write any dept's data)

**The spec's per-page RBAC matrix (Finance read-only, HOD only own dept, etc.) is currently UI-side only.** Implement page-level visibility in your routing/component layer:

```tsx
const canSee = {
  shop:   ['hod', 'gm', 'owner'].includes(user.role),
  catalog:['gm', 'owner'].includes(user.role),
  assets: ['gm', 'finance', 'owner'].includes(user.role),
  capex:  ['gm', 'finance', 'owner'].includes(user.role),
  // etc.
}
```

**Tighter RLS comes in a follow-up migration** (`phase2_5_99_inventory_rls.sql`) once `app.user_roles.dept_code` is populated for users.

⚠️ Until then: **financial fields (`last_unit_cost_usd`, supplier `payment_terms`) are visible to every authenticated user.** If this matters, hide them in UI.

---

## 5 · FX / currency display

`gl.fx_rates` has columns `(rate_date, from_currency, to_currency, rate, source)`. Default base is LAK.

USD↔LAK conversion helper (current rate):
```ts
const { data: fx } = await supabase.from('gl.fx_rates')
  .select('rate')
  .eq('from_currency', 'USD').eq('to_currency', 'LAK')
  .order('rate_date', { ascending: false })
  .limit(1).single()

const lakValue = usdValue * fx.rate
```

Per memory the property uses ~21,800 LAK/USD as a constant — confirm with finance before any UI rounding rules.

---

## 6 · Empty states & UI patterns

Pure frontend concerns, schema doesn't care:
- Empty list views (`No items yet · Add first item`) → check `count === 0` after fetch
- Mobile-first pages (Shop, Counts, Item detail readonly)
- Currency toggle — store in component state, default USD

---

## 7 · Out of scope (for this PR — defer)

These spec items have **no schema today** and are explicitly deferred:

- Recipe management (which inv items roll into menu items) — needs `fb.recipes` + `fb.recipe_ingredients` extension
- Substitutes ("Lavender oil 100ml") — needs `inv.item_substitutes` table
- Purchase forecasting / auto-replenishment — needs ML or rule engine
- Vendor scorecards — derivable from existing data, just unbuilt
- Barcode scanning, OCR, GPS, push notifications — pure frontend / device

Don't block on these for the first PR. Hide the UI elements or stub them.

---

## 8 · Existing related schemas you'll touch

| Need | Where |
|---|---|
| Display `Linked GL acct: 121012 SPA INVENTORY` | `gl.accounts` (or `qb.accounts`) — JOIN on `inv.items.gl_account_code` |
| Display QB-sourced vendor name | `gl.vendors` — JOIN on `suppliers.suppliers.qb_vendor_ref` |
| Property timezone for "today" filters | Asia/Vientiane (per memory). Use SQL `CURRENT_DATE AT TIME ZONE 'Asia/Vientiane'` if precision matters. |
| User profile (roles, dept) | `app.profiles` (no `role` column — roles live in `app.user_roles` joined to `app.roles`). Use `app.has_role(['hod'])` SECURITY DEFINER fn for checks. |

---

## 9 · Build order suggestion

If you want to ship something testable fast:

1. **Page 9 Stocktake** first — pure write path, exercises every trigger, reveals any broken assumptions
2. **Page 1 Overview** — read-only, pure SELECTs, low risk
3. **Page 2 Item Detail** — reads + 4 action buttons (each one a single insert)
4. **Page 3 Shop + Page 4 Requests** together — they share the PR data model
5. **Page 5 PO Officer** — most complex flow, but builds on Page 4's primitives
6. **Page 7 Assets** + **Page 8 Capex** — separate read-mostly subsystem
7. **Page 6 Catalog Admin** — depends on Page 3's proposal flow producing data

Total: ~9 pages, but Pages 3+4 and Pages 7+8 overlap heavily. Realistic estimate: ~5-7 dev days for a competent dev who knows the existing component library.

---

## 10 · When in doubt

- **Is a column where the spec says it is?** Schema-of-record is in the four `phase2_5_*.sql` migration files in `supabase/migrations/`. Check there.
- **Does an RPC exist?** `select * from pg_proc where pronamespace = 'proc'::regnamespace`.
- **Did my insert work but the dashboard is stale?** Check the trigger fired (`select * from inv.stock_balance where item_id = ?`) — the materialized views (`mv_*` in `public`) are not part of Phase 2.5 and refresh on a different cron.
- **Field name mismatch?** Compare against the migration file. The migration is law.

---

*Last updated 2026-05-02. Cloud schema state verified at this date. If you hit a mismatch, check the migration files first, then re-run the audit query at the end of the PR script.*
