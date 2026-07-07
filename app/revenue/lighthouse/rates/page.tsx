// app/revenue/lighthouse/rates/page.tsx
import { LighthouseShell, SampleBanner, LighthouseEmpty } from '../_shared/LighthouseShell';
import { RatesTable } from '../_shared/Tables';
import { getLatestSnapshotDate, getRatesRows } from '../_shared/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROPERTY_ID = 260955;

export default async function LighthouseRatesPage() {
  const snapshot = await getLatestSnapshotDate(PROPERTY_ID);
  const { rows, hotels } = snapshot
    ? await getRatesRows(PROPERTY_ID, snapshot)
    : { rows: [], hotels: [] };
  return (
    <LighthouseShell
      view="rates"
      title="Lighthouse · Rates"
      subtitle="Grid: per date × per competitor · current published rate or restriction (LOS2/LOS3/Sold out/No flex)"
    >
      <SampleBanner snapshotDate={snapshot} />
      {rows.length === 0 ? <LighthouseEmpty view="Rates" /> : <RatesTable rows={rows} hotels={hotels} />}
    </LighthouseShell>
  );
}
