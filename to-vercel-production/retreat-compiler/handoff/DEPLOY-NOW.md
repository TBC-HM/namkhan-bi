# DEPLOY-NOW · retreat-compiler

State as of this session — verified.

## What's already in place

| Layer | Status | Detail |
|---|---|---|
| DB schemas | live on `kpenyneooigsyuuomgct` | `compiler` (4 tables, 2 runs/6 variants/1 deploy already), `pricing` (15 SKUs), `book`, `web` (13 tables, 1 retreat), `catalog`, `content` (4 series, 50 lunar events). Migration is past tense. |
| App code | wired in repo, untracked | `app/marketing/compiler/` (8 files) · `app/r/[slug]/` (lead, checkout, thanks) · `app/api/compiler/*` (8 routes) · `app/api/lead/capture` · `app/api/checkout/session` · `lib/compiler/*` (parse, variants, roomPricing) |
| Subnav | wired | `components/nav/subnavConfig.ts` shows `Marketing › Compiler` (`isNew: true`) |
| Typecheck | pass | `npx tsc --noEmit` exit 0 across full repo |
| Build | pass | `next build` compiled successfully |
| .vercelignore | patched | added `to-vercel-production/` so this 17 MB handoff folder doesn't ship |

## Why "deploy" was a misframe yesterday

That whole `05-deploy-package.md` Stage 4 handoff (Vercel project setup, Cloudflare DNS, Stripe products, Klaviyo flows, 27-item pre-deploy checklist) is overhead for the **standalone multi-property** vision in the spec. You don't run that pipeline. You run the **namkhan-bi** pipeline:

- one Vercel project (`namkhan-bi`)
- one Supabase (`namkhan-pms`)
- one branch (`main`)
- one deploy script (`deploy-namkhan-bi.command`)

The retreat-compiler is now another pillar tab inside that same app. Same wiring as `/sales/inquiries`, `/revenue/pulse`, etc. Public retreat funnel lives at `/r/[slug]` on `namkhan-bi.vercel.app` — not on `mindfulness-summer.thenamkhan.com`. Custom subdomains are v1.1.

## To ship — PBS executes

```bash
# 1. Clear stale git lock (sandbox couldn't remove it)
rm -f /Users/paulbauer/Desktop/namkhan-bi/.git/index.lock

# 2. Stage and commit retreat-compiler + .vercelignore patch
cd /Users/paulbauer/Desktop/namkhan-bi
git add app/marketing/compiler app/r app/api/compiler app/api/lead app/api/checkout lib/compiler .vercelignore
git commit -m "feat(retreat-compiler): wire /marketing/compiler + /r/[slug] funnel + APIs"

# 3. Optional — typecheck before deploy (already verified clean this session)
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
npx --yes tsc --noEmit

# 4. Deploy (uses the standard command; --force skips Vercel cache)
nohup '/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/deploy-namkhan-bi.command' > /tmp/nb_force.log 2>&1 & disown

# 5. Tail logs
tail -f /tmp/nb_force.log
# Expect READY in ~60s, alias https://namkhan-bi.vercel.app within 30s of READY
```

## Smoke test (post-deploy)

```bash
curl -sI https://namkhan-bi.vercel.app/marketing/compiler   # 200
curl -sI https://namkhan-bi.vercel.app/r/                   # 200 or 308 (whatever the existing slug routes to)
```

In browser, login, then:
- `/marketing/compiler` — see KPI grid (`Total runs: 2`), prompt input, recent runs (`R-001` etc), pricelist count `15`
- click an existing run → variant comparison → can edit/render/deploy stubs work
- `/r/<slug-from-deploy>` — public retreat detail loads

## Known not-yet-wired (for follow-up commits, not blockers)

1. Puppeteer PDF render — endpoint stubs, no actual PDF
2. Stripe live keys — checkout creates `book.bookings` rows but no payment intent
3. Cloudbeds reservation auto-create on payment — handler skeleton only
4. Klaviyo flows — webhook fires, no flows configured yet
5. Custom retreat subdomains — `/r/[slug]` only; v1.1 ships `*.thenamkhan.com` wildcard

## What I am NOT going to deploy for you

Per `05-deploy-package.md` §0 — Claude doesn't push to GitHub, doesn't deploy to Vercel. That rule is yours; I'm respecting it. The 4-step block above is the entire deploy path. Run it from your Mac terminal.

## Other uncommitted noise

`git status` shows ~70 modified files unrelated to retreat-compiler (compset, parity, pos-transactions, supplier-mapping, etc). The commit at step 2 stages **only** retreat-compiler-scoped paths, so those stay where they are. If they should also ship — separate decision, separate commit.
