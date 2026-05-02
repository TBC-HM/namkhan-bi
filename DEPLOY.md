# DEPLOY.md — Ship Namkhan BI to Vercel

**Reality check (verified 2026-05-02):** GitHub auto-deploy DOES NOT WORK on this project. Every code change requires a manual `npx vercel --prod --yes --force` from the local repo. See section "Why no auto-deploy" below.

For a deeper assessment of platforms (GitHub / Vercel / Supabase / Make.com), read `docs/PROJECT_ASSESSMENT_2026-05-02.md`.

---

## Standard repeat deploy (90 % of the time)

You're already linked, env vars are set, you just changed code. Three commands:

```bash
cd ~/Desktop/namkhan-bi
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
npx --yes tsc --noEmit                  # mandatory — catches issues Vercel build doesn't
npx --yes vercel --prod --yes --force   # --force is mandatory — see "Why --force" below
```

Wait 60–120 s. Output ends with `Production: https://...vercel.app [Xs]`. Alias updates within ~30 s.

**Then verify (mandatory):**

```bash
curl -sI https://namkhan-bi.vercel.app/overview | head -3
curl -sI https://namkhan-bi.vercel.app/overview?win=l12m | head -3
```

Both must return `HTTP/2 200`. If they return identical KPIs, the deploy did not pick up new code (cache restore problem, see below).

---

## First-time setup (you only do this once per machine)

### 1. Get Supabase anon key

https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/settings/api → **anon public** key.

### 2. Pull the env vars from Vercel into a local `.env.local`

```bash
cd ~/Desktop/namkhan-bi
npx --yes vercel link              # confirm scope = pbsbase-2825's projects, project = namkhan-bi
npx --yes vercel env pull .env.local  # populates all 6 keys including SUPABASE_SERVICE_ROLE_KEY
```

Confirm contents (names only):

```bash
cut -d= -f1 .env.local
```

You should see: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_FX_LAK_USD`, `NEXT_PUBLIC_PROPERTY_ID`, `DASHBOARD_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Schedule the data refresh (one time, in Supabase SQL editor)

```sql
SELECT cron.schedule(
  'refresh_bi_views',
  '*/15 * * * *',
  'SELECT public.refresh_bi_views();'
);
```

If `cron.schedule` errors with "schema cron does not exist", enable `pg_cron` in Database → Extensions, then re-run.

### 4. (Optional) Custom domain

Vercel project → Settings → Domains → add `bi.thenamkhan.com`. Vercel shows you the CNAME to add at your DNS provider.

---

## Why no auto-deploy?

The repo lives at `github.com/TBC-HM/namkhan-bi`. The Vercel GitHub App must be installed on the `TBC-HM` org for git-push-deploys to work — that requires Owner/Admin on the org, which `pbsbase@gmail.com` does not have.

**Two ways to fix this** (either enables `git push` → auto-deploy):

**Option A — install Vercel GitHub App (preferred, native Git integration)**
A TBC-HM org admin opens https://github.com/apps/vercel/installations/new, selects the org, grants access to `namkhan-bi`. Then in Vercel → Project → Settings → Git → connect the GitHub repo.

**Option B — GitHub Action with VERCEL_TOKEN (token-based, no GitHub App needed)**
1. Generate token at https://vercel.com/account/tokens
2. Add to https://github.com/TBC-HM/namkhan-bi/settings/secrets/actions as `VERCEL_TOKEN`
3. Re-add the deleted workflow `.github/workflows/vercel-deploy.yml` (was removed in commit `846ea4e`)

Until either is done: CLI is the only path, and `git push` only triggers `ci.yml` (lint + typecheck + build) — no deploy.

---

## Why `--force`?

Without `--force`, Vercel restores the build cache from a prior deployment. That cache contains the stale `to vercel production /` folder, which is excluded by `.vercelignore` AND `tsconfig.json exclude` but ends up referenced by the cached typecheck and fails:

```
Cannot find module '@/components/nav/Banner'
```

`--force` uploads ~125 fresh files instead of ~153 cached ones and the build passes. This is non-negotiable until the stale folder is removed from the repo.

---

## Verification protocol (run after every deploy)

| URL | Expected |
|---|---|
| `https://namkhan-bi.vercel.app/` | 307 → `/overview` |
| `https://namkhan-bi.vercel.app/overview` | 200, period heading "Last Month", KPIs render |
| `https://namkhan-bi.vercel.app/overview?win=l12m` | 200, period heading "Last 12 months", KPIs DIFFER from above |
| `https://namkhan-bi.vercel.app/guest/directory` | 200, directory loads with 4,111 guests |
| `https://namkhan-bi.vercel.app/sales/b2b` | 200, DMC tab loads |
| `https://namkhan-bi.vercel.app/marketing/library` | 200 |
| `https://namkhan-bi.vercel.app/operations/staff` | 200 |
| `https://namkhan-bi.vercel.app/revenue/compset` | 200 |

If any return 4xx/5xx — open Vercel runtime logs at https://vercel.com/pbsbase-2825s-projects/namkhan-bi.

---

## Troubleshooting

**Login loops** → `DASHBOARD_PASSWORD` mismatch or missing on Vercel.
**Pages show all zeros** → matviews stale. Run `SELECT public.refresh_bi_views();` in Supabase SQL.
**Upload returns 500** → `SUPABASE_SERVICE_ROLE_KEY` missing on Vercel (verify with `vercel env ls production`).
**Build fails on `Cannot find module '@/components/nav/Banner'`** → forgot `--force`. Re-run.
**Build fails on something else** → run `npx tsc --noEmit` locally first, fix, re-deploy.

---

## What I (Claude) cannot do

- **Type into Terminal in Cowork mode.** Terminal is "click" tier — clicks allowed, typing blocked. Use `osascript do shell script` from Claude, or paste commands yourself.
- **Bypass GitHub sudo mode** for App-install actions.
- **Install Vercel App on TBC-HM** without org-admin rights.

---

## Useful URLs

- Vercel project: https://vercel.com/pbsbase-2825s-projects/namkhan-bi
- Deployments: https://vercel.com/pbsbase-2825s-projects/namkhan-bi/deployments
- Build logs: click any row in deployments → Build Logs tab
- Vercel App install (when org admin available): https://github.com/apps/vercel/installations/new
- Live: https://namkhan-bi.vercel.app
