# Marketing Module — Install Instructions

9 files. Drop into your `/tmp/namkhan-bi-fresh` repo, then push.

## What's included

| File | Purpose |
|---|---|
| `lib/marketing.ts` | Server-side fetchers for the `marketing` schema |
| `app/marketing/layout.tsx` | Sub-nav (Reviews / Social / Influencers / Media) |
| `app/marketing/page.tsx` | Redirect to /marketing/reviews |
| `app/marketing/reviews/page.tsx` | KPI strip + source breakdown + latest feed |
| `app/marketing/social/page.tsx` | Platform accounts table with follower counts + links |
| `app/marketing/influencers/page.tsx` | Campaign log with comp/paid value + delivery status |
| `app/marketing/media/page.tsx` | Drive folder shortcuts grouped by category |
| `components/nav/TopNav.tsx` | **Replaces existing** — adds Marketing tab |
| `styles/marketing.css` | Append-only CSS for review cards, badges, media grid |

## Step 1 — Expose the marketing schema in Supabase

This is mandatory. The dashboard reads from `marketing.*` tables but PostgREST won't expose them by default.

1. Open https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/settings/api
2. Find "Exposed schemas" (or "API → Schemas")
3. Add `marketing` to the list (alongside `public`)
4. Save

Without this step, every page in the Marketing tab will show empty / errors.

## Step 2 — Install the files

```bash
cd /tmp/namkhan-bi-fresh

unzip -o ~/Downloads/namkhan-marketing.zip -d /tmp/marketing-staging
cp -r /tmp/marketing-staging/marketing-frontend/* .

# Append the marketing CSS to globals.css
cat styles/marketing.css >> styles/globals.css
rm styles/marketing.css

git add -A
git status
```

Should show 8 new/modified files (TopNav modified, rest new).

## Step 3 — Commit and push

```bash
git commit -m "feat: marketing module — reviews, social, influencers, media"
git push origin main
```

Vercel auto-deploys in ~2-3 min.

## Step 4 — Update the seeded social accounts (URLs are placeholders)

I seeded 7 platform rows with **placeholder URLs**. Update them with real ones:

```sql
-- Example: fix instagram URL
UPDATE marketing.social_accounts
SET handle = '@your_real_handle',
    url    = 'https://instagram.com/your_real_handle'
WHERE platform = 'instagram';
```

Or edit via Supabase dashboard → Table Editor → marketing → social_accounts.

## Step 5 — Build the email-to-Supabase pipeline (separate work)

Reviews tab will be empty until you wire up email parsing. Approaches:

**Option A — Make.com (recommended, fastest)**
- Trigger: Gmail "new email matching filter" (filter by sender = noreply@booking.com, etc.)
- Action: Parse subject/body with regex → POST to Supabase REST endpoint
- Cost: free tier covers ~1000 ops/month

**Option B — n8n (self-hosted, more control)**
- Same flow but on a $5/mo VPS
- More flexibility but you maintain it

**Option C — Supabase Edge Function (most integrated)**
- Webhook receives forwarded emails
- Function parses + inserts
- Free, but you write the parsers

I can build any of these as a follow-up. Recommend Make.com — fastest path to data.

## Schema reference

All in `marketing` schema. RLS = read-only for anon.

- `marketing.reviews` — populated by parser
- `marketing.social_accounts` — manual entry (seeded)
- `marketing.influencers` — manual log
- `marketing.media_links` — manual links to Drive

## Known gaps / Phase 2

- Follower auto-sync (Meta Graph API, TikTok API, GBP API) — not wired
- TripAdvisor reviews — no public API, must scrape
- Influencer engagement tracking — manual entry only
- Reviews response writing — happens outside the dashboard, you mark "responded" manually
