// app/guest/page.tsx
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export default function GuestPage() {
  return <DeptEntry cfg={DEPT_CFG.guest} />;
}
