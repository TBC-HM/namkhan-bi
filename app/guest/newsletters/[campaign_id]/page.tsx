// app/guest/newsletters/[campaign_id]/page.tsx
// PBS 2026-07-03: view + edit a saved campaign (draft or scheduled).

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import CampaignEditor from './_components/CampaignEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { campaign_id: string }; }

export default async function CampaignEditPage({ params }: Props) {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('guest').from('campaigns')
    .select('*').eq('campaign_id', params.campaign_id).maybeSingle();
  if (!data) notFound();
  if ((data as any).property_id !== PROPERTY_ID) notFound();
  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh', padding:'24px 32px' }}>
      <CampaignEditor initial={data as any} />
    </div>
  );
}
