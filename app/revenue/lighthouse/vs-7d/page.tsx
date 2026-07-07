// app/revenue/lighthouse/vs-7d/page.tsx
import { LighthouseShell, SampleBanner, LighthouseEmpty } from '../_shared/LighthouseShell';
import { DeltaTable } from '../_shared/Tables';
import { getLatestSnapshotDate, getDeltaRows } from '../_shared/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LighthouseVs7dPage({ propertyId }: { propertyId?: number } = {}) {
  const pid = propertyId ?? 260955;
  const snapshot = await getLatestSnapshotDate(pid);
  const { rows, hotels, earlierSnapshot } = snapshot
    ? await getDeltaRows(pid, snapshot, 7)
    : { rows: [], hotels: [], earlierSnapshot: null };
  return (
    <LighthouseShell
      view="seven_days"
      title="Lighthouse · vs 7 days ago"
      subtitle="Same grid + 7-day delta — spot week-over-week pricing trends"
    >
      {snapshot && <SampleBanner snapshotDate={snapshot} />}
      {rows.length === 0
        ? <LighthouseEmpty view="vs 7 days ago" />
        : <DeltaTable rows={rows} hotels={hotels} earlierSnapshot={earlierSnapshot} />}
    </LighthouseShell>
  );
}
