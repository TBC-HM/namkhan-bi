// app/revenue/lighthouse/overview/page.tsx
import { LighthouseShell, SampleBanner, LighthouseEmpty } from '../_shared/LighthouseShell';
import { OverviewTable } from '../_shared/Tables';
import { getLatestSnapshotDate, getOverviewRows } from '../_shared/data';
import { LighthouseIngestStatus } from '../../_shared/LighthouseIngestStatus';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LighthouseOverviewPage({ propertyId }: { propertyId?: number } = {}) {
  const pid = propertyId ?? 260955;
  const snapshot = await getLatestSnapshotDate(pid);
  const rows = snapshot ? await getOverviewRows(pid, snapshot) : [];
  return (
    <LighthouseShell
      propertyId={pid}
      view="overview"
      title="Lighthouse · Overview"
      subtitle="Per-date summary — own flex rate · median compset · rank · market demand · booking.com ranking · holidays · events"
    >
      {/* 2026-07-14 daily-ingest status strip */}
      <LighthouseIngestStatus report="rateshopping" />
      {snapshot && <SampleBanner snapshotDate={snapshot} />}
      {rows.length === 0 ? <LighthouseEmpty view="Overview" /> : <OverviewTable rows={rows} />}
    </LighthouseShell>
  );
}
