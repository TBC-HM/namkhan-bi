import DashboardPage from '@/app/(cockpit)/_design/layout/DashboardPage';
import StrategyWorkbench from '@/components/strategy/StrategyWorkbench';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function StrategyWorkbenchPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return (
    <DashboardPage title="Strategy Workbench">
      <div style={{ gridColumn: '1 / -1' }}>
        <StrategyWorkbench propertyId={propertyId} />
      </div>
    </DashboardPage>
  );
}
