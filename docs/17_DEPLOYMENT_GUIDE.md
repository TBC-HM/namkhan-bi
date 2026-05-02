# 17 — Deployment Guide

> Canonical reference for shipping, redeploying, and maintaining the Namkhan BI dashboard.
> The repo also has a `DEPLOY.md` at the root with the click-by-click commands.
> For a wider platform assessment, see `docs/PROJECT_ASSESSMENT_2026-05-02.md`.

## Components (verified 2026-05-02)

| Component | Where | Notes |
|---|---|---|
| Database | Supabase project `kpenyneooigsyuuomgct` (eu-central-1) | Postgres 17.6.1.111, ACTIVE_HEALTHY, 159 migrations applied |
| Sync | Supabase edge function `sync-cloudbeds` | Deno, **v11**, JWT off (5 functions total: `sync-cloudbeds`, `sync-cloudbeds-diag`, `cb-probe`, `media-ingest`, `media-tag`) |
| Mat-view refresh | `pg_cron` schedule `refresh_bi_views` (every 15 min) + `refresh-channel-economics` (daily 02:15 UTC) | one-off SQL setup |
| Dashboard frontend | Vercel project `namkhan-bi` (`prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl`, team `pbsbase-2825's projects`, region `fra1`) | **CLI deploy only — `git push` does NOT trigger build, see "Pushing updates" below** |
| Custom domain (optional) | `bi.thenamkhan.com` → CNAME to Vercel | provisioned via Vercel domain settings |
| GitHub repo | `github.com/TBC-HM/namkhan-bi` | CI workflow runs lint/typecheck/build on push to main; supabase-diff workflow runs on PRs touching migrations |

## First-time deploy

See root `DEPLOY.md`. Summary:

1. Get Supabase anon key from Project Settings → API
2. `git clone https://github.com/TBC-HM/namkhan-bi.git ~/Desktop/namkhan-bi`
3. `cd ~/Desktop/namkhan-bi && npx vercel link` → scope `pbsbase-2825's projects`, project `namkhan-bi`
4. `npx vercel env pull .env.local`
5. `npx vercel --prod --yes --force` to ship
6. Schedule `pg_cron` for `refresh_bi_views()` (one-time, in Supabase SQL)
7. (Optional) Configure custom domain

## Environment variables (production)

All six set on Vercel as of 2026-05-02:

| Name | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kpenyneooigsyuuomgct.supabase.co` | API endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase dashboard) | Anon read on mat views |
| `DASHBOARD_PASSWORD` | (strong, shared out-of-band) | Single-password gate |
| `NEXT_PUBLIC_FX_LAK_USD` | `21800` | LAK per USD; revisit quarterly |
| `NEXT_PUBLIC_PROPERTY_ID` | `260955` | Cloudbeds property scope |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase dashboard) | Required for `/api/marketing/upload-sign`, DMC contract upload, payslip upload |

## Pushing updates (CLI only — see DEPLOY.md "Why no auto-deploy")

`git push` does NOT auto-deploy. Every code change requires manual:

```bash
cd ~/Desktop/namkhan-bi
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
npx --yes tsc --noEmit                  # mandatory — catches what Vercel build doesn't
npx --yes vercel --prod --yes --force   # --force mandatory — see DEPLOY.md "Why --force"
```

Then verify with the two-URL test (`/overview` and `/overview?win=l12m` must both 200, KPIs must differ).

To fix this and get real `git push` → auto-deploy, see `DEPLOY.md` section "Why no auto-deploy" — two options (Vercel GitHub App on TBC-HM, or VERCEL_TOKEN secret + re-add `vercel-deploy.yml`).

## Refreshing data

| Mechanism | Frequency | Purpose |
|---|---|---|
| `cb_hourly_refresh()` (pg_cron) | Hourly | Pulls recent reservation changes from Cloudbeds |
| `refresh_bi_views()` (pg_cron) | Every 15 min | Refreshes all 9 mat views |
| `refresh-channel-economics` (pg_cron) | Daily 02:15 UTC | Refreshes period-keyed channel matviews |
| Manual full re-sync | On demand | When historical data needs reconciliation |

To manually refresh:

```sql
-- Pull recent changes from Cloudbeds
SELECT cb_sync_recent_reservations();

-- Then refresh BI views
SELECT public.refresh_bi_views();
```

## Adding new USALI patterns

When new menu items / categories appear in Cloudbeds:

```sql
INSERT INTO usali_category_map (match_pattern, match_type, usali_dept, usali_subdept, priority, is_active, notes)
VALUES ('your-pattern', 'ilike', 'F&B', 'Food', 30, true, 'description');

REFRESH MATERIALIZED VIEW mv_classified_transactions;
SELECT public.refresh_bi_views();
```

## Adding operational overrides

When the PMS has wrong state that you need to override without changing raw data:

```sql
INSERT INTO operational_overrides
  (entity_type, entity_id, override_type, reason, set_by)
VALUES
  ('room', '<room_id>', 'permanently_closed', 'reason', 'paul');
```

## Rotating credentials

| Credential | Rotation | Steps |
|---|---|---|
| `DASHBOARD_PASSWORD` | When team changes | Update Vercel env var → redeploy |
| `CLOUDBEDS_API_KEY` | If compromised | Regenerate in Cloudbeds → update Supabase vault → re-test sync |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | If exposed beyond intended audience | Rotate in Supabase → update Vercel env vars |
| `SUPABASE_SERVICE_ROLE_KEY` | If exposed | Rotate in Supabase → update Vercel env var → redeploy (uploads break until matched) |

## Monitoring (current state — minimal)

| Signal | Where |
|---|---|
| Sync failures | `sync_runs` table — query for failed status |
| Edge function logs | Supabase MCP `get_logs` or Dashboard → Functions → `sync-cloudbeds` → Logs |
| Mat-view refresh errors | Postgres logs (Supabase dashboard → Logs → Database) |
| Vercel runtime errors | Vercel project → Deployments → latest → Runtime Logs |
| API quota | Cloudbeds dashboard (manual check) |

**Phase 2 will add:** Slack/Telegram alerts, automated health-check cron, error budgets.

## Disaster recovery

| Scenario | Recovery |
|---|---|
| Vercel down | Status page, fallback nothing — internal tool |
| Supabase project paused | `restore_project` via Supabase dashboard |
| Sync stuck | Run `cb_sync_recent_reservations()` manually; check `sync_watermarks` |
| Mat views stale | `SELECT refresh_bi_views();` |
| Wrong number on dashboard | See `04_USALI_MAPPING.md` §"Mapping audit query" + reconciliation in `05_KPI_DEFINITIONS.md` |

## Costs (current snapshot)

| Service | Tier | Cost |
|---|---|---|
| Supabase | Free | $0/mo (will likely outgrow Q3 2026 → Pro $25/mo) |
| Vercel | Free | $0/mo (will likely stay free for v1 internal use) |
| Cloudbeds | Existing PMS | Already paid by hotel |
| GitHub | Free private | $0/mo |
| Custom domain | thenamkhan.com (already owned) | $0/mo additional |
| **Total v1** | | **~$0/mo** |

Forecast Phase 2: + DQ agent (free, runs as edge function) + Slack integration (free).

## Security checklist before public exposure

Run before exposing the dashboard URL beyond Paul:

- [ ] Resolve Supabase advisors (run `mcp get_advisors security` and remediate)
- [ ] `REVOKE EXECUTE ON FUNCTION get_secret FROM anon, authenticated;`
- [ ] All `cb_*` SECURITY DEFINER functions revoked from anon
- [ ] `DASHBOARD_PASSWORD` is genuinely strong (>14 chars, mixed)
- [ ] Vercel deployment protection enabled if URL is shared

## Where docs live

- This repo `/docs/` — canonical source of truth
- `docs/PROJECT_ASSESSMENT_2026-05-02.md` — wide platform-state snapshot, supersedes platform sections of this doc and `DEPLOY.md` where they conflict
- Claude Project Knowledge — mirrors the same files for chat context
- Update both when something changes
