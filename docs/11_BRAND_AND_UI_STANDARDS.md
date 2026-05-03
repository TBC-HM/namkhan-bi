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
