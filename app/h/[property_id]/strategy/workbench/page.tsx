// app/h/[property_id]/strategy/workbench/page.tsx
// Brief: strategy_module-owner-findings-v1
// Strategy Workbench: research workspace with hypothesis → validate → decide → track flow

import StrategyWorkbench from '@/components/strategy/StrategyWorkbench';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function StrategyWorkbenchPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <StrategyWorkbench propertyId={propertyId} />
    </div>
  );
}
