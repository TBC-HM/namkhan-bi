# Period Wiring — Install + Per-Page Patch Guide

**Problem:** Dropdowns in the period bar push to URL, but data fetchers ignore the URL params. Result: changing "Look Back" doesn't change the numbers.

**Fix:** Make `lib/period.ts` the single contract. Every page reads `searchParams`, calls `resolvePeriod()`, passes the result to data fetchers. Every fetcher in `lib/data.ts` accepts a `ResolvedPeriod` instead of using hardcoded windows.

This patch wires the **plumbing** (period lib, data lib, PeriodBar, Overview page) and gives you a checklist for the remaining pages.

---

## Files in this bundle

| File | Action |
|---|---|
| `lib/period.ts` | **REPLACE** existing — adds `resolvePeriod()` + `segmentFilter()` |
| `lib/data.ts` | **REPLACE** existing — every fetcher takes `ResolvedPeriod` |
| `components/nav/PeriodBar.tsx` | **REPLACE** existing — adds active-period readout |
| `app/overview/page.tsx` | **REPLACE** existing — example pattern, period-aware |
| `styles/period-active.css` | **APPEND** to globals.css |

---

## Install

```bash
cd /tmp/namkhan-bi-fresh

unzip -o ~/Downloads/namkhan-period-wiring.zip -d /tmp/period-staging
cp -r /tmp/period-staging/period-wiring/* .

# Append the new CSS
cat styles/period-active.css >> styles/globals.css
rm styles/period-active.css INSTALL.md

git add -A
git status
```

Verify in `git status` that you see:
- modified: `lib/period.ts`
- modified: `lib/data.ts`
- modified: `components/nav/PeriodBar.tsx`
- modified: `app/overview/page.tsx`
- modified: `styles/globals.css`

Then commit and push.

---

## After this push, /overview will be fully wired

Test these URLs after deploy:

- `/overview` — default 30d
- `/overview?back=last_365` — should show "Last 12 Months" everywhere, numbers reflect 365 days
- `/overview?back=last_7&seg=ota` — last week, OTA only
- `/overview?back=last_30&cmp=stly` — last month with STLY comparison column
- `/overview?fwd=next_30` — pace view, next 30 days

---

## CRITICAL — repeat the pattern on every other page

Every page that displays period-dependent numbers needs the same 3-line treatment.

### Pages to patch (do these one at a time, push after each):

| Page | Status |
|---|---|
| `app/overview/page.tsx` | ✅ done by this patch |
| `app/today/page.tsx` | ⬜ usually period-independent (live snapshot), but check |
| `app/revenue/pulse/page.tsx` | ⬜ |
| `app/revenue/demand/page.tsx` | ⬜ |
| `app/revenue/channels/page.tsx` | ⬜ |
| `app/revenue/rates/page.tsx` | ⬜ |
| `app/revenue/rateplans/page.tsx` | ⬜ |
| `app/revenue/inventory/page.tsx` | ⬜ |
| `app/departments/roots/page.tsx` | ⬜ |
| `app/departments/spa-activities/page.tsx` | ⬜ |
| `app/finance/pnl/page.tsx` | ⬜ |
| `app/finance/ledger/page.tsx` | ⬜ |
| `app/marketing/reviews/page.tsx` | ⬜ optional — reviews have their own time filter |

### The 3-step patch for each page

**Step 1.** Add `searchParams` to the page signature:

```diff
- export default async function MyPage() {
+ interface Props { searchParams: Record<string, string | string[] | undefined>; }
+ export default async function MyPage({ searchParams }: Props) {
```

**Step 2.** Resolve the period at the top:

```diff
+ import { resolvePeriod } from '@/lib/period';
+
  export default async function MyPage({ searchParams }: Props) {
+   const period = resolvePeriod(searchParams);
    // ... rest of page
  }
```

**Step 3.** Pass `period` to every data fetcher. Replace fetchers that took raw args:

```diff
- const data = await getMyMetric(30);
+ const data = await getMyMetric(period);
```

**Step 4 (optional but recommended).** Show the active period in section titles:

```diff
- <div className="section-title">Performance</div>
+ <div className="section-title">Performance · {period.label}</div>
+ <div className="section-tag">{period.rangeLabel}</div>
```

---

## If a fetcher doesn't yet accept `ResolvedPeriod`

Two options:

**A. Quick fix** — extract `from`, `to`, `seg` and pass those:

```ts
const data = await getMyMetric({
  from: period.from,
  to: period.to,
  segment: period.seg,
});
```

**B. Proper fix** — update the fetcher signature in `lib/data.ts`:

```ts
// Before
export async function getMyMetric(days: number) {
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0,10);
  // ...
}

// After
import type { ResolvedPeriod } from './period';
import { segmentFilter } from './period';

export async function getMyMetric(period: ResolvedPeriod) {
  // use period.from, period.to, period.seg
  const segF = segmentFilter(period.seg);
  let q = supabase.from('reservations').select('...')
    .gte('check_in_date', period.from)
    .lte('check_out_date', period.to);
  if (segF.column && segF.values?.length) {
    q = q.in(segF.column, segF.values);
  }
  // ...
}
```

---

## What the user sees after this is fully rolled out

1. Pick "Last Year" from Look Back → URL becomes `?back=last_year`, all KPI tiles recalc to 2025 calendar year, section titles say "Performance · Last Year", range bar shows "01 Jan 2025 → 31 Dec 2025"
2. Add "OTA" segment → URL becomes `?back=last_year&seg=ota`, all numbers filter to OTA channels only, label says "Last Year · OTA"
3. Add "vs STLY" compare → URL becomes `?back=last_year&seg=ota&cmp=stly`, KPI tiles show ▲/▼ delta vs same period last year
4. Click "✕ Reset" → URL clears, returns to default Last Month view
5. Active filter row visible at all times, so user knows exactly what's on screen

---

## Risks / known gaps

- **`getDailySeries` chart range** — I left the chart at 90d ending at `period.to` (not `period.from→to`) because the chart is meant to show recent trend, not always the active range. If you want the chart to follow the period, change line 75 of `app/overview/page.tsx`.
- **Segment mapping** — I mapped your channels to segments based on the source values I saw on the live dashboard (Booking.com, Website/Booking Engine, etc.). If your data uses different labels, edit `segmentFilter()` in `lib/period.ts`.
- **GOPPAR still null** — no cost data in DB yet, this is unchanged.
- **Compare = Budget** — not implemented (no budget data uploaded). UI shows it, but `getKpis` returns `compare = null` for budget mode.
- **Capacity assumed 19 sellable rooms** — hardcoded constant in `fetchKpisForRange`. If you reopen Tent 7 or change inventory, update the constant.

---

## After install, test

```
https://namkhan-bi.vercel.app/overview?back=last_365
```

Should show:
- Section title "Performance · Last 12 Months"
- Range bar "29 Apr 2025 → 28 Apr 2026"
- Numbers reflect 365 days (occupancy and ADR will be different from Last 30d)

If numbers don't change between `?back=last_30` and `?back=last_365`, the data fetcher is still ignoring the period — check that `lib/data.ts` was actually overwritten.
