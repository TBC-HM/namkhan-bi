// app/revenue/compset/page.tsx
//
// Comp Set v3 — recovery rewrite (2026-05-06).
//
// This file is the preserved legacy compset page. See /revenue/compset

import Page from '@/components/page/Page';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function CompsetLegacyPage() {
  return (
    <Page eyebrow="Revenue · Compset · legacy" title={<>Legacy compset archive</>}>
      <div style={{ padding: 20, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
        The legacy compset page (CompactAgentHeader + PropertyTable + AnalyticsBlock) has
        been replaced by the primitive-based version at{\n        } <Link href="/revenue/compset" style={{ color: 'var(--brass)' }}>/revenue/compset</Link>.
        The bespoke components (CompactAgentHeader / CompsetGraphs / PropertyTable /
        AgentRunHistoryTable / AnalyticsBlock) remain in the repo under
        app/revenue/compset/_components/ for reference and future reuse.
      </div>
    </Page>
  );
}
