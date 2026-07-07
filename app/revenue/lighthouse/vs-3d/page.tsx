// app/revenue/lighthouse/vs-3d/page.tsx
import { LighthouseShell, DELTA_COLUMNS } from '../_shared/LighthouseShell';

export const dynamic = 'force-dynamic';

export default function LighthouseVs3dPage() {
  return (
    <LighthouseShell
      view="three_days"
      title="Lighthouse · vs 3 days ago"
      subtitle="Same grid + 3-day delta — competitor pricing decisions from the last 72h"
      columns={DELTA_COLUMNS}
    />
  );
}
