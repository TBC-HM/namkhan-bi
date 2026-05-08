// app/operations/page.tsx
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export default function OperationsPage() {
  return <DeptEntry cfg={DEPT_CFG.operations} />;
}
