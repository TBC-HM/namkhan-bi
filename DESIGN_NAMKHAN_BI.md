# Namkhan BI — Design System (canonical reference)

**Last updated**: 2026-05-03
**Reference page**: https://namkhan-bi.vercel.app/sales/inquiries (treat this as the master pattern; every other page must match its typography / hierarchy / surface language).
**Spec doc**: [docs/11_BRAND_AND_UI_STANDARDS.md](docs/11_BRAND_AND_UI_STANDARDS.md) (240 lines, full spec including KpiBox + DataTable rules)

---

## Principal rules (no exceptions)

These were locked by the user across multiple design rounds. Any new code that breaks them is a regression.

1. **One design language**: same brown / Soho House aesthetic everywhere — `--paper-warm` cards on `--paper` page background, `--ink` text, `--brass` accents, `--moss` headers/banners.
2. **Italic Fraunces serif for every KPI value** (the "$14.3k" treatment).
3. **Mono uppercase brass-letterspaced for every header / scope label** (matches the tab-nav voice).
4. **`$` prefix for currency** — never `USD `. ISO `YYYY-MM-DD` for every date. `—` for every empty cell.
5. **Zero hardcoded values** — every `fontSize`, `fontFamily`, `color`, `background` flows through a token or a canonical class.
6. **One component per concern** — `<KpiBox>` for KPI tiles, `<DataTable>` for tables, `<StatusPill>` for status, `<PageHeader>` for page headers. New code uses these; legacy code is force-aligned via CSS.
7. **No dev/design callout boxes in the UX** — `.design-note`, `.write-banner`, `.warn-banner`, `.gr-sim-banner` are hidden site-wide.

---

## Token scale (single source: `styles/globals.css` `:root`)

### Palette
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#efe6d3` | page background |
| `--paper-warm` | `#f4ecd8` | card / panel background (THE container color) |
| `--paper-deep` | `#e6daC0` | borders, hover-row tint |
| `--ink` | `#1c1815` | primary text |
| `--ink-soft` | `#4a443c` | body text, lede |
| `--ink-mute` | `#7d7565` | secondary text, mono labels |
| `--ink-faint` | `#b3a888` | disabled / lorem text |
| `--line-soft` | `#d8cca8` | thin dividers |
| `--moss` | `#1a2e21` | banner / header bg, primary buttons |
| `--moss-glow` | `#6b9379` | success accents |
| `--brass` | `#a8854a` | titles, headers, accent text |
| `--brass-soft` | `#c4a06b` | hover borders, secondary accents |
| `--st-good/warn/bad` | — | status semantics + their `*-bg`/`*-bd` tints |
| `--ch-direct/ota/wholesale/other/corporate/groups` | — | chart palette |

### Typography
| Token | Size | Use |
|---|---|---|
| `--t-xs` | 10px | eyebrow labels, mono caps |
| `--t-sm` | 11px | tile sub-text, table cells |
| `--t-base` | 12px | table body, decision meta |
| `--t-md` | 13px | body, lede, sub labels |
| `--t-lg` | 14px | decision impact, panel head |
| `--t-xl` | 16px | card subheadings, h3 |
| `--t-2xl` | 22px | tile value (italic serif), tile big numerals |
| `--t-3xl` | 30px | page title (italic serif h1) |

Letter spacing: `--ls-tight` (-0.01em, titles), `--ls-loose` (0.06em, small caps), `--ls-extra` (0.18em, mono eyebrows).

Fonts: `--serif` = Fraunces, `--sans` = Inter Tight, `--mono` = JetBrains Mono.

### Status tints + chart palette
See full list at top of `styles/globals.css` `:root` block.

---

## Canonical components (locked specs)

### `<KpiBox>` — `components/kpi/KpiBox.tsx`
THE KPI tile for every pillar.

```tsx
<KpiBox value={28.3} unit="pct" label="Occupancy"
        delta={{ value: 5.2, unit: 'pp', period: 'STLY' }}
        compare={{ value: -3.1, unit: 'pp', period: 'Bgt' }}
        tooltip="Occupancy · Last 30d · f_overview_kpis · room nights sold ÷ saleable" />
```

- **Layout**: delta(s) top → italic serif value center → mono uppercase scope label → optional needs pill bottom-right
- **Units handled**: `usd | lak | pct | pp | d | nights | count | text`
- **States**: `live | data-needed | pending` (data-needed greys value + adds amber pill)
- **Hover**: 1px lift + brass-soft border + soft shadow + `[data-tooltip]` reveal

Legacy components (`KpiCard`, `Kpi`, `OpsKpiTile`) all render into `.kpi-box` markup so every existing call site shares the same visuals.

### `<DataTable>` — `components/ui/DataTable.tsx`
THE table for every list view.

```tsx
const columns: Column<Row>[] = [
  { key: 'name',    header: 'PARTNER', sortValue: r => r.name, render: r => r.name },
  { key: 'country', header: 'COUNTRY', render: r => fmtCountry(r.flag, r.country) },
  { key: 'status',  header: 'STATUS',  align: 'center',
    render: r => <StatusPill tone="active">Active</StatusPill> },
  { key: 'revenue', header: 'REVENUE', numeric: true,
    sortValue: r => r.revenue, render: r => fmtTableUsd(r.revenue) },
];

<DataTable columns={columns} rows={rows} rowKey={r => r.id}
           emptyState="No partners on file." />
```

- **Header**: bold mono uppercase brass-letterspaced
- **Body**: sans regular, tabular-nums for numeric cols, no full-grid
- **Sortable**: pass `sortValue: (r) => string|number` on a column
- **Hover**: paper-deep tint, transition 120ms
- **Empty cell**: `—` via `EMPTY` const or `fmtEmpty()`

**Important** — server pages must NOT pass `render` / `sortValue` directly to `<DataTable>`; functions can't cross the RSC boundary. Wrap in a `'use client'` component (see `B2bContractsTable.tsx` as reference).

### `<StatusPill>` — `components/ui/StatusPill.tsx`
```tsx
<StatusPill tone="active">Active</StatusPill>
<StatusPill tone="pending">Expiring</StatusPill>
<StatusPill tone="expired">Expired</StatusPill>
<StatusPill tone="inactive">Draft</StatusPill>
<StatusPill tone="info">Pending</StatusPill>
```

Locked shape: rounded pill, 3×10 padding, mono uppercase 10px, brand status tints.

### `<PageHeader>` — `components/layout/PageHeader.tsx`
```tsx
<PageHeader
  pillar="Sales"
  tab="Inquiries"
  title={<>Every inquiry, an <em style={{ color: 'var(--brass)' }}>answer</em> before lunch.</>}
  lede="Triage, auto-quote, approve, send."
  rightSlot={<UploadContractButton />}
/>
```

Same eyebrow + h1 + lede + optional right-slot on every page.

---

## Format helpers (`lib/format.ts`)

Every numeric / currency / date in the app MUST flow through one of these.

```ts
import { fmtKpi, fmtDelta, fmtTableUsd, fmtIsoDate, fmtCountry, fmtBool, EMPTY } from '@/lib/format';

fmtKpi(28.3, 'pct')          // "28.3%"
fmtKpi(8900, 'usd')          // "$8.9k"
fmtKpi(-3100, 'usd')         // "−$3.1k" (true minus, U+2212)
fmtKpi(1200000, 'usd')       // "$1.2M"
fmtKpi(48000, 'lak')         // "₭48k"  (₭ prefix locked)
fmtKpi(5.2, 'pp')            // "+5.2pp"
fmtKpi(-3.1, 'pp')           // "−3.1pp"
fmtKpi(42, 'd')              // "42d"
fmtKpi(2.8, 'nights')        // "2.8"
fmtKpi(1234, 'count')        // "1,234"

fmtDelta(5.2, 'pp', 'STLY')  // { text: "▲ +5.2pp STLY", tone: 'pos', arrow: '▲' }
fmtDelta(0.02, 'pp')         // { text: "→ stable", tone: 'flat', arrow: '→' }
fmtDelta(-3.1, 'pp', 'Bgt')  // { text: "▼ −3.1pp Bgt", tone: 'neg', arrow: '▼' }

fmtTableUsd(13480)           // "$13,480" (table currency, no decimals, comma-grouped)
fmtIsoDate('2026-04-30T...')  // "2026-04-30"
fmtCountry('🇫🇷', 'France')  // "🇫🇷 France"
fmtBool(true) / fmtBool(false) // "✓" / "—"
EMPTY                        // "—" (em-dash, U+2014)
```

---

## File map — where things live

```
styles/globals.css                       — :root tokens + .kpi-box + .data-table + .status-pill rules
docs/11_BRAND_AND_UI_STANDARDS.md        — full canonical spec (240 lines)
DESIGN_NAMKHAN_BI.md                     — this file (high-level reference)

components/
  kpi/KpiBox.tsx                         — canonical KPI box (use for new code)
  kpi/KpiCard.tsx                        — legacy shim, renders into .kpi-box
  kpi/Kpi.tsx                            — legacy shim, renders into .kpi-box
  ops/OpsKpiTile.tsx                     — legacy shim, renders into .kpi-box
  ui/DataTable.tsx                       — canonical table
  ui/StatusPill.tsx                      — canonical status pill
  layout/PageHeader.tsx                  — canonical page header
  charts/DailyRevenueChart.tsx           — Recharts area chart with brand palette
  charts/MonthlyByDeptChart.tsx          — Recharts bar chart with brand palette

lib/format.ts                            — every formatter (fmtKpi, fmtDelta, fmtTableUsd, etc.)
lib/svgCharts.ts                         — server-rendered SVG charts with native <title> tooltips

app/revenue/_redesign/overrideCss.ts     — brand override layered on top of legacy mockup CSS
                                           (re-binds .bc-redesign tokens to brand palette)
```

### Legacy scopes that are force-aligned via CSS overrides
- `.pnl-page` (used only by `/finance/pnl`) — `!important` rules in `globals.css` map `.kpi`, `.scope`, `.val`, `.lbl`, `.deltas`, `.needs` to canonical look
- `.bc-redesign` (used by all `/revenue/*` tabs) — re-binds 12 design tokens + `.kpi-card` / `.kpi-value` / `.kpi-label` typography in `app/revenue/_redesign/overrideCss.ts`
- `table:not(.data-table)` — global !important rules force every plain `<table>` to inherit canonical brass-mono header + paper-warm bg + paper-deep dividers

---

## Surface checklist for new code

When adding a new page or component, follow this order:

1. **Page header** → use `<PageHeader pillar tab title lede rightSlot />`
2. **KPI tiles** → use `<KpiBox value unit label delta compare state needs tooltip />` (or pass through legacy `<KpiCard>` / `<OpsKpiTile>`, both render into `.kpi-box`)
3. **Tables** → use `<DataTable columns rows rowKey emptyState />` from a `'use client'` component (server pages can't pass functions to the table)
4. **Status indicators** → use `<StatusPill tone>{label}</StatusPill>`
5. **Currencies / dates / empty** → import from `lib/format` (`fmtTableUsd`, `fmtIsoDate`, `EMPTY`)
6. **Containers / sections** → use `.panel` (or `.panel.flush` for edge-to-edge tables, `.panel.dashed` for empty states)
7. **Inline text sizes** → use `var(--t-xs)`/`--t-sm`/`--t-base`/`--t-md`/`--t-lg`/`--t-xl`/`--t-2xl`/`--t-3xl` tokens, never numeric literals

---

## Verification gates (before merging anything design-related)

```bash
# 1. Type-check
npx tsc --noEmit

# 2. No hardcoded fontSize literals
grep -rE "fontSize:\s*[0-9]" app/ components/ | grep -v fuse_hidden | wc -l   # must be 0

# 3. No hardcoded fontFamily literals (beyond legacy fallbacks)
grep -rE "fontFamily:\s*'(Georgia|Menlo|Helvetica|Arial)" app/ components/ | wc -l   # must be 0

# 4. No hardcoded brand-color hex (except in :root)
grep -rE "#[0-9a-fA-F]{6}" app/ components/ | grep -v 'fuse_hidden\|var(--' | wc -l   # must be small (only fallbacks in var())

# 5. No `USD ` prefix in JSX (use $ via fmtTableUsd)
grep -rE 'USD \{|USD [0-9]' app/ components/ | grep -v 'fuse_hidden\|//' | wc -l   # must be 0

# 6. Live CSS sanity
curl -s 'https://namkhan-bi.vercel.app/sales/inquiries' | grep -oE '/_next/static/css/[a-z0-9]+\.css' | head -1
# pull the CSS hash and grep for `kpi-tile-value{font-family:var(--serif)`
```

---

## Known concurrent-session risk

A separate Cowork session (running schema/data work) periodically commits to `main`. Once during run #1, that session reverted the `:root` token bridge in commit `27e4126` (the commit subject said "audit: getDqIssues uses v_dq_open" but the diff also reverted CSS unrelated to its title). Mitigation:

- Belt-and-braces approach: keep both global `:root` aliases AND scoped `.pnl-page` aliases so reverts of one don't break the page.
- Always re-run the verification grep after pulling.

---

## Major fixes / discoveries from prior sessions (load-bearing)

Pulled from memory because they bite repeatedly:

- **Multi-session race**: another Claude session can wipe untracked files via git operations. Either coordinate, branch, or `git add -f` immediately. Memory: `feedback_namkhan_bi_multi_session_race.md`
- **`'use client'` required for inline handlers**: `tsc` + Vercel "Compiled successfully" don't catch missing `'use client'` directives — pages 500 at runtime. Pre-deploy grep recipe in `feedback_use_client_inline_handlers.md`.
- **Vercel CDN cache hides regressions**: `revalidate=60` + `force-dynamic` still serves CDN-cached HTML. Verify with `?bust=` before debugging wiring (`feedback_overview_cdn_cache.md`).
- **Always type-check tarball drops**: run `npx tsc --noEmit` BEFORE deploying any new tarball — the build's "Compiled successfully" message only means it compiled, not that types check (`feedback_namkhan_bi_tarball_typecheck.md`).
- **`.fuse_hidden_*` zombie files**: macOS Finder creates these as byte-identical copies of files that have open handles. They're junk; `.gitignore` already drops them but always grep before commits.
- **CSS variable fallback hex pattern**: `var(--ink-mute, #8a8170)` is intentional defensive design — the hex never fires if the token is defined globally. Audit scripts should EXCLUDE these from "hardcoded hex" counts.

---

## Component-level migration ledger (current state, 2026-05-03)

| Component / page | Status |
|---|---|
| `<KpiBox>` | ✅ canonical, exported from `components/kpi/KpiBox.tsx` |
| `<KpiCard>` | ✅ legacy shim → renders `.kpi-box` |
| `<Kpi>` | ✅ legacy shim → renders `.kpi-box` |
| `<OpsKpiTile>` | ✅ legacy shim → renders `.kpi-box` |
| `<DataTable>` | ✅ canonical, exported from `components/ui/DataTable.tsx` |
| `<StatusPill>` | ✅ canonical, exported from `components/ui/StatusPill.tsx` |
| `<PageHeader>` | ✅ canonical, used by 11 pages |
| `/sales/b2b` table | ✅ migrated to `<DataTable>` (B2bContractsTable.tsx) |
| `/sales/b2b/performance` | ✅ migrated to `<DataTable>` (B2bPerformanceTable.tsx) |
| `/sales/groups` | ✅ migrated to `<DataTable>` (GroupsTable.tsx) |
| `/sales/roster` | ✅ migrated to `<DataTable>` (RosterTable.tsx) |
| `/sales/b2b/reconciliation` | inline `<table>` (legacy MappingPicker rows) — covered by `table:not(.data-table)` !important rules |
| `/finance/pnl` USALI table | inline `<table class="usali">` — covered by `.pnl-page table.usali` overrides |
| `/finance/pnl` KPI tiles | inline `.kpi` markup — covered by `.pnl-page .kpi *` overrides |
| `/guest/directory` GuestTable | client component with Tailwind classes — covered by `table:not(.data-table)` !important rules |
| `/operations/staff` StaffTable | client component with Tailwind classes — covered by `table:not(.data-table)` !important rules |
| `/revenue/*` mockup tables | injected HTML via `dangerouslySetInnerHTML` — covered by `.bc-redesign table` !important rules + `app/revenue/_redesign/overrideCss.ts` brand re-bind |

Every page's tables and KPIs render through one of: a canonical component, a legacy shim that delegates to the canonical, or a `!important` CSS override. **Zero pages bypass the rule set.**

---

## Pre-existing issues NOT addressed by design work

These pre-date all design rounds and need their own engineering work:

- `/agents`, `/agents/roster`, `/agents/history` return 500 (last touched in commit `998e5f3`, before any design runs)

---

## Pick up here later

1. Read this doc + `docs/11_BRAND_AND_UI_STANDARDS.md`
2. If the user reports a visual inconsistency, run the 6 verification greps above first to confirm whether it's a code regression or a perception issue
3. If a new page is added, follow the "Surface checklist" above
4. **Don't introduce new fontSize / color hex literals** — use tokens
5. **Don't introduce new tile or table markup** — wrap an existing canonical component
6. If a legacy scope (`.bc-redesign` / `.pnl-page`) ever pops up again, the fix is `!important` CSS overrides, not refactoring 1500 lines of mockup CSS

---

## Mandatory session ritual (locked 2026-05-03)

**EVERY** session that touches Namkhan BI UI / design / components / styles MUST follow this loop. This is non-negotiable per user instruction.

### At session START
1. Read this file (`DESIGN_NAMKHAN_BI.md`) end-to-end
2. Read `docs/11_BRAND_AND_UI_STANDARDS.md` if a new component spec is being defined
3. Spot-check 1-2 canonical imports are still present (`grep -l 'from .@/components/kpi/KpiBox'` etc.)
4. If the doc says a verification grep should run, run it before claiming the codebase is consistent

### At session END (before declaring work done)
1. Run `bash date +%Y-%m-%d` to get today's date — never invent it
2. Append an entry to the "Update history" section at the bottom of THIS file with:
   - Today's date as a `### YYYY-MM-DD` heading
   - Bullet list of what changed (new components, new tokens, new pages migrated, new !important overrides, new format helpers)
   - Any new verification grep that future sessions should run
   - Any new known-debt item or NEW pages that bypass the canonical pattern
3. If a NEW canonical component was added: also append a section to `docs/11_BRAND_AND_UI_STANDARDS.md`
4. Commit the doc update with the deploy commit (don't leave it floating uncommitted)
5. Update memory entries that became stale, but keep this doc as primary source of truth

### Why this is locked
Without the ritual, design rules drift across sessions. One session ships a new component but the next session doesn't know it's canonical and rebuilds from scratch (or worse, breaks the rule). The user explicitly called this an "auto cycle" 2026-05-03. The doc-update closes the loop.

The auto-memory pointer at `reference_namkhan_bi_design_system.md` always lists this doc first; the ritual memory at `feedback_namkhan_bi_design_session_ritual.md` mandates the read+update behavior. Both load every session via `MEMORY.md`.

---

## Bootstrap if memory is wiped (recovery procedure)

If a future session can't find `reference_namkhan_bi_design_system.md` or `feedback_namkhan_bi_design_session_ritual.md` in auto-memory, recreate them. The doc is the source of truth — memory entries are convenience pointers.

### Recreate `reference_namkhan_bi_design_system.md`
Path: `<auto-memory-dir>/reference_namkhan_bi_design_system.md`
Content:
```
---
name: namkhan-bi design system canonical reference
description: Where the locked design rules live, which components are canonical, and how to add new code without breaking visual consistency. Read FIRST for any namkhan-bi UI work.
type: reference
---

The Namkhan BI portal has a single locked design system. Two canonical docs:

1. /Users/paulbauer/Desktop/namkhan-bi/DESIGN_NAMKHAN_BI.md — high-level reference (file map, component list, surface checklist, verification gates, migration ledger)
2. /Users/paulbauer/Desktop/namkhan-bi/docs/11_BRAND_AND_UI_STANDARDS.md — full canonical spec (KpiBox + DataTable + StatusPill + PageHeader rules with examples)

Reference page: https://namkhan-bi.vercel.app/sales/inquiries

Canonical components:
- KPI tiles → <KpiBox> at components/kpi/KpiBox.tsx
- Tables → <DataTable> at components/ui/DataTable.tsx (must be wrapped in 'use client')
- Status pills → <StatusPill tone> at components/ui/StatusPill.tsx
- Page headers → <PageHeader> at components/layout/PageHeader.tsx

Format helpers in lib/format.ts: fmtKpi, fmtDelta, fmtTableUsd, fmtIsoDate, fmtCountry, fmtBool, EMPTY.
$ prefix only (never USD ). ISO YYYY-MM-DD only. — em-dash for empty.

Token scale in styles/globals.css :root: 8-step ramp --t-xs (10px) → --t-3xl (30px), brand palette (--paper, --paper-warm, --ink, --brass, --moss).

Why / how to apply: read DESIGN_NAMKHAN_BI.md FIRST. Don't refactor, force-align legacy via !important. New pages: follow Surface checklist.
```

### Recreate `feedback_namkhan_bi_design_session_ritual.md`
Path: `<auto-memory-dir>/feedback_namkhan_bi_design_session_ritual.md`
Content:
```
---
name: namkhan-bi design session ritual — read at start, update at end
description: Every session that touches namkhan-bi UI must (1) read DESIGN_NAMKHAN_BI.md first, (2) append a dated changelog entry to it before finishing.
type: feedback
---

For ANY session that touches Namkhan BI UI / design / components / styles:

AT SESSION START:
1. Read /Users/paulbauer/Desktop/namkhan-bi/DESIGN_NAMKHAN_BI.md end-to-end
2. Read docs/11_BRAND_AND_UI_STANDARDS.md if defining new component spec

AT SESSION END:
1. Run `bash date +%Y-%m-%d` to get today's date — never invent
2. Append a ### YYYY-MM-DD heading to the "Update history" section at bottom of DESIGN_NAMKHAN_BI.md with bullet list of changes
3. Commit the doc update with the deploy

Why: User locked this auto-cycle 2026-05-03. Without it design rules drift across sessions and rebuilds-from-scratch happen.

How to apply: applies to ANY session touching app/, components/, styles/, or lib/format.ts. Even a 1-line CSS change gets a dated entry.
```

### Update `MEMORY.md` index
Path: `<auto-memory-dir>/MEMORY.md`
Add these two entries at the top (or merge with existing top-of-file entries):
```
- [namkhan-bi DESIGN SYSTEM (canonical UI rules, locked 2026-05-03)](reference_namkhan_bi_design_system.md) — **READ FIRST for any UI/design work.** Master doc at `Desktop/namkhan-bi/DESIGN_NAMKHAN_BI.md` + full spec at `docs/11_BRAND_AND_UI_STANDARDS.md`. Canonical components: `<KpiBox>`, `<DataTable>`, `<StatusPill>`, `<PageHeader>`. Format helpers in `lib/format.ts`. Reference page = `/sales/inquiries`.
- [namkhan-bi DESIGN SESSION RITUAL (mandatory for every UI session)](feedback_namkhan_bi_design_session_ritual.md) — **AT START** read DESIGN_NAMKHAN_BI.md. **AT END** append a dated changelog entry to it. Auto-cycle locked by user 2026-05-03.
```

### Even simpler fallback
If memory is wiped AND nothing above is reachable, the repo itself has a `CLAUDE.md` at the root with the same instructions — that's the last line of defense for AI tools that auto-load CLAUDE.md.

---

## Update history

Append-only. Newest at top. Date heading + bullet changes.

### 2026-05-03 (sales-proposal-builder · pre-send room availability gate) — agent-confidence layer

Why: PBS clarified the use case — at the moment the offer goes out, the rooms must actually exist in the PMS. If tight, the reservation agent puts a block in Cloudbeds manually. Build a gate that re-checks availability at send-time and at every block change, so the agent never sends an offer for rooms they can't deliver.

Backend (no schema change — pure read-side):
- `lib/sales.ts` — added `checkProposalRoomsAvail(proposalId)` returning `ProposalCheck` with per-room status (green/yellow/red), inventory freshness in minutes, overall worst-status reduction, and human-readable messages with Cloudbeds-action prompts ("Open Cloudbeds → Calendar → River Suite to add a block, then re-check.")
- `lib/sales.ts` — added types `RoomCheckRow`, `ProposalCheck`
- `app/api/sales/proposals/[id]/check/route.ts` — new GET endpoint, just calls the lib function and returns JSON. 404 on unknown proposal id.
- `app/api/sales/proposals/[id]/send/route.ts` — pre-send check now mandatory. Returns HTTP 409 with `{ error: 'rooms_unavailable', message, check }` when status is 'red'. Yellow + green proceed. `?force=1` query param lets an agent override (logged in `proposal_sent` Make webhook payload as `forced: true`).

Frontend (design-conformant):
- `components/proposal/ComposerEditor.tsx` — calls `/check` on mount and after every block change via `useEffect([blocks.length])`. Adds `<div className="avail-banner avail-{status}">` between header and tabs, with per-room messages, "↻ Re-check" button, "Force-send anyway" button (only when red).
- Send button now `disabled={check?.status === 'red'}`; tooltip explains why.
- `sendProposal({ force: true })` path covers the override, including the 409-handling fallback that just re-renders the banner.

CSS additions to `styles/globals.css` (~70 lines):
- `.avail-banner` / `.avail-banner-{head,msg,list,icon}` — banner shell
- `.avail-banner.avail-{green,yellow,red}` + `.avail-room-pill.avail-{yellow,red}` — status tints using `var(--st-good-bg/bd)` / `var(--st-warn-bg/bd)` / `var(--st-bad-bg/bd)` — same status palette as `<StatusPill>`, no new tokens introduced
- All values flow through brand tokens

Bonus fix shipped with this commit:
- `app/finance/pnl/page.tsx` — removed dangling `import TwelveMonthPanel from './TwelveMonthPanel';` (file never existed; left over from a previous session). Was breaking `npx tsc --noEmit` exit 1, which would have failed the Vercel build.

Verification gates re-run live: 0 hardcoded fontSize, 0 fontFamily, 0 hex outside `:root`, 0 USD prefix, `'use client'` directive present on the modified ComposerEditor, `npx tsc --noEmit` exit 0, build 54s, 422 deployment files, alias updated to namkhan-bi.vercel.app within 1m of READY.

Known operational gap (NOT a code regression):
- `rate_inventory.synced_at` is currently 4.4 days stale because `cb_sync_*` cron is dead (other Claude session owns). Result: every proposal currently shows YELLOW with "stale" in the message. That is correct — the gate is honestly reporting reality. Once `cb_sync_*` is back, the gate will start showing green again.

### 2026-05-03 (sales-proposal-builder feature shipped) — design-conformant rebuild

Backend (no UI):
- New schema `sales` (17 tables · 41 RLS policies · 2 RPCs) applied to namkhan-pms
- 7 categories + 7 LP partners + 30 activities seeded
- 5 sample inquiries seeded (James Kim, Hanoi Architects Co, Sophie Martin, Liu Wei, Hartmann GmbH)
- `pgrst.db_schemas` correctly merged: appended only `sales` (per memory rule, never overwrite)
- 6 migration files at `supabase/migrations/2026050309000{1..6}_*.sql` + rollback
- Schema fixes vs original spec: FKs targeted real PKs (`marketing.media_assets(asset_id)`, `governance.dmc_contracts(contract_id)`)

New code (design-conformant):
- `lib/sales.ts` — server-only data layer (Inquiry / Proposal / ProposalBlock / Activity / RoomAvail types + 12 query functions, all via `getSupabaseAdmin()` service-role)
- `lib/composerRunner.ts` — Auto-Offer Composer with stub fallback when ANTHROPIC_API_KEY absent (€0.20 cost cap, logs to `sales.agent_runs`)
- `lib/ics.ts` — RFC-5545 calendar file builder (no external dep)
- `lib/makeWebhooks.ts` — graceful-degrade Make.com webhook firer (logs to console if env var missing, never crashes the request)
- 10 API routes: `/api/sales/proposals/{rooms,activities}`, `/api/sales/proposals/[id]/{blocks,email,email/regenerate,send}`, `/api/p/[token]/{blocks,view,sign}`
- 3 pages: `/sales/inquiries/[id]` (detail + Open in Composer CTA), `/sales/proposals/[id]/edit` (composer), `/p/[token]` (public guest-facing proposal)
- 5 React components in `components/proposal/`: `ComposerEditor`, `RoomPickerDrawer`, `ActivityCatalogDrawer`, `EmailEditor`, `PublicProposalClient`

Design-system conformance:
- ALL new UI uses `<PageHeader>`, `<DataTable>`, `<StatusPill>`, `.panel`, `.t-eyebrow`, `.btn`, `.card-grid-3` — no new tile/table markup invented
- ALL formatting via `fmtTableUsd`, `fmtIsoDate`, `EMPTY`, `FX_LAK_PER_USD` from `lib/format.ts`
- ZERO hardcoded `fontSize:` numeric literals in proposal code (verified via grep)
- ZERO hardcoded brand-color hex outside `:root` (verified via grep)
- ZERO `'USD '` prefix in JSX (verified via grep)
- ZERO `fontFamily:` legacy literals (verified via grep)
- All 5 client components carry `'use client';` directive (verified via head-of-file grep)

CSS additions to `styles/globals.css` (~150 lines):
- `.proposal-drawer` / `.proposal-drawer-mask` / `.proposal-drawer-{head,body,warn,tabs,chips,controls,title}` — drawer surface
- `.proposal-input` — themed text/select input
- `.chip` / `.chip.on` — category filter chip
- `.composer-grid` / `.composer-block-row` / `.composer-block-{label,meta}` / `.composer-num-input` / `.composer-total-{row,label,value}` — composer screen
- `.email-editor-{label,input,textarea}` — email editor
- `.public-prop-{bg,hero,hero-eyebrow,hero-title,hero-sub,main,block,block-title,block-note,qty-btn,removed,sign-form,cta,done,done-h1}` — guest-facing public page
- All values flow through brand tokens (no hex literals introduced)
- `body:has(.public-prop-bg) .rail { display: none }` — bare layout for `/p/[token]` (bypasses portal nav)

Mods to existing files:
- `components/nav/subnavConfig.ts` — Packages flipped from `coming: true` to `isNew: true`
- `app/sales/inquiries/page.tsx` — wired to live `sales.inquiries` data via `listInquiries()`, falls back to mock decisions if empty
- `next.config.js` — added `headers()` block with `X-Robots-Tag: noindex` + `Cache-Control: private, no-store` for `/p/:token`
- `lib/agents/sales/autoOfferComposer.ts` — agent status flipped `idle` → `run`

Make blueprints (handoff folder):
- `to-vercel-production/sales-proposal-builder/` populated with 5 JSON blueprints (proposal-sent, viewed, guest-edited, signed, expired) + README + env-vars-to-add.md
- PBS imports manually in Make.com; webhook URLs go to `MAKE_WEBHOOK_PROPOSAL_*` env vars

Race-survival:
- `git add -f` after each batch of edits (per memory `feedback_namkhan_bi_multi_session_race.md`) — first attempt yesterday lost 25 files to a parallel session

Verification gates run live: 0 hardcoded fontSize, 0 fontFamily, 0 hex outside :root, 0 USD prefix, all 5 client components carry 'use client', `npx tsc --noEmit` exit 0.

### 2026-05-03 (later) — risk mitigation: 4-layer survival of memory wipes
- Added `CLAUDE.md` at repo root — auto-loaded by Claude Code / Cursor / future Claude sessions; embeds the locked rules + ritual so memory-wipe is survivable
- Added README.md design-system call-out at the top — visible to any human or tool browsing the repo
- Added `.github/workflows/design-doc-check.yml` — soft-warn (non-blocking) when a PR touches `app/` / `components/` / `styles/` / `lib/format.ts` without updating `DESIGN_NAMKHAN_BI.md`
- Added "Bootstrap if memory is wiped" section to this doc with copy-paste templates for the two memory entries (`reference_namkhan_bi_design_system.md`, `feedback_namkhan_bi_design_session_ritual.md`) and the `MEMORY.md` index lines
- Net effect: even if all auto-memory is cleared, an AI session reading `CLAUDE.md` or `DESIGN_NAMKHAN_BI.md` can recover the full ritual + canonical rule set

### 2026-05-03 — initial canonical lockdown (this session)
- New components shipped (canonical):
  - `components/kpi/KpiBox.tsx` — locked spec, auto-formatters, structured deltas, data-needed state
  - `components/ui/DataTable.tsx` — sortable, columns + rows API, brass-mono header voice
  - `components/ui/StatusPill.tsx` — 5-tone locked palette
  - `components/layout/PageHeader.tsx` — eyebrow + h1 + lede + rightSlot
- Legacy components refactored to render canonical markup:
  - `KpiCard`, `Kpi`, `OpsKpiTile` — all now emit `.kpi-box` markup
- 4 sales tables migrated to `<DataTable>` via client-component wrappers:
  - `B2bContractsTable`, `B2bPerformanceTable`, `GroupsTable`, `RosterTable`
- Format helpers added to `lib/format.ts`:
  - `fmtKpi(n, unit, dp?)`, `fmtDelta(n, unit, period?, opts?)`, `fmtTableUsd`, `fmtIsoDate`, `fmtCountry`, `fmtBool`, `EMPTY`
- Token additions to `:root`:
  - 8-step type scale (`--t-xs` 10px → `--t-3xl` 30px)
  - Letter-spacing scale (`--ls-tight`, `--ls-loose`, `--ls-extra`)
  - Status tints (`--st-good-bg/bd`, `--st-warn-bg/bd`, `--st-bad-bg/bd`, `--st-info-bg/bd/tx`)
  - Channel palette (`--ch-direct/ota/wholesale/other/corporate/groups`)
  - Mockup-vocab aliases (`--card`, `--bad`, `--ok`, `--body`, `--num`, `--tan`, `--green`, `--green-2`, `--tan-2`, etc.)
  - `--paper-pure` for explicit white surfaces
- `!important` overrides shipped:
  - `table:not(.data-table)` — every legacy `<table>` inherits canonical brass-mono header + paper-warm bg
  - `.pnl-page .kpi *` — `/finance/pnl` legacy markup matches `.kpi-box` typography
  - `.bc-redesign *` — `/revenue/*` mockup CSS re-bound to brand palette via `app/revenue/_redesign/overrideCss.ts`
- App-wide sweeps:
  - `USD ` prefix → `$` (every JSX text literal and template literal)
  - 529 hardcoded `fontSize` literals → token references
  - 392 hardcoded brand-color hex → CSS variables
  - 53 `'Georgia, serif'` → `var(--serif)`
  - 47 `'Menlo, monospace'` → `var(--mono)`
  - Em-dash (`—`) for empty cells everywhere
  - ISO `YYYY-MM-DD` for every date
- Hidden site-wide: `.design-note`, `.write-banner`, `.warn-banner`, `.gr-sim-banner`, `.data-source-line`, `.period-banner` (dev-callout boxes; not for end-user UX)
- Hover affordance shipped: `.kpi-box:hover` + `[data-tooltip]:hover::after` (12px AAA-contrast tooltip with 320px max-width and 120ms fade-in)
- Mobile responsive: 3-tier collapse for `.card-grid-*` and `.kpi-strip.cols-*` at 1100/760/480 breakpoints
- Chart hover tooltips: `<title>` SVG elements on every data point in `lib/svgCharts.ts` + Recharts `labelFormatter` showing `value · period · source`
- Doc + spec:
  - Created this file (`DESIGN_NAMKHAN_BI.md`, 350+ lines)
  - Appended ~120 lines to `docs/11_BRAND_AND_UI_STANDARDS.md` (KpiBox + DataTable specs)
  - Locked the auto-cycle ritual in memory (`feedback_namkhan_bi_design_session_ritual.md`) and at the bottom of this doc
- Verification gates run live: 0 hardcoded fontSize, 0 `USD ` prefix, 58/61 sampled routes return 200, 0 5xx
- Pre-existing 500s NOT addressed: `/agents`, `/agents/roster`, `/agents/history` (last touched in `998e5f3`, predates all design rounds)
