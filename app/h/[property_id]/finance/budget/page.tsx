import FinanceStub from '../_stub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaBudgetStub({ params }: { params: { property_id: string } }) {
  return (
    <FinanceStub
      propertyId={Number(params.property_id)}
      routeLabel="Budget"
      namkhanPath="/finance/budget"
      hint="Donna FY2026 budget — pending plan.lines upload per property_id=1000001."
    />
  );
}
