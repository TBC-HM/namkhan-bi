# Operations → Quality

**Route** `/h/{property_id}/operations/quality`
**Brief** `quality-dashboard-v1` (shipped 2026-09-08)
**Module** `ops_sop_qa_module` — this page is the module's owning surface.

Six tabs that make the five quality loops measurable — standards → people →
verification → guest signal → corrective action — and correlate HR data with
quality per department.

---

## Where the numbers come from

Everything on the page arrives in one call:

```sql
SELECT public.fn_qa_dash_payload(p_property_id => 260955, p_max_age_minutes => 1440);
```

- Returns `ops.qa_dash_payload_cache` when the cached row is younger than
  `p_max_age_minutes`, otherwise recomputes inline (~0.5 s).
- Cron `qa-dash-refresh-15min` (`fn_qa_dash_refresh_all`, at :05 :20 :35 :50)
  keeps the cache warm. A nightly job writes measured goals back to
  `governance.tenant_goals.current_value` at 02:25.
- 26 `public.v_qa_dash_*` views feed the compute; every row carries `property_id`.

**No metric is computed in the frontend.** The component formats and colours
only. If a number is wrong, fix the view — not the page.

## Files

| File | Role |
|---|---|
| `app/h/[property_id]/operations/quality/page.tsx` | server component, one RPC, error card |
| `app/h/[property_id]/operations/quality/QualityDashboard.tsx` | client component, six tabs |
| `app/h/[property_id]/operations/quality/types.ts` | payload types, transcribed from the views |
| `lib/dept-cfg/index.ts` | Operations menu item "Quality" (second, after HoD) |

## Tabs

`#today` · `#depts` · `#standards` · `#people` · `#verify` · `#guest`

Deep-linkable by hash **and** `?tab=`; ←/→ move between tabs and update the hash.
Tab badges come straight from `payload.badges`.

| Tab | Contains |
|---|---|
| Today | quality-loop strip (n of 5 live), ranked action queue, goals, freshness, next 60 days |
| Departments | the matrix — staff, skills, logins, HOD, SOPs, certs, PM, audit, themes, audit-ready dot |
| Standards & SOPs | registry, language & visuals, proposals backlog, SOP↔task↔agent; by-department table |
| People & training | certification coverage, skills & SPOF, learning platform, workforce stability |
| Audits & PM | preventive maintenance (wide), QA audits, external standards; compliance register, DQ |
| Guest signal & CAPA | low reviews, themes→departments, CAPA loop; low-review table |

### The department matrix

`audit_ready` (the last-column dot) is true when **all four** hold: SOPs in date
∧ certificates cover the required FTE ∧ PM ≥ 90 % of scheduled in 30 d ∧ an audit
within 90 days. The four `ok_*` booleans colour their own columns.

Department codes are unified through `ops.qa_dept_alias` (53 rows) — `sop_meta`,
`sop_proposals` and `hr.positions` each use their own code set. Review themes map
to departments through `ops.qa_theme_dept_map` (11 rows). **Both are data: add
rows, don't edit code.**

## Action queue

Rows come from `ops.qa_dash_action_rules` (15 enabled, 6 red). Each renders in
rank order with a severity tag and one or two CTAs. **Every CTA href is
`/h/{pid}` + `route_path`.**

```sql
UPDATE ops.qa_dash_action_rules SET route_path = '/operations/maintenance' WHERE rule_key = '…';
```

### Link check (verified live 2026-09-09) — four routes 404

| Route | Status | Fires from |
|---|---|---|
| `/operations/pm` | **404** | rule 3 (red), Standards tile, PM tile |
| `/hr/training` | **404** | rule 5 (red), certification-coverage tile |
| `/legal` | **404** | rule 10 (amber) |
| `/operations/data-quality` | **404** | rule 15 (grey) |
| `/operations/staff` · `/operations/sops` · `/operations/qa` · `/operations/sustainability` · `/guest/reputation` · `/university` | 200 | — |

> Corrections to the brief's predicted list: **`/operations/qa` resolves** (it was
> predicted to 404), and **`/operations/pm` 404s** (it was not predicted). The PM
> one matters most — it is a red rank-3 CTA and appears in two tiles.

Fix by repointing the rows, not by inventing pages. `/operations/maintenance`
exists and is the closest live equivalent to `/operations/pm`.

Note that `/h/{pid}/…` paths without a dedicated page still resolve for Namkhan:
`app/h/[property_id]/[...rest]/page.tsx` forwards to the legacy flat tree. File
absence is not the same as a 404 — check with HTTP.

## Tenancy

`property_id` comes from the route param only. There is **no default**. The page
reads through `getSupabaseAdmin()` (service role); `fn_qa_dash_payload`'s guard
exempts `service_role` and otherwise enforces `core.has_property_access`.

Global registers that carry no `property_id` — `sop_proposals`, the legal
register, sustainability, university — are attributed to whichever tenant has
`ops.qa_dash_source_map.owns_global_registers` (Namkhan today).

Donna (1000001) has no `qa_dash_source_map` row. Her payload still returns 6
actions and 13 department rows, but these keys are JSON `null`: `loops`,
`guest.summary`, `people.learning`, `verification.pm`, `verification.audits`,
`verification.legal`, `verification.sustainability`. All are typed nullable and
guarded; the page renders with em dashes.

---

## Known limitations

**Editorial notes are Namkhan-specific.** Tile captions state fixed conclusions —
"generate → assign → verify: broken at assign", "housekeeping, 10 rooms, this
week", "core defect of the standards loop". They are static design copy shown to
every tenant. On Donna, where the PM tile is entirely em dashes, "broken at
assign" is asserted about a tenant with no PM data at all. Cosmetic, but it
states a diagnosis the payload did not support.

**Four CTAs 404** — see the link check above. Data fix, not a code fix.

**The module's page-probe still points at the old URL.** The ship-gate probe for
`ops_sop_qa_module` checks `/operations/sops`, not this page. Worth repointing so
the gate tests the surface the module now owns.

## What this page is waiting on

The dashboard measures loops that mostly have no data yet. `docs/` has no
follow-on file; the three briefs named in `quality-dashboard-v1` §8 are:

- `staff-positions-link-v1` — link staff to `hr.positions`, set the 16
  `departments.hod_user_id`, create HOD logins, load existing certificates.
  Unblocks certs %, HOD coverage, per-department ownership.
- `qa-audit-capture-v1` — assign PM instances, mandatory evidence by
  `verification_type`, first internal audit, one finding per low review.
  Unblocks PM %, audit score, findings aging.
- `training-records-v1` — Lao translations and visual packs, one university
  module per operational SOP, attendance on pass.

Until those land, most tiles honestly read zero. That is the point of the page.

## Deviations from the brief

1. Route param is `[property_id]`, not the brief's `[pid]`.
2. Uses `getSupabaseAdmin()`, not `createClient` from `@/lib/supabase/server`
   (that shim is service-role despite its "anon" docstring).
3. `params` / `searchParams` typed as Promises and awaited (Next 14 here).
4. **`types.ts` does not use `any`.** The handoff declared
   `Row = Record<string, any>`, which switched off checking on every table — the
   department matrix alone reads 26 fields. Replaced with interfaces transcribed
   from the live views via `information_schema`, so a mistyped column is a build
   error rather than a silent em dash. Flat summary tiles keep an
   index-signature `Row`.
5. `p_max_age_minutes` is 1440 on normal loads, not 15, so a page load never
   triggers an inline recompute (this is what killed the marketing page for
   Donna). `?refresh=1` still passes 0 — and **works here**, because the QA
   recompute is ~0.5 s rather than marketing's 17 s.
6. No secondary tab bar needed hiding: `lib/nav-subgroups.ts` has no subgroup
   matching `/operations/quality`.

## Change log

| Commit | Change |
|---|---|
| `b5735248` | Initial build; Operations menu item added |
| `f674ee57` | `payload.loops` is null for a tenant with no source_map row — page crashed on Donna |
| `008141b7` | Dates render in UTC — server/client mismatch was breaking hydration |
