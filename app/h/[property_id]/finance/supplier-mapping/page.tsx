import FinanceStub from '../_stub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSupplierMappingStub({ params }: { params: { property_id: string } }) {
  return (
    <FinanceStub
      propertyId={Number(params.property_id)}
      routeLabel="Suppliers"
      namkhanPath="/finance/supplier-mapping"
      hint="Donna AP supplier mapping — pending vendor master sync per property_id=1000001."
    />
  );
}
