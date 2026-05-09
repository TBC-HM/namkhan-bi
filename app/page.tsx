// app/page.tsx — HOME = Architect command centre.
// PBS 2026-05-09 (later): rejected the canvas Brief shape on /. Wants the
// architect dept-entry — chat hero + dept chips + my-action-items / my-docs
// / my-tasks containers, weather/date/user pills. The canvas Brief surface
// stays accessible at /canvas.
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export default function Home() {
  return <DeptEntry cfg={DEPT_CFG.architect} />;
}
