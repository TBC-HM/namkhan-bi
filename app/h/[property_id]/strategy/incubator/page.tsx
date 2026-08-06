// app/h/[property_id]/strategy/incubator/page.tsx
// Brief: strategy_module-owner-findings-v1
// Module Incubator: positive research → new module spec + brief workflow

import ModuleIncubator from '@/components/strategy/ModuleIncubator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ModuleIncubatorPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <ModuleIncubator propertyId={propertyId} />
    </div>
  );
}
