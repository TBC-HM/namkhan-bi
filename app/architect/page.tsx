// app/architect/page.tsx — keep the dept-style architect entry reachable
// at /architect (parked here from /). The canvas at / is now the single
// surface PBS uses.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export default function ArchitectEntry() {
  return <DeptEntry cfg={DEPT_CFG.architect} />;
}
