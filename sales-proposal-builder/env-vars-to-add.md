# Env vars to add on Vercel — sales-proposal-builder

App boots fine without any of these. Each unlocks a feature.

## Already set on Vercel (verified 2026-05-03)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_FX_LAK_USD` (= 21800)
- `NEXT_PUBLIC_PROPERTY_ID` (= 260955)
- `DASHBOARD_PASSWORD`
- `ANTHROPIC_API_KEY` ← composer is REAL, not stub. "↻ Re-draft with AI" calls Claude Sonnet 4.6.

## To add for guest delivery (email + WhatsApp + Slack)

After importing the 5 Make scenarios from `make-blueprints/`, copy each webhook URL Make assigns and set:

| Name | Value source | What it fires |
|---|---|---|
| `MAKE_WEBHOOK_PROPOSAL_SENT`         | Make scenario `proposal-sent` after import | Email + WhatsApp to guest |
| `MAKE_WEBHOOK_PROPOSAL_VIEWED`       | Make scenario `proposal-viewed` after import | Slack alert when guest opens |
| `MAKE_WEBHOOK_PROPOSAL_GUEST_EDITED` | Make scenario `proposal-guest-edited` after import | Slack alert on qty change / removal |
| `MAKE_WEBHOOK_PROPOSAL_SIGNED`       | Make scenario `proposal-signed` after import | Cloudbeds reservation push + Slack #sales celebration |
| `MAKE_WEBHOOK_PROPOSAL_EXPIRED`      | Make scenario `proposal-expired` after import | Daily 07:00 ICT re-engagement email |

Until these are set, `lib/makeWebhooks.ts` logs payloads to Vercel server logs but doesn't fire externally. App stays alive.

Add via Vercel → namkhan-bi → Settings → Environment Variables. Scope: **Production + Preview + Development**.

## Optional (have defaults)

| Name | Default | Use |
|---|---|---|
| `IP_HASH_SALT` | `'namkhan-portal-default'` | Hashes guest IPs in event logs. Set once and never rotate. |
| `PROPOSAL_TOKEN_TTL_DAYS` | `'14'` | Public proposal link validity in days. |
