# Deploy prompt — `/front-office/arrivals` (frontend)

**Use:** drop into `~/Desktop/namkhan-bi/proposals approved/` to approve. The next scheduled-task run will turn this into a deploy doc in `~/Desktop/namkhan-bi/to vercel production /`. Frontend can ship before schema if all data-needed tags are honest.

## Brief for the implementing Claude Code session

Repo: `~/Desktop/namkhan-bi`
Branch: off `revenue-redesign-v2` → `feat/front-office-arrivals`
Stack: Next.js 14 app router, Tailwind, server components for data fetch, client components only for filters / agent modals / approve buttons.

### Routes and layout

- Create `/app/front-office/layout.tsx` (section shell with sub-tab navigation: Arrivals · In-house · Departures · Walk-ins · Handover · VIP & Cases · Roster). Only `Arrivals` is wired in v1; the others render a placeholder "section under construction" with a single-line description.
- Create `/app/front-office/arrivals/page.tsx` implementing the 9 mandatory blocks, in order, sampled from the branded mockup at `proposals/2026-04-30-front-office-arrivals/front-office-arrivals-mockup-branded.html`.
- Add `Front Office` entry to the global sidebar with a `NEW` badge (matches `/sales` pattern).

### The 9 blocks — wiring rules

1. **Breadcrumb + Title** — static.
2. **Filter bar** — wire property filter to `cloudbeds.properties` (single property today; render as disabled dropdown). Date window default = next 72h. All other pills are visual placeholders in v1; tag with `Data needed: filter logic` tooltip and ship.
3. **Sub-tab row** — wire only Arrivals; others link to `#` and tooltip `Coming soon`. ⚙ Agent Guardrails opens the unified settings modal (reuse the existing component from `/revenue/_redesign`). Counter pulls `governance.decision_queue` count where `section='front-office'`.
4. **KPI row** — wire what we can:
   - **Arrivals next 72h** — read `frontoffice.arrivals` if shipped, otherwise read `cloudbeds.reservations` directly (write a thin server-side adapter). Live.
   - **Pre-arrival contact rate** — `frontoffice.prearrival_messages.status='sent' / total arrivals`. `Data needed` until F1 ships.
   - **Pre-arrival upsell take** — `frontoffice.upsell_offers.outcome='accepted' / status='sent'`. `Data needed` until F1.
   - **Upsell $ MTD** — `sum(outcome_value_usd)` where outcome accepted in MTD. `Data needed` until F1.
   - **VIP coverage** — `vip_briefs.status='handed' / count(vip arrivals)`. `Data needed` until F1.
   - **Median check-in** — `frontoffice.arrivals.median_checkin_secs`. `Data needed` (no Cloudbeds API exposure today).
   - Honest "Data needed" tags with tooltip naming the missing source. **Never fake a value.**
5. **Agent strip** — render 8 chips, status from `frontoffice.agent_runs` last row per agent. ETA Watcher status `paused` until flight ingest live. Click chip opens the unified agent modal component.
6. **Decisions queued for you** — read `governance.decision_queue` filtered to `section='front-office' AND tab='arrivals'`. Sort by `decay_weighted_value desc`. Each row: Approve / Send back / Snooze / Open. Approve dispatches to the relevant write action; for Cloudbeds-write actions, show the `writes Cloudbeds · approval req` stamp.
7. **Tactical alerts** — read `governance.alerts` filtered the same way. Severity border. Render handoff buttons that link to `/agents/<agent>/run?context=<alert_id>`.
8. **Core panels** — Arrivals board reads `frontoffice.arrivals` joined to `prearrival_messages`, `upsell_offers`, `vip_briefs`, `compliance_docs`. Composer tray reads `prearrival_messages` and `upsell_offers` where `status='draft' AND confidence is not null`, sorted by `confidence × $ × decay`. Funnel reads computed counts last 30d. Upsell mix reads `upsell_offers` group by `upsell_type`. VIP table reads `arrivals JOIN vip_briefs` for next 14d. Group table reads `group_arrival_plans` joined to `arrivals` next 30d. **Until F1 schema ships, render skeletons + "Data needed" tooltip. Do not stub fake rows.**
9. **Guardrails banner** — static, copy from the proposal.

### Server actions (write paths)

All Cloudbeds-write actions go through `/lib/cloudbeds/write.ts` with the existing approval-gate wrapper. Reuse the same audit log table that `/revenue/pricing` writes to. Add `frontoffice.agent_runs` writes on every agent-triggered draft create, regardless of approval state.

### Acceptance criteria

- [ ] `/front-office` link visible in left nav with NEW badge.
- [ ] `/front-office/arrivals` renders all 9 blocks, no console errors.
- [ ] Empty schema state: every dynamic tile shows a clean "Data needed" tag with a real tooltip; no fake numbers.
- [ ] Branded skin matches `front-office-arrivals-mockup-branded.html` (cream `#f5efde`, forest `#1f3d2e`, tan `#a17a4f`, italic serif headings, tabular sans numerals).
- [ ] Existing routes (`/revenue/*`, `/sales/inquiries`, `/finance/*`, `/operations/*`) all return 200 and render unchanged.
- [ ] Mobile / 1280-viewport: agent chips collapse 7–8 behind `+ 2 more`.
- [ ] Sub-tab placeholders for In-house / Departures / Walk-ins / Handover / VIP & Cases / Roster are linked but route to `#` with a `Coming soon` toast.

### Deploy ritual

```bash
cd ~/Desktop/namkhan-bi
git checkout revenue-redesign-v2 && git pull
git checkout -b feat/front-office-arrivals
# implement
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
npx --yes tsc --noEmit          # MUST pass clean
git add -A && git commit -m "feat(front-office): /front-office/arrivals — IA + agent strip, data-needed gated"
git push -u origin feat/front-office-arrivals
nohup '/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/deploy-namkhan-bi.command' > /tmp/nb_force.log 2>&1 & disown
tail -10 /tmp/nb_force.log
```

### Smoke tests after deploy

```bash
curl -sI https://namkhan-bi.vercel.app/front-office | head -1               # expect 200
curl -sI https://namkhan-bi.vercel.app/front-office/arrivals | head -1      # expect 200
curl -sI https://namkhan-bi.vercel.app/revenue/pulse | head -1              # expect 200 (regression)
curl -sI https://namkhan-bi.vercel.app/sales/inquiries | head -1            # expect 200 (regression)
curl -sI https://namkhan-bi.vercel.app/finance/pnl | head -1                # expect 200 (regression)
```

### Rollback

If anything regresses on `/revenue/*` or `/sales/*`, revert the merge in main, redeploy from `revenue-redesign-v2`. The `/front-office` route is fully isolated; no shared write paths.

### Done

- [ ] Drop `.shipped` marker next to this prompt in `proposals approved/`.
- [ ] Append a row to `to vercel production /_LOG.md` with the commit hash and curl results.
- [ ] Update `proposals/_index.md` "Already-processed map" with `/front-office/arrivals`.
