// FIX (re PR #51): was `import { KpiBox } from '@/components/kpi/KpiBox'` — named import fails.
// KpiBox is a default export. Corrected to default-import syntax.
import KpiBox from '@/components/kpi/KpiBox';

interface Props {
  activeAgents: number;
  ticketsShipped24h: number;
  costUsd24h: number;
  kitDoneClean: number | null;
  kitFailureRate: number | null;
}

export default function ItKpiRow({
  activeAgents,
  ticketsShipped24h,
  costUsd24h,
  kitDoneClean,
  kitFailureRate,
}: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 'var(--space-4)',
      }}
    >
      <KpiBox label="Agents Online" value={String(activeAgents)} />
      <KpiBox label="Tickets Shipped 24h" value={String(ticketsShipped24h)} />
      <KpiBox label="Cost 24h" value={`$${costUsd24h.toFixed(2)}`} />
      <KpiBox
        label="KIT Done Clean"
        value={kitDoneClean !== null ? String(kitDoneClean) : '—'}
      />
      <KpiBox
        label="KIT Failure Rate"
        value={kitFailureRate !== null ? `${kitFailureRate}%` : '—'}
      />
    </div>
  );
}
