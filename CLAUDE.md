# CLAUDE.md — instructions for AI coding agents working on this repo

> Most AI agents (Claude Code, Cursor, Copilot, future Claude sessions) auto-read this file before doing anything. Anything written here applies to every AI-assisted change in this repo.

## STOP — before you touch any UI code, READ THIS

1. **Open `DESIGN_NAMKHAN_BI.md` (repo root)** — full canonical design system reference.
2. **Open `docs/11_BRAND_AND_UI_STANDARDS.md`** — full spec for `<KpiBox>`, `<DataTable>`, `<StatusPill>`, `<PageHeader>`.
3. Use canonical components only. Don't introduce new tile/table markup, hardcoded fontSize literals, hex colors, or `USD ` prefixes.

## Mandatory session ritual (locked 2026-05-03)

This is non-negotiable per the user. **Every** AI session that touches `app/`, `components/`, `styles/`, `lib/format.ts`, or talks about UI/design MUST:

### At session START
- Read `DESIGN_NAMKHAN_BI.md` end-to-end before any UI work
- If a verification grep is needed, run it (recipes in the doc, "Verification gates" section)

### At session END (before declaring work done)
- Run `date +%Y-%m-%d` to get today's date — never invent it
- Append a `### YYYY-MM-DD` heading + bullet list of changes to the "Update history" section at the bottom of `DESIGN_NAMKHAN_BI.md`
- Commit the doc update with the deploy commit
- **DO NOT skip this step.** The doc is the only authoritative source of truth across sessions; without the changelog, the next session has no idea what's canonical and rebuilds from scratch.

## Canonical components (use these, never replicate)

| Concern | Component | Path |
|---|---|---|
| KPI tile | `<KpiBox>` | `components/kpi/KpiBox.tsx` |
| Table | `<DataTable>` | `components/ui/DataTable.tsx` (must wrap in `'use client'`) |
| Status pill | `<StatusPill>` | `components/ui/StatusPill.tsx` |
| Page header | `<PageHeader>` | `components/layout/PageHeader.tsx` |
| Currency / date / empty | helpers | `lib/format.ts` (`fmtKpi`, `fmtTableUsd`, `fmtIsoDate`, `EMPTY`, ...) |

Reference page: https://namkhan-bi.vercel.app/sales/inquiries — every other page must match this typography / hierarchy / surface.

## Hard rules (no exceptions)

1. `$` prefix for currency, never `USD `. Truncate `>$1k` to `$X.Xk`, `>$1M` to `$X.XM`.
2. `₭` prefix for LAK (locked).
3. ISO `YYYY-MM-DD` for every date.
4. `—` (em-dash) for every empty cell — never `N/A`, `null`, blank, or `0`.
5. True minus `−` (U+2212) for negatives, never ASCII hyphen.
6. Italic Fraunces serif `var(--t-2xl)` for every KPI value.
7. Mono uppercase brass-letterspaced (`var(--t-xs)`, `var(--ls-extra)`, `var(--brass)`) for every header/scope label.
8. Zero hardcoded `fontSize` numeric literals. Use `var(--t-xs)`/`--t-sm`/etc.
9. Zero hardcoded brand-color hex outside `:root`. Use CSS variables.
10. Zero pre-formatted currency/pct/date strings passed where a typed prop + helper would work.

## Verification recipes (run before claiming consistency)

```bash
# 1. Type-check
npx tsc --noEmit

# 2. Zero hardcoded fontSize
grep -rE "fontSize:\s*[0-9]" app/ components/ | grep -v fuse_hidden | wc -l   # must be 0

# 3. Zero `USD ` prefix in JSX
grep -rE 'USD \{|USD [0-9]' app/ components/ | grep -v 'fuse_hidden\|//' | wc -l   # must be 0

# 4. Zero hardcoded fontFamily
grep -rE "fontFamily:\s*'(Georgia|Menlo|Helvetica|Arial)" app/ components/ | wc -l   # must be 0

# 5. CDN cache check before debugging
# Always test with `?bust=$RANDOM` on Vercel — `revalidate=60` + `force-dynamic` still cache HTML.
```

## Deploy

CLI only. `npx vercel --prod --yes` — see `DEPLOY.md`. GitHub auto-deploy is OFF.

## Concurrent-session warning

Another session is running schema/data work on this repo. Once it silently reverted CSS in commit `27e4126` (subject said "audit: getDqIssues uses v_dq_open" but diff also dropped tokens). Mitigation:
- Always re-run verification greps after `git pull`
- Use belt-and-braces (both global `:root` aliases AND scoped fallbacks) so a single revert doesn't break a page
- Coordinate or branch if doing parallel UI work

## If memory entries are missing or stale

If the AI session can't find the design system memory entries (`reference_namkhan_bi_design_system.md` or `feedback_namkhan_bi_design_session_ritual.md`), recreate them from `DESIGN_NAMKHAN_BI.md` § "Bootstrap if memory is wiped". The doc is the recovery source of truth.
