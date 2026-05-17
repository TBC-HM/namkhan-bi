// app/sales/fit/page.tsx
// Sales › FIT — parked (PBS 2026-05-16). The unified Pipeline carries FIT as
// a deal_type filter; this stub remains for any deep-link or bookmark.

import Page from '@/components/page/Page';
import { SALES_SUBPAGES } from '../_subpages';
import ParkedPageBanner from '../_components/ParkedPageBanner';

export const dynamic = 'force-dynamic';

export default function FitPage() {
  return (
    <Page
      eyebrow="Sales · FIT (parked)"
      title={<>FIT — <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>parked</em></>}
      subPages={SALES_SUBPAGES}
    >
      <ParkedPageBanner
        oldName="FIT"
        goToHref="/sales/leads?deal_type=fit"
        goToLabel="Pipeline · FIT filter"
      />
      <div style={{ padding: 14, fontSize: 'var(--t-sm)', color: 'var(--ink-soft, #4a443c)', lineHeight: 1.6 }}>
        <p>FIT (Free Independent Travelers) live in the unified Pipeline now. They share the same KPI band, funnel stages, cost trail and ICP scoring as all other lead types — the only difference is <code>deal_type=fit</code>.</p>
        <p style={{ marginTop: 10 }}>This page is kept for deep-link compatibility. Confirm deletion once you're happy with the unified Pipeline.</p>
      </div>
    </Page>
  );
}
