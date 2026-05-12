// app/h/[property_id]/finance/page.tsx
import ModuleStateGate from '@/components/ModuleStateGate';
import { redirect } from 'next/navigation';

const NAMKHAN_PROPERTY_ID = 260955;

export default function FinanceShim({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/finance');
  return (
    <ModuleStateGate
      moduleCode="finance"
      meta={{
        title: 'Finance',
        description: 'P&L, cash, USALI — Intel finance agent.',
        roadmap: 'Activates after QuickBooks integration.',
      }}
    >
      <div />
    </ModuleStateGate>
  );
}
