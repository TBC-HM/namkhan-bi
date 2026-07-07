// app/revenue/lighthouse/vs-7d/page.tsx
import { LighthouseShell, SampleBanner, LighthouseEmpty } from '../_shared/LighthouseShell';
import { DeltaTable } from '../_shared/Tables';
import { getLatestSnapshotDate, getDeltaRows } from '../_shared/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROPERTY_ID = 260955;

export default async function LighthouseVs7dPage() {
  const snapshot = await getLatestSnapshotDate(PROPERTY_ID);
  const { rows, hotels, earlierSnapshot } = snapshot
    ? await getDeltaRows(PROPERTY_ID, snapshot, 7)
    : { rows: [], hotels: [], earlierSnapshot: null };
  return (
    <LighthouseShell
      view="seven_days"
      title="Lighthouse · vs 7 days ago"
      subtitle="Same grid + 7-day delta — spot week-over-week pricing trends"
    >
      <SampleBanner snapshotDate={snapshot} />
      {rows.length === 0
        ? <LighthouseEmpty view="vs 7 days ago" />
        : <DeltaTable rows={rows} hotels={hotels} earlierSnapshot={earlierSnapshot} />}
    </LighthouseShell>
  );
}
