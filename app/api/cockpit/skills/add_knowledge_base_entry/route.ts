// app/api/cockpit/skills/add_knowledge_base_entry/route.ts
// Adds a learning to cockpit.kn_agent_memory via SECURITY DEFINER fn_kb_add_entry
// Replaces broken shorthand handler that tried to INSERT into public.cockpit_knowledge_base directly
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    content: string;
    topics?: string[];
    memory_type?: string;
    agent_handle?: string;
    confidence?: number;
    importance?: number;
  };

  const content = (body.content ?? '').trim();
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_kb_add_entry', {
    p_content: content,
    p_topics: body.topics ?? [],
    p_memory_type: body.memory_type ?? 'fact',
    p_agent_handle: body.agent_handle ?? 'all',
    p_confidence: body.confidence ?? 0.9,
    p_importance: body.importance ?? 5,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data });
}
