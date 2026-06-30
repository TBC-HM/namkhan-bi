// app/sales/b2b/partner/[id]/page.tsx
// PBS 2026-06-29: this drill-down was merged into /revenue/channels/[source].
// One page now renders both the channel performance AND the DMC contract
// commercial panel inline. This route resolves the contract → finds the
// partner_short_name → redirects.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDmcContract } from '@/lib/dmc';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function PartnerDrilldownPage({ params }: { params: { id: string } }) {
  const c = await getDmcContract(params.id);

  if (!c) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
        Contract not found. <Link href="/sales/b2b" style={{ color: 'var(--brass)' }}>← Back to B2B/DMC</Link>
      </div>
    );
  }

  // The channel landing absorbs all commercial details. Slug = partner_short_name.
  // If no PMS source has booked under that name, the no-meta branch still renders
  // the DMC contract panel — so the redirect always lands somewhere useful.
  redirect(`/revenue/channels/${encodeURIComponent(c.partner_short_name)}`);
}
