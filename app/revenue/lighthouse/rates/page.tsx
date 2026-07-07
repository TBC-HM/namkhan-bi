// app/revenue/lighthouse/rates/page.tsx
import { LighthouseShell, RATES_COLUMNS } from '../_shared/LighthouseShell';

export const dynamic = 'force-dynamic';

export default function LighthouseRatesPage() {
  return (
    <LighthouseShell
      view="rates"
      title="Lighthouse · Rates"
      subtitle="Grid: per date × per competitor · current published rate or restriction (LOS2/LOS3/Sold out/No flex)"
      columns={RATES_COLUMNS}
    />
  );
}
