// app/h/[property_id]/guest/page.tsx
import ModuleStateGate from '@/components/ModuleStateGate';
import { redirect } from 'next/navigation';

const NAMKHAN_PROPERTY_ID = 260955;

export default function GuestShim({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/guest');
  return (
    <ModuleStateGate
      moduleCode="guest_crm"
      meta={{
        title: 'Guest',
        description: 'Directory, reviews, pre-arrival — Guest CRM module.',
        roadmap: 'Planned. Activates after CRM integration.',
      }}
    >
      <div />
    </ModuleStateGate>
  );
}
