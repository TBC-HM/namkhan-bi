// app/revenue/lighthouse/rates/page.tsx
import { LighthouseShell, SampleBanner, LighthouseEmpty } from '../_shared/LighthouseShell';
import { RatesTable } from '../_shared/Tables';
import { getLatestSnapshotDate, getRatesRows } from '../_shared/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LighthouseRatesPage({ propertyId }: { propertyId?: number } = {}) {
  const pid = propertyId ?? 260955;
  const snapshot = await getLatestSnapshotDate(pid);
  const { rows, hotels } = snapshot
    ? await getRatesRows(pid, snapshot)
    : { rows: [], hotels: [] };
  return (
    <LighthouseShell
      view="rates"
      title="Lighthouse · Rates"
      subtitle="Grid: per date × per competitor · current published rate or restriction (LOS2/LOS3/Sold out/No flex)"
    >
      {snapshot && <SampleBanner snapshotDate={snapshot} />}
      {rows.length === 0 ? <LighthouseEmpty view="Rates" /> : <RatesTable rows={rows} hotels={hotels} />}
    </LighthouseShell>
  );
}
