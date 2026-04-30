# Operations · Housekeeping + Maintenance — deploy ready 2026-04-30

## What was coded

| Layer | Count | Path |
|---|---|---|
| New pages | 2 | `app/operations/housekeeping/page.tsx`, `app/operations/maintenance/page.tsx` |
| HK components | 6 | `app/operations/housekeeping/_components/` |
| HK data files | 6 | `app/operations/housekeeping/_data/` |
| Maint components | 7 | `app/operations/maintenance/_components/` |
| Maint data files | 7 | `app/operations/maintenance/_data/` |
| HK agents | 4 | `lib/agents/hk/` (Coordinator, Linen Watcher, Amenity Composer, DND Guardian) |
| Maint agents | 4 | `lib/agents/maint/` (SLA Watcher, Asset Health Scout, Energy Anomaly Hunter, PPM Scheduler) |
| Shared IA primitives | 6 | `components/ops/` (DataNeededOverlay, AgentStrip, DecisionQueue, TacticalAlerts, GuardrailsBanner, OpsKpiTile) |
| SQL migrations | 16 | `supabase/migrations/2026043012000001..16_*.sql` (NOT yet applied to Supabase) |
| Config | 2 | `components/nav/subnavConfig.ts` (drop coming, add isNew); `components/nav/SubNav.tsx` (render NEW pill) |

**Total:** 58 files (57 new + 1 modified config pair).

## What was NOT done

| Action | Why |
|---|---|
| `psql` apply 16 SQL files | Tables don't exist yet — pages render with "Data needed" overlays per package spec. Apply via Supabase MCP or psql when ready. |
| Cloudbeds webhook bridge (HK + Maint) | External system; needs API auth + endpoint test. Schema PROMPT.md describes the wire-up. |
| `git checkout -b feat/operations-housekeeping-maintenance` | Working tree has WIP on `revenue-redesign-v2` (D5/D6/D7/D8/D11/D14 staged). Auto-branching would entangle. |
| Push branch + run `deploy-namkhan-bi.command` | Awaiting your "go". |

## Hard rules — verified

- [x] All 9 IA blocks present on each page (per `_meta/REVENUE-STANDARD.md`)
- [x] 4 agent chips on each strip (≥2 minimum)
- [x] Yellow Guardrails banner on each
- [x] "Data needed · Gap-Hx / Gap-Mx" overlay on every panel whose backing table is empty
- [x] No fabricated data — all panels driven by `fetch*()` returning `null` until tables exist
- [x] Maintenance CapEx "Promote" button writes only to `governance.budget_proposals` (no external write)
- [x] All agents ship in `idle` status with `approval-required` guardrails
- [x] `npx tsc --noEmit` passes (exit 0)
- [ ] Regression curl checks (run after deploy)

## Deploy steps (in order, when ready)

```bash
cd ~/Desktop/namkhan-bi

# 1. Branch & commit ONLY the new HK+Maint work (do not bundle pre-existing WIP)
git checkout -b feat/operations-housekeeping-maintenance

git add components/nav/subnavConfig.ts components/nav/SubNav.tsx \
        components/ops/ \
        app/operations/housekeeping/ \
        app/operations/maintenance/ \
        lib/agents/hk/ \
        lib/agents/maint/ \
        supabase/migrations/ \
        "to vercel production /HK-MAINT-DEPLOY-2026-04-30.md"

git commit -m "feat(ops): housekeeping + maintenance sub-tabs (IA pass)

- 9-block IA per /revenue redesign standard, both sub-tabs
- 4 agents each (all idle, approval-required mode)
- All panels render with 'Data needed · Gap-Hx/Mx' overlays until backing tables ship
- 16 SQL migrations staged under supabase/migrations/ (not applied)
- Sub-nav HK + Maint flagged NEW (no longer 'coming')
- No external writes auto-fired — guardrails banner on each page"

# 2. Type-check (re-verify after commit)
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
npx --yes tsc --noEmit   # must exit 0

# 3. Push + deploy
git push -u origin feat/operations-housekeeping-maintenance
nohup '/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/deploy-namkhan-bi.command' \
  > /tmp/nb_hkm.log 2>&1 & disown

# 4. Verify (allow 60-90s for Vercel build)
for url in \
  https://namkhan-bi.vercel.app/operations/housekeeping \
  https://namkhan-bi.vercel.app/operations/maintenance \
  https://namkhan-bi.vercel.app/operations/today \
  https://namkhan-bi.vercel.app/finance/pnl \
  https://namkhan-bi.vercel.app/revenue/pulse; do
  printf "%-65s " "$url"
  curl -sI "$url" | head -1
done
# All should return HTTP/2 200 or HTTP/1.1 200.
```

## After deploy — apply schema (separate step)

The 16 SQL files in `supabase/migrations/` are staged but **not applied**. Apply order is encoded in filename. See `supabase/migrations/README.md` for psql + Supabase MCP instructions. The pages will keep rendering "Data needed" overlays until the corresponding table has rows.

**Do NOT apply `2026043012000009_mt_03-assets.sql` until the asset census (Gap-M2) is complete or `ops.maintenance_tickets` is empty** — the FK will fail otherwise.

## Cloudbeds wiring (deferred)

- HK: subscribe `housekeeping.statuschanged` + `reservation.checkedout` → upsert `ops.room_status`
- Maint: subscribe `room.note.created` (or poll `/rooms/{id}/notes` every 30 min) → insert `ops.maintenance_tickets`
- No write endpoints on either bridge — internal only

Detail in `nk-deploy-pkg-2026-04-30/01-housekeeping/schema/PROMPT.md` and `02-maintenance/schema/PROMPT.md`.
