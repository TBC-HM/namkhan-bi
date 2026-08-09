# DEPLOY.md — Deployment Guide

> **⚠️ THIS FILE IS RETIRED**
>
> Deployment procedures are now maintained in the **canonical deployment documentation** in the `documentation.documents` table (doc_type='deployment').
>
> **Current version:** v18 (2026-08-09)
>
> **Access it via:**
> - SQL: `SELECT content_md FROM documentation.documents WHERE doc_type = 'deployment' ORDER BY version DESC LIMIT 1`
> - PostgREST: `https://kpenyneooigsyuuomgct.supabase.co/rest/v1/documents?doc_type=eq.deployment&order=version.desc&limit=1`
> - Agent context: automatically loaded via TKA Layer 1 (Constitution & Core Operations)
>
> **Why this moved:**
> - ADR-279/280/281/282: Canon-5 doc architecture consolidation
> - Deployment doc is now versioned, reviewed, and promotion-gated
> - Single source of truth for all agents and humans
> - This repo file was last accurate ~2026-05-02; current deployment protocol is ADR-222 promotion-gate driven (§2 of canonical doc)
>
> **Key points from current canon (v18):**
> - Production tracking: `production` branch (forward-only), NOT `main`
> - Agents push via `fn_gh_deploy_file` (never raw CLI)
> - Promotion gate: fn_promotion_sweep (5-min cron) requires tsc + all checks + 12min soak
> - Verification: `governance.promotion_log.promoted = true` (not Vercel "Ready")
> - Expand-contract law for DB migrations (§6)
> - Blocked-push parking protocol (§3.6)
>
> **For historical archaeology only:**
> - CLI-era procedures (pre-ADR-222) are in `documents_history` table (deployment doc v1-v16)
> - This file's content reflects the manual-Vercel-CLI era and should NOT be executed

---

## Quick reference (from canonical v18 §1)

| You want to know... | Check this |
|---|---|
| Is my push live? | `SELECT promoted FROM governance.promotion_log WHERE sha = '<your-sha>' LIMIT 1` → `true` |
| Why isn't it promoted? | `SELECT * FROM public.v_promotion_gate_status` |
| Is the build green? | `SELECT * FROM public.fn_gh_check_build_status('main')` |
| What's deployed now? | `SELECT * FROM public.v_deployments ORDER BY created_at DESC LIMIT 1` |

**Never:**
- Push directly to `production` branch
- Use `vercel deploy` / `vercel --prod` / `vercel alias` (banned per L18)
- Push dependent files before dependencies are verified (law 759)
- Report "done" before `promoted = true`

**Read the full canon for:**
- Push verification protocol (§3)
- Hot files CAS pattern (§3.7)
- Expand-contract migration law (§6)
- Rollback incidents & emergency stop (§5)
- Complete gates inventory (§7)
