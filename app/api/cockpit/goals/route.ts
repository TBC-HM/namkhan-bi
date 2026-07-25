// app/api/cockpit/goals/route.ts
// Goal registry write path (service role via SECURITY DEFINER bridge fns, claude_md 0.5):
// POST { action: 'ratify', goal_id }                       -> public.fn_goal_ratify
// POST { action: 'intake', items: [{block,question,answer}] } -> public.fn_goal_intake_save

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const sb = getSupabaseAdmin();

  if (body.action === 'ratify') {
    const goalId = Number(body.goal_id);
    if (!goalId) return NextResponse.json({ error: 'goal_id required' }, { status: 400 });
    const { error } = await sb.rpc('fn_goal_ratify', { p_goal_id: goalId, p_by: 'PBS (cockpit)' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'intake') {
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ error: 'items required' }, { status: 400 });
    for (const it of items) {
      if (!it || typeof it.block !== 'string' || typeof it.question !== 'string') continue;
      const { error } = await sb.rpc('fn_goal_intake_save', {
        p_block: it.block, p_question: it.question, p_answer: String(it.answer ?? ''),
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, saved: items.length });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
