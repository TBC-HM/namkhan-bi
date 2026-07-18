// app/h/[property_id]/settings/rate-plans/page.tsx
// PBS 2026-07-18 · Rate plan hygiene · sibling top-tab.
// Reads public.v_rate_plans_grouped (dedupes 484 rows → ~97 unique plans).
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import RatePlansHygienePanel from '@/components/settings/panels/RatePlansHygienePanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadPlans(propertyId: number) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_rate_plans_grouped')
    .select('*')
    .eq('property_id', propertyId)
    .order('featured_for_proposals', { ascending: false })
    .order('bookings_12m', { ascending: false })
    .order('effective_label', { ascending: true });
  return { rows: (data ?? []) as any[], error };
}

export default async function RatePlansSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const { rows, error } = await loadPlans(propertyId);

  return (
    <DashboardPage
      title="Settings · Rate Plans"
      subtitle={`${rows.length} unique rate plans · toggle which appear in the proposal composer`}
      tabs={[
        { key: 'property',    label: 'Property',    href: `/h/${propertyId}/settings/property`   },
        { key: 'rate_plans',  label: 'Rate Plans',  href: `/h/${propertyId}/settings/rate-plans`, active: true },
        { key: 'media',       label: 'Media',       href: `/h/${propertyId}/settings/media` },
        { key: 'guardrails',  label: 'Guardrails',  href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',        label: 'Data',        href: `/h/${propertyId}/settings/data` },
        { key: 'send_logs',   label: 'Send Logs',   href: `/h/${propertyId}/settings/send-logs`  },
      ]}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Rate Plans" subtitle="Featured plans appear in the proposal composer picker. Hidden plans are permanently suppressed. Details (LoS, deposit, cancel terms) auto-fill the offer card.">
          {error && (
            <div style={{ padding: 16, color: '#C0584C' }}>Load error: {error.message}</div>
          )}
          <RatePlansHygienePanel rows={rows} propertyId={propertyId} />
        </Container>
      </div>
    </DashboardPage>
  );
}
