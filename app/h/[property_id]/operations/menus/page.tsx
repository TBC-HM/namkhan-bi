// app/h/[property_id]/operations/menus/page.tsx
// ADR-156 Menu Studio — property-scoped entry. Namkhan redirects to the legacy editor.
import { redirect, notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MenusByProperty({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  if (pid === NAMKHAN_PROPERTY_ID) redirect('/operations/menus');
  return (
    <Page eyebrow={'Operations · Menus · property_id=' + pid} title="Menus" subPages={OPERATIONS_SUBPAGES}>
      <Panel title="Menus · coming soon" eyebrow="empty" expandable={false}>
        <div style={{ padding: 20, fontSize: 14, color: '#667' }}>Menu Studio is live for The Namkhan. This property&rsquo;s menus are queued.</div>
      </Panel>
    </Page>
  );
}
