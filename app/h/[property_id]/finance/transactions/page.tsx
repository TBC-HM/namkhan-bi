import FinanceStub from '../_stub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaTransactionsStub({ params }: { params: { property_id: string } }) {
  return (
    <FinanceStub
      propertyId={Number(params.property_id)}
      routeLabel="Transactions"
      namkhanPath="/finance/transactions"
      hint="Will surface Donna folio audit + POS once a Donna PMS connector lands (Factorial only covers HR; PMS source TBC)."
    />
  );
}
