import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';

export default function BudgetPage() {
  return (
    <Section title="Budget" tag="Awaiting upload schema" greyed greyedReason="Budget tables not yet built. Upload pipeline pending.">
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Annual Revenue Target" value={null} kind="money" greyed />
        <Kpi label="YTD Actual vs Budget" value={null} kind="money" greyed />
        <Kpi label="Forecast EOY" value={null} kind="money" greyed />
        <Kpi label="Target EBITDA Margin" value={null} kind="pct" greyed />
      </div>
      <div className="text-muted text-sm mt-6">
        Monthly budget · v1.x · variance vs actual · forecast vs budget · version history.
        Requires a `budgets` table + monthly upload schema (1-day build).
      </div>
    </Section>
  );
}
