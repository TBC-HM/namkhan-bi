# Cross-schema federated search — when one question needs multiple schemas

Some questions span the whole database. The agent must JOIN or UNION across
schemas, not just query one table.

## When to federate

| User question pattern | Schemas to consult |
|---|---|
| "guest profile of X" / "tell me about guest X" | `guest.profiles`, `cb_reservations`, `cb_reservation_rooms`, `cb_payments`, `marketing.reviews`, `frontoffice.vip_briefs`, `sales.inquiries` |
| "everything on supplier Y" | `gl.v_supplier_overview`, `gl.v_supplier_transactions`, `proc.purchase_orders`, `suppliers.suppliers`, `docs.documents WHERE external_party='Y'` |
| "show me all SLH content" | `docs.documents WHERE external_party='SLH'`, `docs.bookmarks WHERE category='partner' AND tags @> '{slh}'`, `gl.v_supplier_transactions WHERE vendor_name ILIKE '%slh%'` |
| "audits in 2024" | `docs.documents WHERE doc_type='audit' AND period_year=2024`, `docs.alerts WHERE alert_kind LIKE 'audit%'` |
| "F&B everything" | `gl.v_pl_monthly_usali WHERE usali_subcategory IN (...)`, `kpi.v_capture_rate_daily WHERE dept='F&B'`, `inv.v_inv_stock_on_hand WHERE category_code IN ('FB_FOOD','FB_BEVERAGE')`, `docs.documents WHERE doc_type='sop' AND doc_subtype='fb'` |
| "what do we have for [partner X]" | UNION across docs + bookmarks + suppliers + reviews mentioning X |

## Pattern: UNION ALL with source label

```sql
WITH guest_results AS (
  SELECT 'reservation' AS source, ... FROM cb_reservations WHERE guest_name ILIKE '%X%'
  UNION ALL
  SELECT 'review', ... FROM marketing.reviews WHERE guest_name ILIKE '%X%'
  UNION ALL
  SELECT 'profile', ... FROM guest.profiles WHERE name ILIKE '%X%'
)
SELECT * FROM guest_results LIMIT 200;
```

## Pattern: CTE-based aggregation

When the answer is "summary across schemas":

```sql
WITH counts AS (
  SELECT 'docs' AS area, COUNT(*) AS n FROM docs.documents WHERE external_party='SLH'
  UNION ALL
  SELECT 'bookmarks', COUNT(*) FROM docs.bookmarks WHERE 'slh' = ANY(tags)
  UNION ALL
  SELECT 'transactions', COUNT(*) FROM gl.v_supplier_transactions WHERE vendor_name ILIKE '%slh%'
)
SELECT * FROM counts WHERE n > 0;
```

## Joining via natural keys

Common JOIN keys across schemas:

| Key | Schemas where it appears |
|---|---|
| `property_id` (260955 for The Namkhan) | almost everywhere |
| `external_party` / `vendor_name` | docs, suppliers, gl |
| `guest_id` / `cloudbeds_guest_id` | guest.*, cb_reservations |
| `reservation_id` | cb_reservations, cb_reservation_rooms, cb_payments, frontoffice.vip_briefs |
| `period_yyyymm` | gl.*, kpi.*, plan.* |

## When NOT to federate

- Question scoped to a single domain ("ADR last month") → single source.
- Question is a doc-content question ("what does the SLH agreement say") → use docs Q/A path, not data agent.
