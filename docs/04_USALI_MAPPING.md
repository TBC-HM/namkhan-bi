# 04 — USALI Mapping

> USALI 11th edition (Uniform System of Accounts for the Lodging Industry).
> Mapping is data-driven via the `usali_category_map` table. 119 active rules.

## How it works

1. Every transaction has `category`, `item_category_name`, and `description`.
2. We try to match against `usali_category_map` in priority order (lowest priority number wins).
3. Match types:
   - `ilike` — substring match against `item_category_name`, then fallback to `description` if cat is empty.
   - `regex` — POSIX regex (`\m...` for word-boundary at start; `\m...\M` for both ends).
4. First match per transaction is kept (`ROW_NUMBER() OVER (PARTITION BY transaction_id ORDER BY priority, id)`).
5. Result lives in `mv_classified_transactions` with columns `usali_dept` and `usali_subdept`.

## Priority bands

| Priority | Used for | Examples |
|---|---|---|
| 5 | Adjustments / voids | `adjustment`, `void` |
| 10 | Rooms revenue | `room_revenue`, `rate` |
| 20 | Tax / fee | `tax`, `fee` |
| 25 | High-priority OO disambiguation | `Inside Activity`, `Outside Activity`, `Hotel Shop`, `Pool Bar`, `Front office`, `Guest Services` |
| 30 | F&B granular + most OO + Spa/Activity items | menu items, `Massage`, `Yoga`, `Tubing`, `\mside` (regex), etc. |
| 35 | F&B catch-all (broader words) | `Menus`, `Food`, `Drink`, `Children` |
| 40 | Other Operated catch-all | `Spa` (whole word), `Tour`, `Excursion`, `Laundry` |
| 45 | Generic addons / front office | `addon`, `Front office`, `Guest Services` |
| 50 | Retail | `Handicraft`, `Boutique`, `Shop`, `product`, `notebook`, `T-Shirt` |

## USALI departments and sub-depts

| Department | Sub-dept | Cloudbeds source examples |
|---|---|---|
| **Rooms** | Transient | `reservation_rooms.rate` × occupied nights |
| **F&B** | Food | `Main Courses`, `Starters`, `Salads`, `Desserts`, `Sides`, `Childrens Menu`, `Pad Thai`, `Burger`, `Curry`, `Dream Craft Set`, `Lao BBQ`, `Tigger Trails Menu`, `Caesar`, `Junior Menu`, `Chef Moh's…` |
| **F&B** | Beverage | `Wine & Sparkling`, `Cocktails`, `Spirits`, `Gin`, `Rum`, `Vodka`, `Cognac`, `Mocktails`, `Soft Drinks & Juices`, `Tea/Coffee`, `Laotian Beers`, `Smoothies`, `Mojito`, `Pandan Colada`, `Margarita`, `Namkhan Sour` |
| **F&B** | Minibar | `MInibar Billing` *(typo preserved as in PMS)* |
| **Other Operated** | Spa | `Spa`, `Massage`, `Aroma of Lao`, `Rituals`, `Breath Work` |
| **Other Operated** | Activities | `Inside Activity`, `Outside Activity`, `External Activity`, `Yoga`, `Tubing`, `Cooking Class`, `Bamboo Weaving`, `Kayak`, `Cruise`, `Elephant`, `Alms Giving`, `Day Pass`, `Pool day use`, `Sunset Fire`, `Nanny`, `Baby Sitting`, `QI Gong` |
| **Other Operated** | Transportation | `Transportation`, `Transfer` |
| **Other Operated** | Laundry | `Laundry` |
| **Other Operated** | Front Office | `Front office`, `Guest Services` |
| **Retail** | (no sub) | `Hotel Shop`, `Namkhan Handicrafts`, `Boutique`, `Books/Toys/Paint`, `notebook`, `T-Shirt`, `Tin candle`, `Pencil`, `Other Products`, generic `product` |
| **Tax** | — | `tax` patterns |
| **Fee** | — | `fee` patterns |
| **Adjustment** | (Void) | `adjustment`, `void` |
| **Misc Income** | Internal | `internal` |
| **Unclassified** | (fallback) | Anything that didn't match — currently <6%/month, ~0.6% in April 2026 |

## Hard-won lessons (do NOT undo)

1. **`Side` was matching `Inside`/`Outside`** → use `\mside` regex (word boundary at start) so plurals like `Sides` still match but `Inside Activity` doesn't.
2. **`Beer` was missing `Beers`** → use `\mbeer` (boundary only at start), so `Beers` matches.
3. **Inside / Outside Activity** must have priority 25, ABOVE F&B granular (30), because they contain the substring `Side` which collides with F&B.
4. **Description fallback only when `item_category_name` is empty**. We checked: if empty AND description matches → classify. Avoids false positives where item_category_name is correct but description has noise.
5. **Materialize the classifier** (`mv_classified_transactions`) — the join with 119 patterns × 76k transactions is too slow inside a view that's recomputed on every dependent refresh.

## Maintenance

- Owner: PBS.
- When you see new categories in PMS or new menu items: add a row to `usali_category_map` with appropriate priority.
- After adding rows: `REFRESH MATERIALIZED VIEW mv_classified_transactions;` followed by the dependent views.
- `refresh_bi_views()` does this in correct order automatically.

## Statistics (USALI Schedule 1)

| Metric | View / Source |
|---|---|
| Available Rooms | `v_property_inventory.total_rooms × days` (= 19 × days; Tent 7 excluded) |
| Occupied Rooms | `mv_kpi_daily.rooms_sold` |
| Complimentary Rooms | reservations where `market_segment='Complimentary'` (rare, mostly NULL today) |
| House Use | `market_segment='House-Use'` |
| OOO/OOS | NOT AVAILABLE — Cloudbeds scope blocked |
| Total Guests | sum(adults+children) on occupied rooms |

## Mapping audit query

```sql
-- What's still leaking through as Unclassified?
SELECT item_category_name, description, COUNT(*) AS n, SUM(amount) AS amt
FROM mv_classified_transactions
WHERE usali_dept = 'Unclassified'
  AND transaction_date >= CURRENT_DATE - 30
  AND category IN ('custom_item','product','addon')
GROUP BY 1, 2
ORDER BY amt DESC NULLS LAST
LIMIT 20;
```

Expected output: tail of long-tail menu items / one-off charges. If totals exceed ~$500/month, add patterns.
