# Setup checklist for weekly snapshots

The `weekly-snapshot.yml` workflow needs three GitHub repository secrets.
Two of them already exist (used by `supabase-diff.yml`); one is optional.

## Required secrets (in `Settings → Secrets and variables → Actions`)

| Secret | Purpose | Already exists? |
|---|---|---|
| `SUPABASE_PROJECT_REF` | Project ID (`kpenyneooigsyuuomgct`) | ✅ Yes |
| `SUPABASE_DB_PASSWORD` | DB password for `pg_dump` connection | ✅ Yes |
| `SUPABASE_DB_HOST` | Direct DB host (overrides default) | ⚠ Optional |

The workflow falls back to `aws-0-eu-central-1.pooler.supabase.com` if
`SUPABASE_DB_HOST` is not set — that's the Frankfurt pooler.

## First test run

Trigger the workflow manually from the Actions tab:

1. Go to `https://github.com/TBC-HM/namkhan-bi/actions`
2. Click **Weekly platform snapshot** in the left sidebar
3. Click **Run workflow** → **Run workflow** (green button)
4. Watch the run — should complete in 2–3 minutes
5. Confirm: a new file appeared at `cockpit/snapshots/2026-Www.sql.gz`
6. Confirm: a new row in `cockpit_change_log` with `command_tag = 'BACKUP SNAPSHOT'`

If the run fails on the pg_dump step:

- **"could not connect to server"** — `SUPABASE_DB_HOST` secret is wrong or
  the pooler is in a different region. Check `Settings → Database →
  Connection string` in the dashboard and use the **Session pooler** host
  (port 5432, NOT the transaction pooler 6543).
- **"password authentication failed"** — `SUPABASE_DB_PASSWORD` is stale.
  Regenerate at `Settings → Database → Reset database password` and
  update the secret.
- **"permission denied for schema documentation"** — the `postgres` user
  should have read on everything. If not, run:
  ```sql
  GRANT USAGE ON SCHEMA documentation TO postgres;
  GRANT SELECT ON ALL TABLES IN SCHEMA documentation TO postgres;
  ```

## Verifying after a few weeks

Once 3-4 snapshots have accumulated, sanity-check:

```bash
ls -lh cockpit/snapshots/
zcat cockpit/snapshots/2026-W19.sql.gz | head -50
zcat cockpit/snapshots/2026-W19.sql.gz | grep -c '^INSERT'   # row count
```

And in Supabase:

```sql
SELECT command_tag, object_identity, metadata, changed_at
FROM public.cockpit_change_log
WHERE command_tag = 'BACKUP SNAPSHOT'
ORDER BY changed_at DESC;
```

## Cost impact

| Item | Cost |
|---|---|
| GitHub Actions minutes (per run, ~3 min) | Free tier covers this |
| Storage in repo | Tiny — gzip of structured tables, est. 1-5 MB per week |
| Supabase egress | Negligible — once per week |

Effectively free.
