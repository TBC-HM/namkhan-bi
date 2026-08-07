// app/api/specs/intake/route.ts — level-2 tenant intake actions.
// Spec: cockpit.prototype_specs slug='intake-v2-single-surface'. ADR-260/262.
//
// ONE route, one action switch — deliberately not five route files. Every action is a
// thin call to a SECURITY DEFINER function; all rules (freeze gate, reason-required,
// jargon guard, law 735 shape) live in SQL so they cannot be bypassed by another caller.
//
//   dismiss  -> fn_intake_dismiss   reason REQUIRED, deletes nothing
//   revive   -> fn_intake_revive    restores at the completeness it had
//   approve  -> fn_intake_approve   refuses below 100%, then freezes and writes the brief
//   answer   -> fn_intake_answer    writes into the column completeness reads
//   goals    -> fn_tenant_goals     tenant goals ONLY, never holding goals

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Body = {
  action?: 'dismiss' | 'revive' | 'approve' | 'answer' | 'goals';
  slug?: string;
  reason?: string;
  answer?: string;
  property_id?: number;
  actor?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const { action, slug, reason, answer, property_id } = body;
  const actor = body.actor || 'pbs';

  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });

  const sb = getSupabaseAdmin();

  try {
    if (action === 'goals') {
      if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
      const { data, error } = await sb.rpc('fn_tenant_goals', { p_property_id: property_id });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, goals: data ?? [] });
    }

    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

    if (action === 'dismiss') {
      if (!reason?.trim()) {
        return NextResponse.json(
          { error: 'A reason is required. Dropping something without saying why teaches nothing.' },
          { status: 400 },
        );
      }
      const { data, error } = await sb.rpc('fn_intake_dismiss', { p_slug: slug, p_reason: reason, p_actor: actor });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const r = data as { ok?: boolean; error?: string };
      return NextResponse.json(r, { status: r?.ok ? 200 : 400 });
    }

    if (action === 'revive') {
      const { data, error } = await sb.rpc('fn_intake_revive', { p_slug: slug, p_actor: actor });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const r = data as { ok?: boolean };
      return NextResponse.json(r, { status: r?.ok ? 200 : 400 });
    }

    if (action === 'approve') {
      // The gate lives in SQL: fn_intake_approve refuses unless fn_intake_completeness
      // reports ready. A disabled button is a courtesy, not a control.
      const { data, error } = await sb.rpc('fn_intake_approve', { p_slug: slug, p_actor: actor });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const r = data as { ok?: boolean };
      return NextResponse.json(r, { status: r?.ok ? 200 : 400 });
    }

    if (action === 'answer') {
      if (!answer?.trim()) return NextResponse.json({ error: 'answer is empty' }, { status: 400 });
      const { data, error } = await sb.rpc('fn_intake_answer', { p_slug: slug, p_answer: answer, p_actor: actor });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const r = data as { ok?: boolean };
      return NextResponse.json(r, { status: r?.ok ? 200 : 400 });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unexpected error' },
      { status: 500 },
    );
  }
}
