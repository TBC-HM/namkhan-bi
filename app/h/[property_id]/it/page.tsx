// app/h/[property_id]/it/page.tsx
import ModuleStateGate from '@/components/ModuleStateGate';
import { redirect } from 'next/navigation';

const NAMKHAN_PROPERTY_ID = 260955;

export default function ItShim({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/it');
  return (
    <ModuleStateGate
      moduleCode="platform_required"
      meta={{
        title: 'IT',
        description: 'Tickets, agents, deploys — Captain Kit platform.',
        roadmap: 'Cockpit features being added incrementally.',
      }}
    >
      <div />
    </ModuleStateGate>
  );
}
