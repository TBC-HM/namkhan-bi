// app/revenue/leakage/page.tsx
// Canonical leakage page (Namkhan default property).
// The middleware strips /h/260955/* -> /* for Namkhan, so this is the
// route that actually renders for Namkhan. /h/1000001/* (Donna) keeps
// its prefix and is served by app/h/[property_id]/revenue/leakage/page.tsx.
// PBS 2026-05-26 (#248): BedbankKpiStrip mounted via kpiStrip slot (empty for Namkhan).

import PageRenderer from '@/app/_components/registry/PageRenderer';
import BedbankKpiStrip from '@/app/_components/registry/BedbankKpiStrip';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LeakagePage() {
  return (
    <PageRenderer
      pageSlug="leakage"
      propertyId={260955}
      title="Revenue · Leakage"
      subtitle="rate leakage · source transparency"
      layout="graphs-first"
      kpiStrip={<BedbankKpiStrip propertyId={260955} />}
    />
  );
}
