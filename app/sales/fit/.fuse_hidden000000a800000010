// app/sales/fit/page.tsx
// Sales › FIT — not yet wired (no fit_quotes / fit_pipeline schema).

import LoremPage, { LOREM_SHORT, LOREM_LONG } from '../_components/LoremPage';

export const dynamic = 'force-dynamic';

export default function FitPage() {
  return (
    <LoremPage
      pillar="Sales"
      tab="FIT"
      lede="Free Independent Travelers — direct retail, repeat guests, OTA out-of-funnel. Composer P90 ≤ 15m reply target."
      kpis={[
        { scope: 'FIT inquiries MTD',    sub: 'Lorem' },
        { scope: 'P90 reply time',       sub: 'target ≤ 15 min' },
        { scope: 'Conversion rate',      sub: 'inquiry → booking' },
        { scope: 'ADR retail',           sub: 'vs OTA delta' },
        { scope: 'Repeat guest %',       sub: 'returning customers' },
      ]}
      sections={[
        { heading: 'Live composer queue', body: LOREM_LONG },
        { heading: 'Inquiry funnel',     body: LOREM_SHORT },
        { heading: 'Repeat guest list',  body: LOREM_SHORT },
        { heading: 'Lost-reason taxonomy', body: LOREM_LONG },
      ]}
      dataSourceNote="Needs schema: sales.fit_inquiries, sales.fit_quotes, sales.fit_outcomes. Build the email-ingest webhook to populate inquiries first; quotes flow from there."
    />
  );
}
