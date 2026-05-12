// app/h/[property_id]/marketing/page.tsx
import ModuleStateGate from '@/components/ModuleStateGate';
import { redirect } from 'next/navigation';

const NAMKHAN_PROPERTY_ID = 260955;

export default function MarketingShim({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/marketing');
  return (
    <ModuleStateGate
      moduleCode="marketing"
      meta={{
        title: 'Marketing',
        description: 'Reach, campaigns, social, reviews — Lumen marketing agent.',
        roadmap: 'Activates after channel integrations.',
      }}
    >
      <div />
    </ModuleStateGate>
  );
}
