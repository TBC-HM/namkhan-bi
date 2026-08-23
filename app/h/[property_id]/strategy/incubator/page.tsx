import DashboardPage from '@/app/(cockpit)/_design/layout/DashboardPage';
import ModuleIncubator from '@/components/strategy/ModuleIncubator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ModuleIncubatorPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return (
    <DashboardPage title="Module Incubator">
      <div style={{ gridColumn: '1 / -1' }}>
        <ModuleIncubator propertyId={propertyId} />
      </div>
    </DashboardPage>
  );
}
