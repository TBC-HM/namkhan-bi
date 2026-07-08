// app/h/[property_id]/guest/page.tsx
// PBS 2026-07-07: Donna Contacts HoD landing. Retires the 2026-05-12 DeptEntry
// scaffold (which dropped the sub-strip). Uses the canonical DashboardPage so
// the Contacts sub-strip renders identically to Namkhan.

import { redirect } from 'next/navigation';
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DonnaContactsHod({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/guest');

  const sb = getSupabaseAdmin();
  // Lightweight KPIs — guest count + reservation count for the property
  const [{ count: guestCount }, { count: resCount }] = await Promise.all([
    sb.from('v_directory').select('*', { count: 'exact', head: true }).eq('property_id', propertyId),
    sb.from('v_reservations_unified').select('*', { count: 'exact', head: true }).eq('property_id', propertyId),
  ]);

  return (
    <DashboardPage title="Contacts" subtitle="Guest directory · prospects · reputation · behaviour · newsletters">
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Contacts overview">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <KpiTile label="Guests in directory" value={guestCount ?? '—'} />
            <KpiTile label="Reservations recorded" value={resCount ?? '—'} />
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: '#5A5A5A' }}>
            Use the sub-tabs above to open <TenantLink href={`/h/${propertyId}/guest/directory`} style={{ color: '#0B3B2E' }}>Guests</TenantLink>,{' '}
            <TenantLink href={`/h/${propertyId}/guest/prospects`} style={{ color: '#0B3B2E' }}>Prospects</TenantLink>,{' '}
            <TenantLink href={`/h/${propertyId}/guest/reputation`} style={{ color: '#0B3B2E' }}>Reputation</TenantLink>,{' '}
            <TenantLink href={`/h/${propertyId}/guest/behaviour`} style={{ color: '#0B3B2E' }}>Behaviour</TenantLink>, or{' '}
            <TenantLink href={`/h/${propertyId}/guest/newsletters`} style={{ color: '#0B3B2E' }}>Newsletters</TenantLink>.
          </p>
        </Container>
      </div>
    </DashboardPage>
  );
}

function KpiTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ padding: 12, border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: '#5A5A5A', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1B1B1B', marginTop: 4 }}>
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
    </div>
  );
}
