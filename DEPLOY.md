# DEPLOY.md — Ship Namkhan BI to Vercel

Literal click-by-click. ~10 minutes total. Follow in order.

## Prerequisites
- A GitHub account with permission to create private repos
- A Vercel account linked to GitHub (free tier is fine)
- Access to Supabase project `namkhan-pms` (for the anon key)

---

## Step 1 — Get your Supabase anon key (1 min)

1. Open https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/settings/api
2. Scroll to **Project API keys**
3. Copy the value next to `anon` `public` (starts with `eyJ…`)
4. Paste it somewhere safe — you'll use it twice (Vercel + optionally local dev)

---

## Step 2 — Create GitHub repo (2 min)

1. Go to https://github.com/new
2. **Repository name:** `namkhan-bi`
3. **Visibility:** Private
4. **Do NOT** check "initialize with README/license/.gitignore"
5. Click **Create repository**
6. On the next screen, copy the SSH URL (looks like `git@github.com:yourusername/namkhan-bi.git`)

---

## Step 3 — Push the code (2 min)

Open Terminal, navigate to where you unzipped the `namkhan-bi/` folder:

```bash
cd ~/Downloads/namkhan-bi   # or wherever you unzipped
git init
git add .
git commit -m "Namkhan BI v0.1 - initial"
git branch -M main
git remote add origin git@github.com:YOURUSER/namkhan-bi.git
git push -u origin main
```

If `git push` complains about SSH auth, switch to HTTPS:

```bash
git remote set-url origin https://github.com/YOURUSER/namkhan-bi.git
git push -u origin main
# When prompted, use a GitHub Personal Access Token (Settings → Developer settings → PATs)
# instead of your password.
```

---

## Step 4 — Deploy to Vercel (3 min)

1. Go to https://vercel.com/new
2. Click **Import** next to your `namkhan-bi` repo
   (if it's not visible, click "Adjust GitHub App permissions" → grant access)
3. **Framework Preset:** Next.js (auto-detected — leave as is)
4. **Root Directory:** `./` (leave default)
5. **Build Command, Output Directory, Install Command:** leave defaults
6. Expand **Environment Variables** and add these five (one per row):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kpenyneooigsyuuomgct.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (paste from Step 1) |
| `DASHBOARD_PASSWORD` | (pick a strong password — share with your team out-of-band) |
| `NEXT_PUBLIC_FX_LAK_USD` | `21800` |
| `NEXT_PUBLIC_PROPERTY_ID` | `260955` |

7. Click **Deploy**
8. Wait ~2 min for the build. When done, click the assigned URL (e.g. `namkhan-bi.vercel.app`)
9. You'll see the login screen → enter your `DASHBOARD_PASSWORD` → done

---

## Step 5 — (Optional) Custom domain (3 min)

1. In Vercel project: **Settings → Domains**
2. Add `bi.thenamkhan.com`
3. Vercel shows you the CNAME record to add at your DNS provider
4. Add the CNAME, wait for propagation (~5–60 min)
5. Vercel auto-provisions SSL

---

## Step 6 — Schedule data refresh (1 min, do once)

In Supabase SQL editor (https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/sql/new):

```sql
SELECT cron.schedule(
  'refresh_bi_views',
  '*/15 * * * *',
  'SELECT public.refresh_bi_views();'
);
```

This refreshes all materialized views every 15 minutes.

If `cron.schedule` errors with "schema cron does not exist":
1. Database → Extensions → search `pg_cron` → toggle ON
2. Then re-run the SQL above

---

## Verification checklist

After deployment, click through and check:

- [ ] Login screen loads at the Vercel URL
- [ ] Wrong password is rejected
- [ ] Correct password redirects to `/overview`
- [ ] Overview shows real numbers (not zeros) for in-house, occupancy, ADR
- [ ] Currency toggle (top right) flips USD ↔ LAK
- [ ] **Today's Snapshot** shows actual arrivals/departures/in-house
- [ ] **Revenue · Pulse** shows last-30-day numbers and a 90-day chart
- [ ] **Revenue · Demand** shows OTB vs STLY pace table
- [ ] **Revenue · Channels** shows your top sources with bookings
- [ ] **Revenue · Rates** shows BAR per room type for next 30 days
- [ ] **Departments · Roots** shows top F&B sellers
- [ ] **Departments · Spa & Activities** shows treatments and activities
- [ ] **Finance · P&L** shows USALI breakdown for the latest full month
- [ ] **Finance · Ledger** shows aged AR with bucket pills
- [ ] Greyed-out tabs show the "Coming soon" overlay (Action Plans, Comp Set, Promotions, Budget, expense side of P&L)

---

## Troubleshooting

**Login loops (keeps going back to login)**
- Cookie not setting. Check `DASHBOARD_PASSWORD` is set in Vercel and matches what you typed.
- In Vercel → Project → Settings → Environment Variables → confirm var present in Production.

**Pages show all zeros / "—"**
- Materialized views are empty. Run `SELECT public.refresh_bi_views();` in Supabase SQL.
- Check anon key is correct (paste fresh from Supabase API settings).

**500 errors / blank pages**
- Vercel → Project → Deployments → click latest → Runtime Logs. Look for Supabase errors.
- Most common: wrong env var name (must be exact, case-sensitive).

**Build fails**
- Vercel build log will show the error. Most common: missing env var → already covered above.

---

## Cost

- Vercel free tier: covers a single dashboard for ~one user
- Supabase free tier: covers Phase 1 storage and traffic
- Custom domain: ~$10/year if you don't already own `thenamkhan.com`

When you outgrow the free tier (10+ daily users / many concurrent dashboards), upgrade Vercel Pro ($20/mo) and Supabase Pro ($25/mo).

---

## Pushing updates later

After the first deploy, every `git push` to `main` auto-deploys to production.

```bash
# make changes
git add .
git commit -m "describe change"
git push
# Vercel rebuilds in ~2 min, no manual steps
```

For preview environments (test before prod): create a branch, push it, Vercel makes a preview URL automatically.
