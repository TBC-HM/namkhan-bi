# 11 — Brand and UI Standards

> Applies to all SOPs, dashboards, and reports.

## Logos
- **Namkhan logo:** top-left on every dashboard / SOP cover.
- **SLH logo:** bottom-left, smaller scale.
- Minimum clearspace: 2× logo height around it.

## Typography
- Soho House-style serif headings (e.g., Tiempos, Canela, or licensed equivalent).
- Sans-serif body (e.g., Söhne, Inter, or licensed equivalent).
- Lao text: use a verified Lao Unicode font that pairs visually (e.g., Noto Sans Lao for body).

## Color palette (proposed — confirm)
| Use | Color | Hex |
|---|---|---|
| Primary (Namkhan dark) | Deep forest green | `#1F3A2E` |
| Secondary | Warm sand | `#D7C9A7` |
| Accent (alerts only) | Terracotta | `#B8542A` |
| Neutral text | Charcoal | `#2A2A2A` |
| Background | Cream | `#F7F2E8` |

> Note: these align with luxury Lao-hospitality aesthetic. Confirm against existing brand book before locking.

## Tone of voice
- "Casual luxury."
- No exclamation marks. No marketing fluff. No emoji in operational docs.
- Guest-facing (where applicable): warm, understated, place-rooted.

## Dashboard UI rules
- Single KPI per card; trend sparkline below.
- Currency: LAK base, USD secondary, both visible.
- Date format: `DD MMM YYYY` (English), Lao calendar optional secondary.
- No more than 7 KPIs per screen.
- Color-code by department:
  - Reservations: sand
  - Revenue: forest green
  - Housekeeping: muted blue (`#5A7A8A`)
  - F&B: terracotta
  - Management: charcoal

## SOP-specific rules
- A4 portrait or 16:9 landscape (decide per SOP, document in `07_SOP_LIBRARY.md`).
- 1 action per page.
- Real Cloudbeds screenshots (sanitized for guest data).
- Lao primary, English secondary.
- Step numbers in colored circles, large.

## Presentation rules (management decks)
- Landscape 16:9.
- Black + dark green palette (per existing PBS preference for executive decks).
- Strict formatting; no decorative elements.

---

## KPI Box — locked component spec (added 2026-05-03)

### Why
KPI typography drifted across pages: bold sans-serif on /sales/inquiries, italic
serif on /revenue/pulse, mixed currency / percentage / delta formatting. One spec
now governs every KPI surface in the app.

### Single source of truth
- **Component**: `<KpiBox/>` — `components/kpi/KpiBox.tsx`
- **Formatters**: `fmtKpi()` + `fmtDelta()` — `lib/format.ts`
- **CSS**: `.kpi-box` + `.kpi-tile-value` + `.kpi-tile-scope` — `styles/globals.css`

### Typography hierarchy (no exceptions)
| Element | Token | Style |
|---|---|---|
| Primary value | `--t-2xl` | italic Fraunces serif, weight 500, line-height 1.1, `var(--ls-tight)` |
| Label | `--t-xs` | mono uppercase, weight 600, `var(--ls-extra)`, `var(--ink-mute)` |
| Delta line | `--t-xs` | sans, muted; ▲ pos = `--moss`, ▼ neg = `--st-bad`, → flat = `--ink-mute` |
| Needs explainer | `--t-xs` | sans italic muted |

### Unit & symbol formatting (locked)
| Type | Format | Example |
|---|---|---|
| USD whole | `$XXX` no decimals | `$206` |
| USD ≥1k | `$X.Xk` 1 decimal | `$8.9k` |
| USD ≥1M | `$X.XM` 1 decimal | `$1.2M` |
| USD negative | `−$X.Xk` true minus | `−$3.1k` |
| LAK | `₭` prefix (locked) | `₭48k`, `₭1.2M`, `₭2.4B` |
| Percent | `XX.X%` no space | `28.3%` |
| Percentage points | `+X.Xpp` / `−X.Xpp` | `+5.2pp`, `−3.1pp` |
| Days | `Xd` | `42d` |
| Nights / ALOS | decimal, no unit | `2.8` |
| Counts | locale-grouped | `1,234` |

True minus (`−`, U+2212) is used for all negative numbers — never ASCII hyphen.

### Delta indicators (one set)
| Symbol | Meaning | Token |
|---|---|---|
| ▲ | positive vs comparison | `--moss` |
| ▼ | negative vs comparison | `--st-bad` |
| → | stable / flat (within ±0.05) | `--ink-mute` |

Period suffix is appended after the value: `▲ +5.2pp STLY`, `▼ −3.1pp Bgt`.

### Box layout (identical across all pillars)
```
┌────────────────────────────────┐
│ ▲ +5.2pp STLY  ▼ −3.1pp Bgt   │  delta(s)            — top
│                                │
│ 28.3%                          │  primary value       — italic serif
│ OCCUPANCY                      │  label               — mono caps
│                                │
│  [DATA NEEDED]                 │  amber pill          — bottom-right
└────────────────────────────────┘
```

- Background: `var(--paper-warm)` (brown brand surface)
- Border: `1px solid var(--paper-deep)`, `8px` radius
- Padding: `14px 16px`
- Min-height: `108px`
- Hover: `1px translateY` + `var(--brass-soft)` border + soft shadow
- Data-needed state: `--paper-deep` background + dashed border + amber pill

### Empty / data-needed state
- `state="data-needed"` — value rendered as `—` in `--ink-faint`
- `needs="..."` prop renders italic muted explainer below value
- "DATA NEEDED" pill bottom-right (amber, `--st-warn-bg/bd`, mono caps `9px`)

### Usage
```tsx
import KpiBox from '@/components/kpi/KpiBox';

// Live numeric KPI
<KpiBox value={28.3} unit="pct" label="Occupancy"
        delta={{ value: 5.2, unit: 'pp', period: 'STLY' }}
        compare={{ value: -3.1, unit: 'pp', period: 'Bgt' }}
        tooltip="Occupancy · Last 30 days · f_overview_kpis · room nights sold ÷ saleable" />

// Data-needed (greyed + amber pill)
<KpiBox value={null} unit="usd" label="GOPPAR"
        state="data-needed" needs="cost data not wired" />

// Composite text value (legacy escape hatch — prefer numeric)
<KpiBox value={null} unit="text" label="Open / SLA risk" valueText={<>18 / <span style={{ color: 'var(--st-bad)' }}>4</span></>} />
```

### Legacy components
`KpiCard`, `Kpi`, `OpsKpiTile` still exist as compatibility shims and render
into the same `.kpi-box` markup. New code should import `<KpiBox/>` directly
so the structured props enforce locked formatting.

### Acceptance criteria (enforced by code review)
- Zero hardcoded `fontSize` or `fontFamily` on KPI surfaces — all flow through tokens.
- Zero pre-formatted currency/pct strings passed where a numeric `value` + `unit` would work.
- Zero ASCII hyphen `-` in negative values — use true minus `−` (or pass numeric and let `fmtKpi` handle it).
- Every new KPI inherits this layout automatically by using `<KpiBox/>`.

---

## DataTable + StatusPill — locked component spec (added 2026-05-03)

### Why
Tables drifted across pages: bold sans headers on /sales/b2b, smaller mono on /sales/groups, mixed currency formats (`USD 13,480` vs `$13,480`), inconsistent date formats, ad-hoc status pills. One spec governs every list view now.

### Single source of truth
- **Component**: `<DataTable/>` — `components/ui/DataTable.tsx`
- **Status pill**: `<StatusPill tone="active|pending|expired|inactive|info"/>` — `components/ui/StatusPill.tsx`
- **Formatters**: `fmtTableUsd`, `fmtIsoDate`, `fmtCountry`, `fmtBool`, `EMPTY` — `lib/format.ts`
- **CSS**: `.data-table`, `.data-table-th`, `.data-table-td`, `.status-pill` — `styles/globals.css`

### Header row
- `var(--mono)` font, weight 600, `var(--t-xs)` size, `var(--ls-extra)` letter-spacing
- ALL CAPS, color `var(--brass)` (matches tab-nav voice)
- Subtle `1px solid var(--paper-deep)` bottom divider — never full-grid
- Sortable cells get pointer cursor + active arrow ▲ / ▼

### Currency format (locked)
- `$13,480` — `$` prefix, no space, comma grouping, no decimals
- `−$3,200` for negative — true minus
- Empty / null / 0 → `—` (em-dash, never `N/A`, `null`, `USD 0`, blank)
- Right-aligned in column, `font-variant-numeric: tabular-nums` for clean column alignment

### Date format
- ISO `YYYY-MM-DD` everywhere — no mixed `01-Apr-2026` / `1 Apr 26` / etc.
- `fmtIsoDate(d)` truncates ISO strings or formats `Date` objects.

### Row typography
- Sans-serif regular `var(--t-base)`
- Numeric columns: tabular-nums (column alignment)
- Country cells: flag emoji + name via `fmtCountry(flag, name)`

### Status pill (one component)
- Same shape (rounded-full pill), padding 3×10, border 1px
- Tones (locked): `active` (moss-glow on st-good-bg), `pending` (brass on st-warn-bg), `expired` (st-bad on st-bad-bg), `inactive` (ink-mute on paper-deep), `info` (st-info-tx on st-info-bg)
- Mono uppercase 10px letter-spaced — same voice as table headers

### Row layout
- Vertical padding: `10px 14px` (cells), `12px 14px` (header)
- Hover: `background: var(--paper-deep)` tint
- Zebra striping: OFF
- Row dividers: subtle `1px solid var(--paper-deep)` between rows
- Last row's bottom border removed
- Row variants: `.row-warn` (warn tint), `.row-bad` (bad tint), `.row-good` (good tint)

### Column behavior
- `sortValue: (row) => string | number` makes a column sortable
- Click toggles asc / desc; ▲ / ▼ arrow shown on active column
- Right-align for `numeric: true` cols; center for status pills via `align: 'center'`

### Empty / null cells — single character
- `EMPTY` constant exported from `lib/format` = `—` (em-dash)
- Never show `N/A`, `null`, blank, or `0` for missing data
- Wrap with `fmtEmpty(value, formatter?)` to default to `—`

### Renew / boolean / icon columns
- `fmtBool(true)` → `✓` / `fmtBool(false)` → `—`
- Same color (inherits `var(--ink)` for ✓), same size everywhere

### Usage
```tsx
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, fmtCountry, fmtBool, EMPTY } from '@/lib/format';

const columns: Column<Row>[] = [
  { key: 'name',    header: 'PARTNER',  sortValue: r => r.name, render: r => r.name },
  { key: 'country', header: 'COUNTRY',  render: r => fmtCountry(r.flag, r.country) },
  { key: 'status',  header: 'STATUS',   align: 'center', render: r => <StatusPill tone="active">Active</StatusPill> },
  { key: 'effective', header: 'EFFECTIVE', render: r => fmtIsoDate(r.effective) },
  { key: 'days',    header: 'DAYS',     numeric: true, sortValue: r => r.days, render: r => r.days ?? EMPTY },
  { key: 'revenue', header: 'REVENUE',  numeric: true, sortValue: r => r.revenue, render: r => fmtTableUsd(r.revenue) },
  { key: 'renew',   header: 'RENEW',    align: 'center', render: r => fmtBool(r.autoRenew) },
];

<DataTable columns={columns} rows={rows} rowKey={r => r.id} emptyState="No partners on file." />
```

### Acceptance criteria (enforced by code review)
- Zero hardcoded `<th>`/`<td>` styles for tables — must go through `<DataTable/>`.
- Zero `USD ` prefix anywhere — only `$` prefix via `fmtTableUsd`.
- Zero mixed date formats — only ISO `YYYY-MM-DD` via `fmtIsoDate`.
- Zero ad-hoc status pill markup — only `<StatusPill tone={...}/>`.
- Empty cells always show `—` via `EMPTY` or `fmtEmpty()`.
