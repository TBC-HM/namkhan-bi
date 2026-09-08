# Marketing → Dashboard

**Route** `/h/{property_id}/marketing/dashboard`
**Brief** `marketing-dashboard-v1` (shipped 2026-09-08)
**Replaces** `/h/{property_id}/marketing/overview`, which now 308-redirects here.

One page, five tabs, fed by a single RPC. It replaced a four-widget overview page
that had no KPIs and linked to non-tenant URLs.

---

## Where the numbers come from

Everything on the page arrives in one call:

```sql
SELECT public.fn_mkt_dash_payload(p_property_id => 260955, p_max_age_minutes => 1440);
```

- The function returns `marketing.dash_payload_cache` when the cached row is
  younger than `p_max_age_minutes`, otherwise it recomputes **inline (~17 s)**.
- Cron `mkt-dash-refresh-15min` (job 265 → `fn_mkt_dash_refresh_all`) keeps the
  cache warm every 15 minutes. **The cron owns refresh; the page never should.**
- The page therefore passes `p_max_age_minutes: 1440`, not 15 — see
  [Why max_age is a day](#why-max_age-is-a-day).

**No metric is computed in the frontend.** The component formats and colours
only. If a number is wrong, fix the view or the payload function — not the page.

## Files

| File | Role |
|---|---|
| `app/h/[property_id]/marketing/dashboard/page.tsx` | server component, one RPC, error card |
| `app/h/[property_id]/marketing/dashboard/MarketingDashboard.tsx` | client component, five tabs |
| `app/h/[property_id]/marketing/dashboard/types.ts` | payload types |
| `app/h/[property_id]/marketing/overview/page.tsx` | `permanentRedirect` (308) to this page |
| `app/api/marketing/dashboard/route.ts` | optional JSON endpoint, `?pid=` |
| `lib/dept-cfg/index.ts` | Marketing menu item "Dashboard" |

## Tabs

`#today` · `#revenue` · `#reach` · `#segments` · `#goals`

Deep-linkable by hash **and** `?tab=`; ←/→ move between tabs and update the hash.
Tab badges come straight from `payload.badges`.

| Tab | Contains |
|---|---|
| Today | freshness strip, reach barometer + sparklines, ranked action queue, next 30 days |
| Revenue | direct share, bookings, reputation, demand inbox; markets / sources / channel mix |
| Reach | website→booking, search, social, subscribers; execution pipeline |
| Segments & funnels | funnels, retreats & wellness, segment coverage, ICP table |
| Goals & data | goals table (target / now / stored / deadline), data-health list |

## Action queue

Rows come from `marketing.dash_action_rules` (13 enabled). Each renders in rank
order with a severity tag and one or two CTAs. **Every CTA href is
`/h/{pid}` + `route_path`.**

To change what the queue says or where it points, edit the rows — never the page:

```sql
UPDATE marketing.dash_action_rules SET route_path = '/marketing/social' WHERE rule_key = '…';
```

### Link check (verified live 2026-09-09)

All 12 distinct CTA routes return 200 for Namkhan. **No 404s.**

`/guest/reputation` · `/marketing/audience` · `/marketing/campaigns` ·
`/marketing/content` · `/marketing/digital/web` · `/marketing/funnels` ·
`/marketing/seo` · `/marketing/social` · `/marketing/youtube` · `/operations` ·
`/revenue` · `/sales`

> The brief predicted `/marketing/youtube` and `/operations` would 404. They do
> not — both resolve. No `route_path` rows need repointing.

Note that `/h/{pid}/…` paths without a dedicated page still resolve for Namkhan:
`app/h/[property_id]/[...rest]/page.tsx` forwards to the legacy flat tree. File
absence is not the same as a 404 — check with HTTP.

## Tenancy

`property_id` comes from the route param only. There is **no default** — a
non-numeric segment is `notFound()`. The page reads through `getSupabaseAdmin()`
(service role); `fn_mkt_dash_payload`'s guard exempts `service_role` and
otherwise enforces `core.has_property_access`.

Donna (1000001) has no `marketing.dash_source_map` row, so nine tiles arrive as
JSON `null` — `website`, `search`, `reputation`, `retreats`, `demand_inbox`,
`icp_coverage`, `social_publishing`, `subscribers`, `villa_direct`. They are
typed nullable and guarded; the page renders with em dashes rather than crashing.

---

## Known limitations

**`?refresh=1` cannot show a fresh `generated_at`.** It correctly passes
`p_max_age_minutes: 0`, but the inline recompute takes ~17 s and exceeds the
PostgREST statement timeout, so the RPC errors. The page falls back to the cached
payload and shows an amber banner naming the failure — you keep the dashboard,
you just do not get fresh numbers. **This is brief acceptance criterion 7 and it
is unmet.** Fixing it needs SQL that the brief forbade: a `SET statement_timeout`
on `fn_mkt_dash_payload`, or an async refresh that returns the stale cache
immediately.

**Donna's cache is not refreshed.** `fn_mkt_dash_refresh_all` skips tenants with
no `dash_source_map` row. Her cached payload ages indefinitely; past 24 h a page
load falls through to the recompute and hits the same timeout. Closes when
1000001 gets a `dash_source_map` row (brief §8).

**Editorial notes are Namkhan-specific.** Several tile captions state
conclusions ("PMS maps SLH to OTA", "no paid spend, no CPA"). They are static
copy from the design, shown to every tenant regardless of that tenant's data.

## Why max_age is a day

`fn_mkt_dash_payload` recomputes inline whenever the cache is older than
`p_max_age_minutes`. At 15 minutes, any tenant whose cron refresh is not running
falls through to a 17-second server render that blows the statement timeout and
renders nothing. This is exactly how Donna's page died before the fix. A page
load must never trigger that recompute for any tenant, so the page accepts a
day-old cached payload and prints the true `generated_at` and cache age in the
header, where staleness is visible rather than hidden.

## Deviations from the brief

1. Route param is `[property_id]`, not the brief's `[pid]` — the folder name *is*
   the param name, so the handoff paths would have 404'd.
2. Uses `getSupabaseAdmin()`, not `createClient` from `@/lib/supabase/server`.
   That shim's docstring says "anon" but it re-exports the **service-role**
   singleton; `getSupabaseAdmin()` is the repo's real server-read pattern and is
   honest about which key it uses.
3. `params` / `searchParams` are typed as Promises and awaited (Next 14 here).
4. Display helpers take a widened `Val` type instead of ~40 `as Num` casts —
   jsonb numerics can arrive as strings, and a cast would have hidden that.
5. No secondary tab bar needed hiding: `lib/nav-subgroups.ts` has no subgroup
   matching `/marketing/dashboard`, so the shell draws none.

## Change log

| Commit | Change |
|---|---|
| `ce9a59ab` | Initial build; old overview page deleted with its five legacy non-tenant links |
| `db43de43` | `p_max_age_minutes` 15 → 1440; page never recomputes synchronously |
| `60230a28` | `?refresh=1` falls back to the cached payload instead of a dead page |
| `008141b7` | Dates render in UTC — server/client mismatch was breaking hydration |
