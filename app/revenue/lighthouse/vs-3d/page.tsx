// app/revenue/lighthouse/vs-3d/page.tsx
import { LighthouseShell, SampleBanner, LighthouseEmpty } from '../_shared/LighthouseShell';
import { DeltaTable } from '../_shared/Tables';
import { getLatestSnapshotDate, getDeltaRows } from '../_shared/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROPERTY_ID = 260955;

export default async function LighthouseVs3dPage() {
  const snapshot = await getLatestSnapshotDate(PROPERTY_ID);
  const { rows, hotels, earlierSnapshot } = snapshot
    ? await getDeltaRows(PROPERTY_ID, snapshot, 3)
    : { rows: [], hotels: [], earlierSnapshot: null };
  return (
    <LighthouseShell
      view="three_days"
      title="Lighthouse · vs 3 days ago"
      subtitle="Same grid + 3-day delta — catch mid-week pricing repositioning"
    >
      <SampleBanner snapshotDate={snapshot} />
      {rows.length === 0
        ? <LighthouseEmpty view="vs 3 days ago" />
        : <DeltaTable rows={rows} hotels={hotels} earlierSnapshot={earlierSnapshot} />}
    </LighthouseShell>
  );
}
