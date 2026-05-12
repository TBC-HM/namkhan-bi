// app/h/[property_id]/page.tsx
// v2: Namkhan renders DeptEntry directly (no redirect loop with middleware).
// Other properties get ModuleStateGate placeholder.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';
import ModuleStateGate from '@/components/ModuleStateGate';

const NAMKHAN_PROPERTY_ID = 260955;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyHome({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) {
    return <DeptEntry cfg={DEPT_CFG.architect} />;
  }
  return (
    <ModuleStateGate
      moduleCode="platform_required"
      meta={{
        title: 'Welcome',
        description: 'This is where the Felix overview dashboard will live.',
        roadmap: 'Active when daily ops data flows.',
      }}
    >
      <div />
    </ModuleStateGate>
  );
}
