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
