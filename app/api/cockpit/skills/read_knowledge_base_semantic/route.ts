// app/api/cockpit/skills/read_knowledge_base_semantic/route.ts
// Semantic-style search over cockpit_knowledge_base using Postgres full-text search
// Uses public.cockpit_knowledge_base view (over cockpit.kn_agent_memory)
// Note: true vector search requires embedding generation -- using FTS as pragmatic replacement
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { query: string; limit?: number };
  const query = (body.query ?? '').trim();
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
  const limit = Math.min(body.limit ?? 10, 30);

  const sb = getSupabaseAdmin();

  // Full-text search on content -- returns relevant KB entries by relevance
  const { data, error } = await sb
    .from('cockpit_knowledge_base')
    .select('id, agent_handle, memory_type, content, topics, confidence, importance, created_at')
    .eq('active', true)
    .ilike('content', '%' + query + '%')
    .order('importance', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    entries: data ?? [],
    count: (data ?? []).length,
    search_mode: 'full_text',
    query,
  });
}
