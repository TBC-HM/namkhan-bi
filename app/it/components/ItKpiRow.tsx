// FIX (re PR #51): default-import KpiBox (was named import → TS2614).
// Props renamed to match page.tsx call signature.
import KpiBox from '@/components/kpi/KpiBox';

interface Props {
  ticketsShipped: number;
  kitDoneClean: number | null;
  kitFailureRate: number | null;
  agentCount: number;
  activeCount: number;
}

export default function ItKpiRow({
  ticketsShipped,
  kitDoneClean,
  kitFailureRate,
  agentCount,
  activeCount,
}: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 'var(--space-4)',
      }}
    >
      <KpiBox
        label="Tickets Shipped (week)"
        value={ticketsShipped > 0 ? String(ticketsShipped) : '—'}
      />
      <KpiBox
        label="KIT Done Clean"
        value={kitDoneClean !== null ? String(kitDoneClean) : '—'}
      />
      <KpiBox
        label="KIT Failure Rate"
        value={kitFailureRate !== null ? `${kitFailureRate}%` : '—'}
      />
      <KpiBox
        label="Total Agents"
        value={agentCount > 0 ? String(agentCount) : '—'}
      />
      <KpiBox
        label="Active Agents"
        value={activeCount > 0 ? String(activeCount) : '—'}
      />
    </div>
  );
}
