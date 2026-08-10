// app/h/[property_id]/strategy/decisions/page.tsx
// Brief: strategy-module-slice-close-out (G3)
// Decision Ledger: record decisions with evidence, add retrospectives, filter by outcome/type.

import DecisionLedger from '@/components/strategy/DecisionLedger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DecisionLedgerPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);

  return (
    <div className="min-h-screen bg-gray-50">
      <DecisionLedger propertyId={propertyId} />
    </div>
  );
}
