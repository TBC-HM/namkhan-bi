// app/h/[property_id]/revenue/page.tsx
import ModuleStateGate from '@/components/ModuleStateGate';
import { redirect } from 'next/navigation';

const NAMKHAN_PROPERTY_ID = 260955;

export default function RevenueShim({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/revenue');
  return (
    <ModuleStateGate
      moduleCode="revenue"
      meta={{
        title: 'Revenue',
        description: 'Pulse, pacing, and channel performance — Vector revenue agent.',
        roadmap: 'Activates after PMS sync (Mews) goes live.',
      }}
    >
      <div />
    </ModuleStateGate>
  );
}
