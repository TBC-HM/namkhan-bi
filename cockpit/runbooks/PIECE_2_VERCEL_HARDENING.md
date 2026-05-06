# Piece 2 — Vercel Hardening (15-min checklist)

**Goal**: stop cost runaway, block obvious abuse, enable Speed Insights/Analytics, confirm Vercel Agent. PBS clicks each link, follows the inline action, comes back to the next row.

**Project IDs (paste-ready)**:
- Project: `namkhan-bi`
- Project ID: `prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl`
- Team slug: `pbsbase-2825s-projects`
- Team ID: `team_vKod3ZYFgteGCHsam7IG8tEb`
- Region: `fra1` (Frankfurt)

## 1. Spending cap — €30/month hard

[https://vercel.com/teams/pbsbase-2825s-projects/settings/billing](https://vercel.com/teams/pbsbase-2825s-projects/settings/billing)

Action:
1. Scroll to **Spend Management** section.
2. Toggle "Set spend limit" → **€30/month**.
3. Set "Pause projects when limit reached" = **YES**.
4. Confirm at "Email me when 50%, 75%, 100% reached" = **YES** to `pbsbase@gmail.com`.

Why: an Anthropic-loop bug or scraper hammering `/api/cockpit/chat` could otherwise drain €€€ silently.

## 2. Firewall — rate-limit + block-attack-paths

[https://vercel.com/pbsbase-2825s-projects/namkhan-bi/firewall](https://vercel.com/pbsbase-2825s-projects/namkhan-bi/firewall)

Action — create **two rules** (Custom Rules tab → "+ Add rule"):

### Rule A — Rate limit /api/*
- **Name**: `rate-limit-api`
- **If**: Path → starts with → `/api/`
- **Then**: Rate limit
  - 60 requests
  - per 60 seconds
  - per IP
- **Action when exceeded**: Deny (HTTP 429)

### Rule B — Block obvious-attack paths
- **Name**: `block-attack-paths`
- **If**: Path → matches regex → `(?i)(\.env|\.git|wp-admin|wp-login|phpmyadmin|\.aws|\.ssh|admin\.php|config\.php|xmlrpc\.php)`
- **Then**: Deny (HTTP 403)

Save both. Verify in **Audit Log** tab in 5 min — you should see the rule list.

## 3. Speed Insights — enable

[https://vercel.com/pbsbase-2825s-projects/namkhan-bi/speed-insights](https://vercel.com/pbsbase-2825s-projects/namkhan-bi/speed-insights)

Action:
1. Click **Enable Speed Insights**.
2. Client-side hook is already deployed (`<SpeedInsights />` from `@vercel/speed-insights` is rendered — verified on `feat/leads-and-cockpit-redo` merged into main).
3. Wait ~30 min, refresh — first data arrives.

## 4. Web Analytics — enable

[https://vercel.com/pbsbase-2825s-projects/namkhan-bi/analytics](https://vercel.com/pbsbase-2825s-projects/namkhan-bi/analytics)

Action:
1. Click **Enable Web Analytics**.
2. Vercel will prompt: "Add `<Analytics />` component to your app". Skip — done in Piece 5 follow-up if you want richer client tracking. The dashboard view will start populating from Vercel-side request logs.

## 5. Vercel Agent — confirm beta access

[https://vercel.com/pbsbase-2825s-projects/namkhan-bi/agents](https://vercel.com/pbsbase-2825s-projects/namkhan-bi/agents)

Action:
1. If page loads with options → enable **Code Review Agent** (auto-comments on PRs).
2. If page is blank or 404 → not yet beta-enabled for your account; nothing to do.

## 6. Log Drain — DEFERRED

Skip until you've picked Better Stack or another sink. Comes back in Piece 4 alongside uptime monitoring.

## Verification (after all 5 done)

```bash
# 1. Try to hit /api/cockpit/chat 70 times in 10 sec — should 429 after ~60
for i in {1..70}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST 'https://namkhan-bi.vercel.app/api/cockpit/chat' -H 'Content-Type: application/json' -d '{"message":"test"}' & done | sort | uniq -c

# 2. Try a blocked path → expect 403
curl -s -o /dev/null -w "%{http_code}\n" 'https://namkhan-bi.vercel.app/.env'
# Should print: 403

# 3. Speed Insights / Analytics — open dashboards in 30 min, confirm data is flowing.
```

## When done — tell Claude

Just say "Piece 2 done" and Claude moves to verifying Piece 5 (auth gate) is live, then walks through Make.com installs (Pieces 3 + 4).
