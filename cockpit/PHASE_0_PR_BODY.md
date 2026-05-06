## Phase 0 — Reconciliation PR

**Goal**: bring `main` to match production deployment `dpl_8yuJFddTaUJy1LDghmFaFcJmNcbg` (`namkhan-bi.vercel.app`).
**Source of truth**: production. GitHub is being reconciled to match — never the reverse.
**Pre-PR baseline**: tags `v0-pre-reconciliation-local` (`666c678`) + `v0-pre-reconciliation-github` (`b4b3e79`) + working-tree tarball at `/Users/paulbauer/Desktop/cockpit-baselines/`.

---

## Group A — modified by Cowork today (HIGH CONFIDENCE)

3 files. Sample-check OK.

| File | What I changed |
|---|---|
| `DESIGN_NAMKHAN_BI.md` | Appended cockpit governance changelog entries (v1, v2, agent network, KB additions). MIXED — concurrent session also added "Recovery deploy of WIP" entry. |
| `app/operations/staff/[staffId]/page.tsx` | Added `fx_lak_usd?: number \| null` field to `PayrollRow` type (1 line). MIXED — concurrent added the `CompBreakdown` + `YtdSummary` imports + section render. |
| `app/settings/cockpit/page.tsx` | Replaced KPI tiles (Active agents, Tickets/24h, Agent runs/24h + spend, Open incidents). Added "Open cockpit →" CTA banner at top. |

---

## Group B — concurrent session (SCRUTINIZE)

9 files. Not mine. Each was edited by another Cowork session running in parallel today.

| File | Diff size | What changed |
|---|---|---|
| `app/revenue/compset/page.tsx` | +515 / -183 | Full v3 component rewrite (`CompactAgentHeader`, `CompsetGraphs`, `SetTabs`, `PropertyTable`, `AgentRunHistoryTable`, `AnalyticsBlock`, `DeepViewPanel`) |
| `app/operations/staff/page.tsx` | full rewrite | Re-restored full staff cockpit (KPI strip + anomalies + dept breakdown + payroll trend + register + archived) |
| `app/knowledge/page.tsx` | -55 +9 | Re-restored from prior deploy `dpl_5B5z3cVUhnAMp3ZpRwcnDzks7HCB` |
| `app/finance/page.tsx` | +52 | Reference / platform-map section card |
| `app/settings/page.tsx` | +36 | Reference / platform-map link card |
| `app/finance/ledger/page.tsx` | +44 | Section additions |
| `components/nav/subnavConfig.ts` | +2 -1 | POS Cloudbeds rename + supplier-mapping + platform-map nav |
| `vercel.json` | +5 | `maxDuration: 60` for `/api/marketing/upload` |
| `app/revenue/channels/[source]/page.tsx` | +2 -1 | Minor import |

Plus 3 cherry-picked commits from concurrent session (its recovery work):
- `38e267f` — feat(inventory): add Sold YTD/30d to stock table
- `04e274d` — recovery: rewrite reverted pages + lock components
- `666c678` — feat: recover WIP across pillars + nav fixes for parity & knowledge/alerts

---

## NEW — cockpit infrastructure (37 untracked, ALL Cowork)

| Group | Files |
|---|---|
| API routes (21) | `app/api/cockpit/{activity,agent/{prompts,run},auth/{magic-link,redeem},chat,cost,docs/{backup,detail,promote,rollback,route},knowledge,schedule,schema/{rows,tables},standing-task/run,team,webhooks/{incident,uptime,vercel}}/route.ts` |
| UI | `app/cockpit/page.tsx` (~1700 lines, 10 tabs) |
| Library | `lib/cockpit-tools.ts` (skill dispatcher with 17 handlers) |
| Auth | `middleware.ts` (Basic Auth + magic-link cookie) |
| Cockpit docs | `cockpit/AGENT_NETWORK.md`, `cockpit/decisions/{0002,0003,0004}-*.md`, runbooks, `cockpit/PHASE_0_RECONCILIATION_REPORT.md`, this PR body |
| Make blueprints | 4 blueprints + INSTALL guide |
| Misc | `.vercel-deploy-wrapper.sh`, `public/platform-map-v5.html` |

---

## NEW — Supabase migrations (16 hand-written + 7 flagged)

16 mine with full SQL, header pattern matches existing migrations:

```
20260506105031_cockpit_agent_worker_cron.sql
20260506105212_cockpit_email_intake_trigger.sql
20260506110456_cockpit_agent_prompts.sql
20260506112236_cockpit_agent_skills.sql
20260506113040_cockpit_regular_jobs.sql
20260506113720_cockpit_knowledge_base_and_cost_tracking.sql
20260506114529_cockpit_more_scheduled_tasks.sql
20260506131528_cockpit_departments.sql
20260506131958_cockpit_agent_identity.sql
20260506133005_cockpit_standing_tasks.sql
20260506135714_cockpit_seed_security_agent.sql
20260506135741_cockpit_kb_authority_matrix.sql
20260506140345_documentation_governance_v2_phase1.sql
20260506140428_documentation_governance_v2_phase2_skills.sql
20260506141223_expose_documentation_schemas_to_postgrest.sql
20260506141310_documentation_rls_service_role_policies.sql
```

7 concurrent migrations in DB but not in repo — tracked in `supabase/migrations/CONCURRENT_MIGRATIONS_TODO.md`. Recover via `supabase db pull` once Docker runs. Non-blocking for Phase 0.

---

## Verification after merge

- `main` HEAD = source that produced production deploy `dpl_8yuJFddTaUJy1LDghmFaFcJmNcbg`
- Tag merge commit `v0-post-reconciliation`
- No functional deploy change (source already shipped)

**Rollback path**:
1. `git reset --hard v0-pre-reconciliation-github` on `main` → back to `b4b3e79`
2. Restore working tree from `/Users/paulbauer/Desktop/cockpit-baselines/namkhan-bi-working-tree-20260506_162046.tgz`
3. Vercel: redeploy from `dpl_8yuJFddTaUJy1LDghmFaFcJmNcbg` (known-good)
4. Supabase: PITR to 2026-05-06 ~14:00 UTC OR Pro daily backup

---

## Acceptance for this PR

- [ ] Review Group A diffs (3 files)
- [ ] Scrutinize Group B diffs (9 files, concurrent)
- [ ] Approve the 16 Cowork migrations
- [ ] Confirm 37 untracked cockpit files are wanted
- [ ] Confirm 3 cherry-picked commits are wanted
- [ ] Merge → tag `v0-post-reconciliation` → proceed to Phase 0 Parts 3-7

**No deploy will be triggered** — this is a repo reconciliation only.
