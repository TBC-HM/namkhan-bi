// app/revenue/lighthouse/vs-7d/page.tsx
import { LighthouseShell, DELTA_COLUMNS } from '../_shared/LighthouseShell';

export const dynamic = 'force-dynamic';

export default function LighthouseVs7dPage() {
  return (
    <LighthouseShell
      view="seven_days"
      title="Lighthouse · vs 7 days ago"
      subtitle="Same grid + 7-day delta — spot week-over-week pricing trends"
      columns={DELTA_COLUMNS}
    />
  );
}
