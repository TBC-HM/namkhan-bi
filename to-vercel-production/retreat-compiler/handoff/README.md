# Retreat Compiler · Deploy Handoff

**Approved scope:** rev 1 (Stage 2 approval 2026-05-04)
**Bundle path target:** `~/Desktop/namkhan-bi/to-vercel-production/retreat-compiler/`
**Mirror path (this folder):** `feature-builder/output/retreat-compiler/handoff/`
**Owner:** PBS
**Estimated total deploy time:** 4–6 hr staging · 2 hr prod

## Folder map

```
handoff/
├── README.md                                ← you are here
├── 00-PRE-DEPLOY-CHECKLIST.md               ← run this first
├── 01-env/
│   └── .env.example
├── 02-database/
│   ├── 20260504000000_retreat_compiler_init_a1b2c3d4.sql
│   ├── ..._rollback.sql
│   ├── ..._seed.sql
│   └── ..._validate.sql
├── 05-make/
│   └── make-scenarios.json
├── 06-stripe/
│   └── stripe-products.json
├── 08-klaviyo/
│   └── klaviyo-setup.md
├── 09-cloudflare/
│   └── dns-records.md
├── 10-vercel/
│   └── vercel.json
├── 11-runbooks/
│   ├── deploy-staging.md
│   ├── deploy-production.md
│   └── rollback.md
└── 99-tests/
    └── smoke-test-plan.md
```

## Reference docs (parent folder)

- `01-brief.md` — Stage 1 brief
- `02-prototype.html` + `02b-prototype-map.md` — clickable mockup
- `03-approval.md` — approval status (rev 1 approved)
- `04a-schema-plan.md` — full schema design + RLS
- `04c-website-and-configurator.md` — full website + configurator + editor spec
- `05-deploy-package.md` — high-level deploy doc (parent of this handoff)
- `06-code-spec.md` — Stage 3 code spec (file structure, API contracts, components, cron)

## Order of operations (high level)

1. **PBS** copies/syncs this folder to `~/Desktop/namkhan-bi/to-vercel-production/retreat-compiler/`
2. **PBS** runs through `00-PRE-DEPLOY-CHECKLIST.md`
3. **PBS** executes `11-runbooks/deploy-staging.md` end-to-end
4. **PBS** runs `99-tests/smoke-test-plan.md` against staging URL
5. **PBS** signs off in `03-approval.md` once staging green
6. **PBS** executes `11-runbooks/deploy-production.md`
7. **PBS** runs smoke plan against prod within 15 min of deploy
8. **PBS** monitors 24-hour rollback window

## Open items still blocking prod

1. **Sheet "Namkhan Packages 1.2"** — Sheets MCP not connected. `catalog.*` and `pricing.pricelist` cannot seed. **Workaround:** paste CSV exports into `feature-builder/output/retreat-compiler/sheet-snapshot/` and run import script.
2. **Series taxonomy + lunar dates** — placeholder seed in migration. PBS-approved list needed before campaign launch.
3. **Stripe topology** — defaulted to single account + property metadata. PBS confirm before live mode.
4. **Legal pages** — placeholders in seed. Counsel review before EU traffic.
5. **Cloudbeds property ID** — placeholder in `.env.example`. Confirm real ID.
6. **Domain ownership** — confirm `thenamkhan.com` is in PBS's Cloudflare account with API token issued.
7. **GDPR DPAs** — Klaviyo + Cloudbeds DPAs signed.
8. **Backup RTO** — Supabase Pro daily backup confirmed sufficient for RPO.

## Sandbox limitation

Claude wrote this handoff to `feature-builder/output/retreat-compiler/handoff/` because the Desktop path `~/Desktop/namkhan-bi/to-vercel-production/` is outside the sandbox.

To complete the handoff path:

```bash
mkdir -p ~/Desktop/namkhan-bi/to-vercel-production
cp -R "/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/feature-builder/output/retreat-compiler/handoff/" \
      ~/Desktop/namkhan-bi/to-vercel-production/retreat-compiler/
```

Or update SKILL.md to point handoff at the in-repo path going forward (recommended).

## What Claude did NOT do (per SKILL.md)

- ❌ push code to GitHub
- ❌ apply migrations to any DB
- ❌ deploy to Vercel
- ❌ import Make scenarios automatically
- ❌ create Stripe products
- ❌ create Klaviyo flows
- ❌ change DNS records

All of the above is PBS's job, executing the runbooks above.

## Next once prod is live

- v1.1 backlog: multi-language, Donna fork, group lead-time discounts, WhatsApp Business, e-sig waivers, multi-property reporting
- Monitor first 100 bookings for funnel-drop patterns
- Run first 4 Klaviyo flows for 21 days, A/B test subject lines
- Iterate margin floors after 30 days based on actual cost data
