// components/page/PeriodSelectorRow.tsx
//
// Canonical "period chooser" row used across /revenue/* (and any other
// dept that needs window + compare selectors).
//
// PBS rule 2026-05-12: selectors NEVER sit in the page-header topRight slot.
// They always sit UNDER the KPI tile row, left-aligned, with consistent gap.
// One component → identical layout across pages → identical layout across
// properties (Namkhan/Donna) without rebuilding sub-pages.
//
// Usage:
//   <Page eyebrow=... title=... subPages={REVENUE_SUBPAGES}>
//     <Brief ... />
//     <KpiRow ... />
//     <PeriodSelectorRow
//       basePath="/revenue/pulse"
//       win={period.win}
//       cmp={period.cmp}
//       timeOptions={[{win:'7d',label:'7d'}, ...]}     // optional override
//       compareOptions={[{cmp:'none',label:'None'}, ...]}  // optional override
//       preserve={{ seg: period.seg }}                  // extra params
//     />
//     <Panel ... />
//   </Page>

import TimeframeSelector from './TimeframeSelector';
import CompareSelector from './CompareSelector';

interface Option<KType extends 'win' | 'cmp'> {
  [k: string]: string;
}

interface Props {
  basePath: string;
  win: string;
  cmp: string;
  /** Override the default 6-button time set. */
  timeOptions?: Array<{ win: string; label: string }>;
  /** Override the default 6-button compare set. */
  compareOptions?: Array<{ cmp: string; label: string }>;
  /** Show forward-looking (next7/30/90) options alongside back-looking ones. */
  includeForward?: boolean;
  /** Other URL params to preserve when the user clicks a button. */
  preserve?: Record<string, string | undefined>;
  /** Optional extra content rendered on the right side of the row (e.g. seg picker). */
  rightSlot?: React.ReactNode;
}

export default function PeriodSelectorRow({
  basePath,
  win,
  cmp,
  timeOptions,
  compareOptions,
  includeForward,
  preserve,
  rightSlot,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '8px 0 16px',
        // light divider so it visually separates the KPI tile band from the
        // panels below — keeps the chooser feeling part of the data layer,
        // not the page chrome.
        borderTop: '1px solid var(--border-1, #1f1c15)',
        marginTop: 8,
      }}
    >
      <TimeframeSelector
        basePath={basePath}
        active={win}
        options={timeOptions}
        includeForward={includeForward}
        preserve={{ cmp, ...(preserve ?? {}) }}
      />
      <CompareSelector
        basePath={basePath}
        active={cmp}
        options={compareOptions}
        preserve={{ win, ...(preserve ?? {}) }}
      />
      {rightSlot && <div style={{ marginLeft: 'auto' }}>{rightSlot}</div>}
    </div>
  );
}
