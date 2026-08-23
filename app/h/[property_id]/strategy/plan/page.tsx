import DashboardPage from '@/app/(cockpit)/_design/layout/DashboardPage';
import BusinessPlanCanvas from '@/components/strategy/BusinessPlanCanvas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BusinessPlanPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return (
    <DashboardPage title="Business Plan">
      <div style={{ gridColumn: '1 / -1' }}>
        <BusinessPlanCanvas propertyId={propertyId} />
      </div>
    </DashboardPage>
  );
}
