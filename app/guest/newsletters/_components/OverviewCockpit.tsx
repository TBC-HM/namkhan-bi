// app/guest/newsletters/_components/OverviewCockpit.tsx
// PBS 2026-07-21 pm (Add 2, follow-up): minimal Overview cockpit stub.
//
// The full 5-widget cockpit shipped with fbf468da (AnalyticsStrip, Recent errors,
// MonthlyCalendar, SequenceBars, ProposeNewsletterButton seed drawer) was reverted
// by 09bf6b11 and then only its page.tsx was restored by 5cb78f98 — the widget file
// itself never came back. This stub keeps typecheck green and shows a "not
// installed" panel so the operator knows why the Overview tab is empty. Replacing
// this with the real cockpit is tracked separately (owed: analytics view + monthly
// calendar + sequence bars).

import type { CSSProperties } from 'react';

interface Props {
  propertyId: number;
  month?: string;
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const WARM  = '#FAFAF7';

export default function OverviewCockpit({ propertyId, month }: Props) {
  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>
        Overview cockpit — pending re-install
      </div>
      <div style={{ fontSize: 12, color: INK_M, lineHeight: 1.5 }}>
        The full marketing-ops cockpit (Analytics · Recent errors · Monthly calendar ·
        Sequence bars) shipped with commit <code>fbf468da</code> but its widget file
        was reverted by commit <code>09bf6b11</code>. Only the page.tsx was restored
        by <code>5cb78f98</code>. Use the sub-tabs above to navigate to Broadcasts,
        Lifecycle, Templates, Director etc. — the tabs work, only this Overview
        landing panel is stubbed.
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: INK_M }}>
        property_id = {propertyId}{month ? ` · calendar = ${month}` : ''}
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  background: WARM,
  border: '1px dashed ' + HAIR,
  borderRadius: 6,
  padding: '16px 20px',
  color: INK,
};
