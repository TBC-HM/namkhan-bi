import DashboardPage from '@/app/(cockpit)/_design/layout/DashboardPage';
import DecisionLedger from '@/components/strategy/DecisionLedger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DecisionLedgerPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return (
    <DashboardPage title="Decision Ledger">
      <div style={{ gridColumn: '1 / -1' }}>
        <DecisionLedger propertyId={propertyId} />
      </div>
    </DashboardPage>
  );
}
