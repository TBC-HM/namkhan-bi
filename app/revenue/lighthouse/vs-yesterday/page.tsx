// app/revenue/lighthouse/vs-yesterday/page.tsx
import { LighthouseShell, DELTA_COLUMNS } from '../_shared/LighthouseShell';

export const dynamic = 'force-dynamic';

export default function LighthouseVsYesterdayPage() {
  return (
    <LighthouseShell
      view="yesterday"
      title="Lighthouse · vs Yesterday"
      subtitle="Same grid + delta cell after each rate — highlights same-day price movements across the compset"
      columns={DELTA_COLUMNS}
    />
  );
}
