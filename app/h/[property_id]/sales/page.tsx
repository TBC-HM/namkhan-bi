// app/h/[property_id]/sales/page.tsx
import ModuleStateGate from '@/components/ModuleStateGate';
import { redirect } from 'next/navigation';

const NAMKHAN_PROPERTY_ID = 260955;

export default function SalesShim({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/sales');
  return (
    <ModuleStateGate
      moduleCode="sales"
      meta={{
        title: 'Sales',
        description: 'Inquiries, B2B, group bookings — Mercer sales agent.',
        roadmap: 'Activates after sales pipeline integration.',
      }}
    >
      <div />
    </ModuleStateGate>
  );
}
