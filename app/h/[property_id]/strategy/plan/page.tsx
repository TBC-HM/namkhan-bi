// app/h/[property_id]/strategy/plan/page.tsx
// Brief: strategy_module-owner-findings-v1
// Business Plan Canvas: living TBC business plan with version history

import BusinessPlanCanvas from '@/components/strategy/BusinessPlanCanvas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BusinessPlanPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <BusinessPlanCanvas propertyId={propertyId} />
    </div>
  );
}
