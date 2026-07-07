// app/revenue/lighthouse/vs-yesterday/page.tsx
import { LighthouseShell, SampleBanner, LighthouseEmpty } from '../_shared/LighthouseShell';
import { DeltaTable } from '../_shared/Tables';
import { getLatestSnapshotDate, getDeltaRows } from '../_shared/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROPERTY_ID = 260955;

export default async function LighthouseVsYesterdayPage() {
  const snapshot = await getLatestSnapshotDate(PROPERTY_ID);
  const { rows, hotels, earlierSnapshot } = snapshot
    ? await getDeltaRows(PROPERTY_ID, snapshot, 1)
    : { rows: [], hotels: [], earlierSnapshot: null };
  return (
    <LighthouseShell
      view="yesterday"
      title="Lighthouse · vs Yesterday"
      subtitle="Same grid + 1-day delta — spot same-day movements across the compset"
    >
      <SampleBanner snapshotDate={snapshot} />
      {rows.length === 0
        ? <LighthouseEmpty view="vs Yesterday" />
        : <DeltaTable rows={rows} hotels={hotels} earlierSnapshot={earlierSnapshot} />}
    </LighthouseShell>
  );
}
