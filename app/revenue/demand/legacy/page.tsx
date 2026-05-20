// app/revenue/demand/legacy/page.tsx
// 2026-05-20: archive note. The old Demand page (KpiBox + Panel + DemandGraphs + DemandTable)
// has been replaced by primitives-based /revenue/demand.
import Page from '@/components/page/Page';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default function DemandLegacyPage() {
  return (
    <Page eyebrow="Revenue · Demand · legacy" title={<>Legacy demand archive</>}>
      <div style={{ padding: 20, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
        The legacy Demand page has been replaced by the primitives-based version at{\n
        } <Link href="/revenue/demand" style={{ color: 'var(--brass)' }}>/revenue/demand</Link>.
        The bespoke components (DemandGraphs / DemandTable) remain in the repo under
        app/revenue/demand/_components/ for reference and future reuse.
      </div>
    </Page>
  );
}
