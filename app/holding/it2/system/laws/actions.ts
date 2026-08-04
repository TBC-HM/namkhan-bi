'use server';
// app/holding/it2/system/laws/actions.ts
// laws-page-v1 — CTA bridge to public.fn_law_propose_change (SECURITY DEFINER,
// service_role only). NO in-place editing of laws ever: 'change' and 'retire'
// both park a law-735 question contract (governance.law_change_proposals) that
// PBS answers in the Decision Inbox; approval runs update-forward / supersede
// in fn_law_proposal_decide. This file deliberately exposes NO edit action.

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const PAGE = '/holding/it2/system/laws';

export interface LawActionResult {
  ok: boolean;
  error?: string;
  proposalId?: number;
}

export async function proposeLawChange(
  lawId: number,
  kind: 'change' | 'retire',
  proposalText: string,
): Promise<LawActionResult> {
  if (!Number.isFinite(lawId) || lawId <= 0) return { ok: false, error: 'Invalid law id' };
  if (kind !== 'change' && kind !== 'retire') return { ok: false, error: 'Invalid kind' };
  if (!proposalText || proposalText.trim().length < 10) {
    return { ok: false, error: kind === 'change'
      ? 'Write the proposed new wording (min 10 chars)'
      : 'Write the reason for retiring this law (min 10 chars)' };
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('fn_law_propose_change', {
    p_law_id: lawId,
    p_kind: kind,
    p_proposal: proposalText.trim(),
    p_asked_by: 'laws-page',
  });
  if (error) return { ok: false, error: error.message };
  if (data && data.ok === false) return { ok: false, error: String(data.error ?? 'proposal refused') };
  revalidatePath(PAGE);
  revalidatePath('/holding/it2/questions');
  return { ok: true, proposalId: data?.proposal_id };
}
