// app/api/cockpit/skills/discover_agent_flows/route.ts
// REASONING AGENT LOOP: Generate -> Score -> Filter -> Return
// Two LLM calls: (1) generate proposals, (2) score each for quality.
// Only proposals scoring 7+/10 average pass the filter.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk, getVaultSecret } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

async function searchGitHub(query: string, token: string, max = 5) {
  const url = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(query) + '&sort=stars&order=desc&per_page=' + max;
  const res = await fetch(url, {
    headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' }, cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json() as { items?: Array<{ full_name: string; description: string | null; stargazers_count: number }> };
  return (data.items ?? []).map(r => ({ repo: r.full_name, description: r.description ?? '', stars: r.stargazers_count }));
}

const QUALITY_GATE = `A GOOD proposal (score 7-10): specific skill name, references real Namkhan data (QB/PMS/ICP/media/YouTube), genuinely useful for 24-room Luang Prabang luxury hotel, concrete measurable ROI, does NOT duplicate existing skills, technically feasible.
A BAD proposal (score 1-6): generic, no data integration, duplicates existing skill, vague ROI like "saves time", not feasible.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { focus?: string; prompt?: string; max_proposals?: number };
  const userRequest = body.prompt ?? body.focus ?? 'hospitality agent flows';
  const maxProposals = body.max_proposals ?? 8;

  const sb = getSupabaseAdmin();
  const githubToken = await getVaultSecret('github_token');

  const { data: skills } = await sb.from('cockpit_skills_catalog')
    .select('name,description,serves_module,health_status,total_all_time,success_all_time')
    .eq('active', true);

  const existingNames = (skills ?? []).map((s: Record<string,unknown>) => s.name as string).join(', ');
  const failingList = (skills ?? [])
    .filter((s: Record<string,unknown>) => s.health_status === 'failing')
    .map((s: Record<string,unknown>) => (s.name as string) + '(' + s.success_all_time + '/' + s.total_all_time + ')');

  // Search GitHub
  const searches = [
    userRequest + ' agent LLM workflow',
    'hotel hospitality ' + userRequest + ' AI automation',
    'crewai multi-agent workflow business stars:>500',
    'boutique hotel ' + userRequest + ' python agent',
    'langchain hospitality travel agent template',
  ];
  const repoLines: string[] = [];
  for (const q of searches) {
    if (githubToken) {
      const repos = await searchGitHub(q, githubToken, 3);
      if (repos.length) repoLines.push('"' + q + '": ' + repos.map(r => r.repo + '(star' + r.stars + '): ' + r.description.slice(0,80)).join(' | '));
    }
  }

  // STEP 1: GENERATE
  const sysGen = 'You are an AI agent architect for The Namkhan — 24-room 5-star luxury hotel Luang Prabang Laos (SLH Considerate Collection). Data: QB GL (finance.*), PMS (pms.*), ICP (sales.icp_segments), media (media.*), YouTube (marketing.yt_*). Failing skills needing replacement: ' + (failingList.join(', ') || 'none') + '.';
  const usrGen = 'USER REQUEST: "' + userRequest + '"\n\nGITHUB REFS:\n' + (repoLines.join('\n') || '[use training knowledge]') + '\n\nEXISTING SKILLS (no duplicates): ' + existingNames + '\n\nGenerate ' + (maxProposals + 4) + ' proposals. Each must be a SPECIFIC agent flow, not a generic tool. Return JSON array: [{"type":"NEW|IMPROVE|REPLACE","skill_name":"verb_noun_slug","display_name":"Human Name","source_repo":"owner/repo or framework","namkhan_fit":"WHY this specific 24-room Luang Prabang hotel needs this","effort":"Low|Medium|High","roi":"High|Medium|Low","value":"specific measurable outcome","integration":"exact table/view names from Namkhan DB","proposal":"2-3 sentences what to build","match_pct":70-99}]';

  const gen = await callAnthropic({ systemPrompt: sysGen, userPrompt: usrGen, maxTokens: 3000 });
  if (!isLlmOk(gen)) return NextResponse.json({ error: gen.error }, { status: 502 });

  let rawProps: Array<Record<string,unknown>> = [];
  try { const m = gen.text.match(/\[[\s\S]*\]/); rawProps = m ? JSON.parse(m[0]) : []; } catch { rawProps = []; }
  if (rawProps.length === 0) return NextResponse.json({ error: 'no_proposals', raw: gen.text.slice(0,300) }, { status: 502 });

  // STEP 2: SCORE (reasoning evaluation)
  const sysSco = 'You are a quality evaluator for AI agent proposals. ' + QUALITY_GATE + ' Return ONLY valid JSON.';
  const usrSco = 'Score each proposal 1-10 on: namkhan_fit, feasibility, uniqueness, data_integration, roi_clarity. DEDUCT 5 points on uniqueness if similar to existing skills.\nReturn: [{"index":0,"avg":8.2,"verdict":"PASS","scores":{"namkhan_fit":9,"feasibility":8,"uniqueness":8,"data_integration":8,"roi_clarity":8},"reason":"..."},...]\n\nProposals:\n' + rawProps.map((p, i) => i + ': ' + p.skill_name + ' | fit: ' + p.namkhan_fit + ' | data: ' + p.integration + ' | roi: ' + p.value).join('\n') + '\n\nExisting skills: ' + existingNames;

  const sco = await callAnthropic({ systemPrompt: sysSco, userPrompt: usrSco, maxTokens: 2000 });

  let finalProps = rawProps;
  let scoreMeta = { scored: 0, passed: 0, filtered: 0 };
  if (isLlmOk(sco)) {
    try {
      const sm = sco.text.match(/\[[\s\S]*\]/);
      const scores = sm ? JSON.parse(sm[0]) as Array<{ index: number; avg: number; verdict: string; reason: string; scores: Record<string,number> }> : [];
      scoreMeta.scored = scores.length;
      const annotated = rawProps.map((p, i) => {
        const s = scores.find(sc => sc.index === i);
        return { ...p, _avg: s?.avg ?? 5, _verdict: s?.verdict ?? 'UNKNOWN', _reason: s?.reason ?? '', _scores: s?.scores ?? {} };
      });
      finalProps = annotated.filter(p => (p._avg as number) >= 7).sort((a, b) => (b._avg as number) - (a._avg as number)).slice(0, maxProposals);
      scoreMeta.passed = finalProps.length;
      scoreMeta.filtered = rawProps.length - finalProps.length;
    } catch { /* use raw */ }
  }

  return NextResponse.json({
    ok: true,
    proposals: finalProps,
    metadata: {
      user_request: userRequest,
      generated: rawProps.length,
      passed_quality_gate: scoreMeta.passed,
      filtered_low_quality: scoreMeta.filtered,
      quality_gate: '7/10 average across 5 dimensions',
      current_skill_count: (skills ?? []).length,
      failing_skills: failingList,
      repos_scanned: repoLines.length * 3,
    },
  });
}
