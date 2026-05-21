// app/revenue/pickup/page.tsx
// Pickup matrix page — primitives-only chrome. Send + Print actions in the
// DashboardPage action slot; @media print stylesheet strips chrome so the
// matrix prints on A4 without the tab strip or buttons.

import {
  DashboardPage, Container,
  type DashboardTab,
} from '@/app/(cockpit)/_design';
import PickupMatrix from '@/app/(cockpit)/_design/PickupMatrix';
import PickupActions from './_components/PickupActions';
import { getPickupMatrix } from '@/lib/data/pickup';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  propertyId?: number;
}

export default async function PickupPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/pickup'),
  }));

  const data = await getPickupMatrix(pid).catch((e) => {
    console.error('[pickup] getPickupMatrix failed', e);
    return null;
  });

  return (
    <DashboardPage
      title="Revenue · Pickup matrix"
      subtitle={`12-month forward pickup grid · ${data?.property ?? 'Property ' + pid} · capacity ${data?.capacity ?? '—'} rooms`}
      tabs={tabs}
      action={data ? <PickupActions property={data.property} asOfDate={data.asOfDate} /> : undefined}
    >
      <style>{`
        @media print {
          html, body { background: #fff !important; color: #111 !important; }
          nav[role="tablist"], .no-print, .no-print * { display: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>

      <Container
        title="OTB · Pickup · Comparison · SDLY"
        subtitle={data ? `as of ${data.asOfDate} · Today snapshot wired · older snapshots will light up once pms.otb_snapshots ships` : 'data fetch failed'}
        density="compact"
      >
        {data ? (
          <PickupMatrix data={data} />
        ) : (
          <div style={{ padding: 20, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
            Could not build the matrix · check server logs.
          </div>
        )}
      </Container>
    </DashboardPage>
  );
}
