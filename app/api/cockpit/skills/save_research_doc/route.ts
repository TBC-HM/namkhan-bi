// app/api/cockpit/skills/save_research_doc/route.ts
// Called by DiscoverPanel when user clicks "Download all research"
// Saves a consolidated research summary to cockpit_agent_memory (memory_type=fact, importance=5)
// This is SEPARATE from the per-proposal saves that happen during the discovery run
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    proposals: Array<Record<string, unknown>>;
    user_request?: string;
    run_count?: number;
  };

  const proposals = body.proposals ?? [];
  const userRequest = body.user_request ?? 'discovery';

  if (proposals.length === 0) return NextResponse.json({ ok: false, error: 'no proposals' }, { status: 400 });

  const date = new Date().toISOString().slice(0, 16);
  const content = [
    'RESEARCH SUMMARY: "' + userRequest + '" — ' + date,
    proposals.length + ' proposals across ' + (body.run_count ?? 1) + ' runs',
    '',
    ...proposals.map((p, i) => [
      (i + 1) + '. [' + String(p.type ?? 'NEW') + '] ' + String(p.display_name ?? p.skill_name),
      '   slug: ' + String(p.skill_name) + ' | framework: ' + String(p.framework ?? 'custom') + ' | score: ' + String((p._avg as number)?.toFixed(1) ?? 'n/a'),
      '   value: ' + String(p.value).slice(0, 120),
      '   builds: ' + String(p.proposal).slice(0, 160),
      p.found_via ? '   via: ' + String(p.found_via).slice(0, 80) : '',
      p.source_repo ? '   source: https://github.com/' + String(p.source_repo) : '',
    ].filter(Boolean).join('\n')),
  ].join('\n');

  const sb = getSupabaseAdmin();
  try {
    await sb.rpc('fn_kb_add_entry', {
      p_content: content,
      p_topics: ['research_summary', userRequest.toLowerCase().replace(/\W+/g, '_').slice(0, 40)],
      p_memory_type: 'fact',
      p_agent_handle: 'all',
      p_importance: 5,
    });
    return NextResponse.json({ ok: true, saved: proposals.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
