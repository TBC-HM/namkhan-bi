// app/holding/it2/modules/briefs/[slug]/page.tsx
// Bug #83 — brief detail: renders content_md + metadata + status actions.
// goal-editor-v1: added "✎ Refine Goal" button via BriefDetailClient.

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import BriefDetailClient from './BriefDetailClient';

export const dynamic = 'force-dynamic';

type BriefDetail = {
  id: string; slug: string; title: string; content_md: string; status: string;
  version: number; assigned_to: string | null; tags: string[] | null;
  last_updated_at: string | null; shipped_at: string | null;
  shipped_commit: string | null; target_repo: string | null; target_branch: string | null;
};

export default async function BriefDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = getSupabaseAdmin();
  const { data } = await sb.rpc('fn_get_build_brief', { p_slug: slug });
  if (!data) notFound();
  const brief = data as BriefDetail;

  const { data: qRow } = await (sb as any)
    .from('v_build_briefs_index')
    .select('open_question')
    .eq('slug', slug)
    .maybeSingle();
  const openQuestion = (qRow?.open_question ?? null) as
    { question: string; options: { label: string; consequence: string; recommended?: boolean }[] } | null;

  return <BriefDetailClient brief={brief} openQuestion={openQuestion} />;
}
