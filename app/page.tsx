// app/page.tsx — HOME = Architect entry page (Felix).
// Uses the same DeptEntry component as every other dept; cfg switches the
// HoD voice + chips to the 7 dept landings the architect orchestrates.
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export default function ArchitectHome() {
  return <DeptEntry cfg={DEPT_CFG.architect} />;
}
