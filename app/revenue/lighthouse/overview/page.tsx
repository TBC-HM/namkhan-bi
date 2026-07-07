// app/revenue/lighthouse/overview/page.tsx
import { LighthouseShell, SampleBanner, LighthouseEmpty } from '../_shared/LighthouseShell';
import { OverviewTable } from '../_shared/Tables';
import { getLatestSnapshotDate, getOverviewRows } from '../_shared/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROPERTY_ID = 260955;

export default async function LighthouseOverviewPage() {
  const snapshot = await getLatestSnapshotDate(PROPERTY_ID);
  const rows = snapshot ? await getOverviewRows(PROPERTY_ID, snapshot) : [];
  return (
    <LighthouseShell
      view="overview"
      title="Lighthouse · Overview"
      subtitle="Per-date summary — own flex rate · median compset · rank · my OTB · market demand · ranking · holidays · events"
    >
      <SampleBanner snapshotDate={snapshot} />
      {rows.length === 0 ? <LighthouseEmpty view="Overview" /> : <OverviewTable rows={rows} />}
    </LighthouseShell>
  );
}
