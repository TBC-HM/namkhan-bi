import { redirect, notFound } from 'next/navigation';
import DashboardPage from '@/app/(cockpit)/_design/layout/DashboardPage';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MenusByProperty({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  if (pid === NAMKHAN_PROPERTY_ID) redirect('/operations/menus');
  return (
    <DashboardPage title="Menus">
      <div style={{ padding: '16px 20px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
        Menu Studio is live for The Namkhan. This property’s menus are queued.
      </div>
    </DashboardPage>
  );
}
