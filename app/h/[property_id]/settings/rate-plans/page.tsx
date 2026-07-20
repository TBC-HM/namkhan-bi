// app/h/[property_id]/settings/rate-plans/page.tsx
// PBS 2026-07-20 · Rate Plans promoted from an Accommodation sub-tab
// (inside Property Settings) to its own top-level Settings page,
// positioned between Media and Guardrails.
import { createClient } from '@/lib/supabase/server';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import RatePlansHygienePanel from '@/components/settings/panels/RatePlansHygienePanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getRatePlans(propertyId: number) {
  const supabase = createClient();
  const { data } = await supabase.from('v_rate_plans_grouped')
    .select('*')
    .eq('property_id', propertyId)
    .order('featured_for_proposals', { ascending: false })
    .order('bookings_12m', { ascending: false })
    .order('effective_label', { ascending: true });
  return (data ?? []) as any[];
}

export default async function RatePlansSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const rows = await getRatePlans(propertyId);
  return (
    <DashboardPage
      title="Settings · Rate Plans"
      subtitle={`${rows.length} plans · feature toggle · LoS · deposit · cancel · payment terms · property ${propertyId}`}
      tabs={[
        { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
        { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media` },
        { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans`, active: true },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
        { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
      ]}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Rate plan hygiene" subtitle="feature which plans appear in the composer · deposit · cancellation · payment terms">
          <RatePlansHygienePanel rows={rows} propertyId={propertyId} />
        </Container>
      </div>
    </DashboardPage>
  );
}