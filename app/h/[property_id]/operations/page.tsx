// app/h/[property_id]/operations/page.tsx
import ModuleStateGate from '@/components/ModuleStateGate';
import { redirect } from 'next/navigation';

const NAMKHAN_PROPERTY_ID = 260955;

export default function OperationsShim({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations');
  return (
    <ModuleStateGate
      moduleCode="operations"
      meta={{
        title: 'Operations',
        description: 'Today, F&B, spa, maintenance — Forge ops agent.',
        roadmap: 'Activates after daily ops integration.',
      }}
    >
      <div />
    </ModuleStateGate>
  );
}
