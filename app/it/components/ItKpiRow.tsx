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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
      <KpiBox label="Agents Online" value={String(activeAgents)} />
      <KpiBox label="Tickets Shipped (24h)" value={String(ticketsShipped24h)} />
      <KpiBox label="Cost (24h)" value={`$${costUsd24h.toFixed(2)}`} />
      <KpiBox label="Kit Done Clean" value={kitDoneClean !== null ? String(kitDoneClean) : '—'} />
      <KpiBox label="Kit Failure Rate" value={kitFailureRate !== null ? `${kitFailureRate}%` : '—'} />
    </div>
  );
}
