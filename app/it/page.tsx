// app/it/page.tsx
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export default function ITPage() {
  return <DeptEntry cfg={DEPT_CFG.it} />;
}
