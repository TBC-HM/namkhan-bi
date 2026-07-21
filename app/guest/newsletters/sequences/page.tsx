// app/guest/newsletters/sequences/page.tsx
// PBS 2026-07-21: sequences list moved here from /marketing/prospects/sequences.
// Renders as the "Sequences" sub-tab of Guest · Newsletters. Old URL still
// resolves via 307 redirect. Body imported from the original location so both
// paths render identical UI (no code duplication).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import type { DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../_subpages';
import SequencesBody, { type SequenceRow } from '@/app/marketing/prospects/sequences/_components/SequencesBody';
import NewslettersSubStrip from '../_components/NewslettersSubStrip';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

interface PageProps { propertyId?: number }

export default async function GuestNewsletterSequencesPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_marketing_funnels')
    .select('*')
    .eq('property_id', pid)
    .order('updated_at', { ascending: false });

  const rows: SequenceRow[] = (data as SequenceRow[]) ?? [];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  return (
    <SequencesBody
      title="Contacts · Newsletters · Sequences"
      subtitle={`${rows.length} sequence${rows.length===1?'':'s'} — email nurture for never-stayed leads.`}
      tabs={tabs}
      rows={rows}
      error={error ?? null}
      backHref="/guest/newsletters"
      backLabel="Back to newsletters"
      subStrip={<NewslettersSubStrip active="sequences" />}
    />
  );
}
