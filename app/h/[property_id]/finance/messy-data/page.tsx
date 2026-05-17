import FinanceStub from '../_stub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMessyDataStub({ params }: { params: { property_id: string } }) {
  return (
    <FinanceStub
      propertyId={Number(params.property_id)}
      routeLabel="Messy data"
      namkhanPath="/finance/messy-data"
      hint="Will surface Donna's data-quality gaps (Factorial mapping holes, supplier/account mapping for the Spanish gestoría chart of accounts, unpaid bills aging) once the audit views are property-scoped."
    />
  );
}
