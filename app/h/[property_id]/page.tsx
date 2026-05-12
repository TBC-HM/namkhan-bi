// app/h/[property_id]/page.tsx
// Property home (architect dept-entry). Same content as / pre-routing
// but rendered inside <PropertyProvider> so PropertySwitcher works.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyHome() {
  return <DeptEntry cfg={DEPT_CFG.architect} />;
}
