// app/api/cockpit/skills/read_knowledge_base/route.ts
// Reads from public.cockpit_knowledge_base (view over cockpit.kn_agent_memory)
// Replaces broken shorthand handler 'read_knowledge_base' that tried to read cockpit schema directly
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { topic?: string; limit?: number };
  const limit = Math.min(body.limit ?? 20, 50);

  const sb = getSupabaseAdmin();
  let q = sb.from('cockpit_knowledge_base')
    .select('id, agent_handle, memory_type, content, topics, confidence, importance, created_at')
    .eq('active', true)
    .order('importance', { ascending: false })
    .limit(limit);

  if (body.topic) {
    q = q.contains('topics', [body.topic]);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, entries: data ?? [], count: (data ?? []).length });
}
