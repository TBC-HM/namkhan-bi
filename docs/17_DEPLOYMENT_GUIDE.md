# 15 — Deployment Guide

> Canonical reference for shipping, redeploying, and maintaining the Namkhan BI dashboard.
> This is the doc form. The repo also has a `DEPLOY.md` at the root with the click-by-click for the first deploy.

## Components

| Component | Where | Notes |
|---|---|---|
| Database | Supabase project `kpenyneooigsyuuomgct` (eu-central-1) | Postgres 17 |
| Sync | Supabase edge function `sync-cloudbeds` | Deno, v11 |
| Mat-view refresh | `pg_cron` schedule `refresh_bi_views` (every 15 min) | one-off SQL setup |
| Dashboard frontend | GitHub repo `namkhan-bi` → Vercel project | auto-deploys on push to `main` |
| Custom domain (optional) | `bi.thenamkhan.com` → CNAME to Vercel | provisioned via Vercel domain settings |

## First-time deploy

See root `DEPLOY.md`. Summary:

1. Get Supabase anon key from Project Settings → API
2. Create private GitHub repo `namkhan-bi`
3. `git push` the codebase
4. Vercel → New Project → Import → set 5 env vars → Deploy
5. Schedule `pg_cron` for `refresh_bi_views()`
6. (Optional) Configure custom domain

## Environment variables (production)

| Name | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kpenyneooigsyuuomgct.supabase.co` | API endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase dashboard) | Anon read on mat views |
| `DASHBOARD_PASSWORD` | (strong, shared out-of-band) | Single-password gate |
| `NEXT_PUBLIC_FX_LAK_USD` | `21800` | LAK per USD; revisit quarterly |
| `NEXT_PUBLIC_PROPERTY_ID` | `260955` | Cloudbeds property scope |

## Pushing updates

After first deploy, every push to `main` auto-deploys:

```bash
git add .
git commit -m "describe change"
git push
# Vercel rebuilds in ~2 min
```

For test changes: create a branch → push → Vercel makes a preview URL automatically.

## Refreshing data

| Mechanism | Frequency | Purpose |
|---|---|---|
| `cb_hourly_refresh()` (pg_cron) | Hourly | Pulls recent reservation changes from Cloudbeds |
| `refresh_bi_views()` (pg_cron) | Every 15 min | Refreshes all 9 mat views |
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

## Monitoring (current state — minimal)

| Signal | Where |
|---|---|
| Sync failures | `sync_runs` table — query for failed status |
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

Forecast Phase 4: Vertex AI ($50–500/mo depending on usage).

## Security checklist before public exposure

Run before exposing the dashboard URL beyond Paul:

- [ ] Resolve Supabase advisors: `SELECT * FROM ...` is restricted; RLS on tables; SECURITY DEFINER views switched to security_invoker
- [ ] `REVOKE EXECUTE ON FUNCTION get_secret FROM anon, authenticated;`
- [ ] All `cb_*` SECURITY DEFINER functions revoked from anon
- [ ] `DASHBOARD_PASSWORD` is genuinely strong (>14 chars, mixed)
- [ ] Vercel deployment protection enabled if URL is shared

## Where docs live

- This repo `/docs/` — canonical source of truth
- Claude Project Knowledge — mirrors the same files for chat context
- Update both when something changes (re-upload the changed file to the project)
