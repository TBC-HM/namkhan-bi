import FinanceStub from '../_stub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaPosStub({ params }: { params: { property_id: string } }) {
  return (
    <FinanceStub
      propertyId={Number(params.property_id)}
      routeLabel="POS"
      namkhanPath="/finance/pos"
      hint="Donna POS reconciliation — pending Poster/Mews POS feed per property_id=1000001."
    />
  );
}
