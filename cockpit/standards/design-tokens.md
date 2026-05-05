# Design Tokens — namkhan-bi

> **For this repo, this file is a pointer.** The canonical, authoritative design system lives in `DESIGN_NAMKHAN_BI.md` at the repo root, plus `docs/11_BRAND_AND_UI_STANDARDS.md`. The hard rules and verification recipes in the root `CLAUDE.md` (§ "Hard rules") win on any conflict.

## Canonical sources (read in this order)

1. `DESIGN_NAMKHAN_BI.md` (repo root) — full design system reference: tokens, typography, components, verification recipes, update history.
2. `docs/11_BRAND_AND_UI_STANDARDS.md` — full spec for canonical components (`<KpiBox>`, `<DataTable>`, `<StatusPill>`, `<PageHeader>`).
3. `CLAUDE.md` (repo root) § "Hard rules" — the 10 non-negotiable formatting rules.
4. `CLAUDE.md` (repo root) § "Verification recipes" — grep recipes that must return 0 before any UI work is declared done.
5. `cockpit/standards/brand-namkhan.md` — brand-level rules (logo, tone, languages).

## What lives where

| Concern | Where to look |
|---|---|
| Color tokens (`--brass`, `--ink`, etc.) | CSS `:root` in `app/globals.css` (or equivalent) — defined as variables, never hardcoded hex outside `:root` |
| Typography sizes (`--t-xs`, `--t-sm`, `--t-2xl`) | Same `:root` — never hardcoded `fontSize` literals in JSX |
| Currency / date / empty-cell formatting | `lib/format.ts` (`fmtKpi`, `fmtTableUsd`, `fmtIsoDate`, `EMPTY`, …) |
| Canonical components | `components/kpi/KpiBox.tsx`, `components/ui/DataTable.tsx`, `components/ui/StatusPill.tsx`, `components/layout/PageHeader.tsx` |
| Reference page (every page must match) | https://namkhan-bi.vercel.app/sales/inquiries |

## Designer agent enforcement

The cockpit Designer agent (read-only, see `.claude/agents/designer.md`) flags:
- Any `fontSize:` numeric literal in `app/` or `components/`
- Any `USD ` prefix in JSX (must use `$`)
- Any hardcoded brand-color hex outside `:root`
- Any hardcoded `fontFamily` (Georgia, Menlo, Helvetica, Arial)
- Pre-formatted currency/pct/date strings passed where a typed prop + helper would work
- Empty cells rendered as `N/A`, `null`, blank, or `0` (must be `—`)

Recipes for grep-based verification live in root `CLAUDE.md` § "Verification recipes". Run them before claiming any visual work is done.

## Why this file is short

Everything else moved to `DESIGN_NAMKHAN_BI.md` deliberately — keeping a single authoritative source of truth survives concurrent sessions and silent reverts (see root `CLAUDE.md` § "Concurrent-session warning"). Do not duplicate token values here; they will drift.
