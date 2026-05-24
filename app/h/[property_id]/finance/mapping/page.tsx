import FinanceStub from '../_stub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMappingStub({ params }: { params: { property_id: string } }) {
  return (
    <FinanceStub
      propertyId={Number(params.property_id)}
      routeLabel="Mapping"
      namkhanPath="/finance/mapping"
      hint="Donna USALI account mapping — pending coa.account_mapping per property_id=1000001."
    />
  );
}
