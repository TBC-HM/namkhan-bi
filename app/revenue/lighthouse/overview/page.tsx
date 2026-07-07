// app/revenue/lighthouse/overview/page.tsx
import { LighthouseShell, OVERVIEW_COLUMNS } from '../_shared/LighthouseShell';

export const dynamic = 'force-dynamic';

export default function LighthouseOverviewPage() {
  return (
    <LighthouseShell
      view="overview"
      title="Lighthouse · Overview"
      subtitle="Per-date summary — own flex rate · median compset · rank · my OTB · market demand · ranking · holidays · events"
      columns={OVERVIEW_COLUMNS}
    />
  );
}
