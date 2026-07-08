// app/revenue/lighthouse/vs-3d/page.tsx
import { LighthouseShell, SampleBanner, LighthouseEmpty } from '../_shared/LighthouseShell';
import { DeltaTable } from '../_shared/Tables';
import { getLatestSnapshotDate, getDeltaRows } from '../_shared/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LighthouseVs3dPage({ propertyId }: { propertyId?: number } = {}) {
  const pid = propertyId ?? 260955;
  const snapshot = await getLatestSnapshotDate(pid);
  const { rows, hotels, earlierSnapshot } = snapshot
    ? await getDeltaRows(pid, snapshot, 3)
    : { rows: [], hotels: [], earlierSnapshot: null };
  return (
    <LighthouseShell
      propertyId={pid}
      view="three_days"
      title="Lighthouse · vs 3 days ago"
      subtitle="Same grid + 3-day delta — catch mid-week pricing repositioning"
    >
      {snapshot && <SampleBanner snapshotDate={snapshot} />}
      {rows.length === 0
        ? <LighthouseEmpty view="vs 3 days ago" />
        : <DeltaTable rows={rows} hotels={hotels} earlierSnapshot={earlierSnapshot} />}
    </LighthouseShell>
  );
}
