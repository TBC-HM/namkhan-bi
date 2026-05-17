import FinanceStub from '../_stub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaLedgerStub({ params }: { params: { property_id: string } }) {
  return (
    <FinanceStub
      propertyId={Number(params.property_id)}
      routeLabel="Ledger"
      namkhanPath="/finance/ledger"
      hint="Will surface Donna AR · deposits · house accounts · bank reconcile per property_id=1000001 once gestoría AR feed lands."
    />
  );
}
