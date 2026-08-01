// app/api/cockpit/skills/discover_agent_flows/route.ts
// Scans GitHub for proven agent flow templates — broad + hospitality niche.
// Cross-references against cap_skills catalog to find gaps and improvement opportunities.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk, getVaultSecret, ANTHROPIC_MODEL } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function searchGitHub(query: string, token: string, maxResults = 10) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${maxResults}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json() as { items?: Array<{ full_name: string; description: string | null; stargazers_count: number; topics: string[]; html_url: string }> };
  return (data.items ?? []).map(r => ({
    repo: r.full_name,
    description: r.description ?? '',
    stars: r.stargazers_count,
    topics: r.topics,
    url: r.html_url,
  }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { focus?: string; max_proposals?: number };
  const focus = body.focus ?? 'hospitality';
  const maxProposals = body.max_proposals ?? 10;

  const sb = getSupabaseAdmin();
  const githubToken = await getVaultSecret('github_token');

  // 1. Get current skill catalog (what we have + health)
  const { data: currentSkills } = await sb.from('cockpit_skills_catalog')
    .select('name,description,category,serves_module,health_status,total_all_time,success_all_time,surface')
    .eq('active', true);

  const skillSummary = (currentSkills ?? []).map(s =>
    `${s.name} [${s.serves_module ?? s.category}] health=${s.health_status} runs=${s.total_all_time} success=${s.success_all_time}`
  ).join('\n');

  // 2. Search GitHub — broad agent frameworks + hospitality niche
  const searches = [
    'crewai agent workflow template stars:>100',
    'langchain agent chain business automation stars:>500',
    'autogen multi-agent workflow stars:>200',
    'hotel hospitality AI agent automation',
    'property management revenue analytics AI agent',
    'restaurant hotel booking agent LLM',
    'travel hospitality langchain crewai',
    'financial analytics agent LLM accounting',
    'market research agent web scraping LLM',
    'video production AI pipeline agent',
  ];

  const repoResults: Array<{query: string; repos: Array<{repo:string;description:string;stars:number;url:string}>}> = [];
  for (const q of searches.slice(0, githubToken ? searches.length : 3)) {
    const repos = githubToken ? await searchGitHub(q, githubToken, 3) : [];
    repoResults.push({ query: q, repos });
  }
  const repoSummary = repoResults.map(r =>
    `SEARCH: "${r.query}"\n` + r.repos.map(repo => `  ★${repo.stars} ${repo.repo}: ${repo.description.slice(0,100)}`).join('\n')
  ).join('\n\n');

  // 3. Call Claude to analyze and propose
  const systemPrompt = `You are an AI agent architecture strategist for The Namkhan — a 5-star boutique hotel in Luang Prabang, Laos.
You analyze proven open-source agent workflow templates and recommend which ones to adopt, adapt, or use as reference.
Context: property_id=260955, ~24 rooms, SLH member, departments: Revenue/Marketing/Operations/HR/Finance/Legal/IT.`;

  const userPrompt = `CURRENT SKILLS CATALOG (${(currentSkills ?? []).length} skills):
${skillSummary}

GITHUB SEARCH RESULTS:
${repoSummary || '[GitHub token not available — using training knowledge instead]'}

Analyze and propose ${maxProposals} agent flow improvements. Focus: ${focus}.

For each proposal:
1. Type: NEW (we don't have it) | IMPROVE (we have it but it's weak/failing) | REPLACE (ours is broken, proven one exists)
2. Source: the GitHub repo or framework to use as reference
3. Namkhan fit: why this specific flow matters for a 24-room luxury hotel in Laos
4. Skill name: what we'd call it in cap_skills
5. Effort: Low (<1 day) | Medium (2-3 days) | High (1 week+)
6. Value: immediate impact on operations, revenue, or guest experience
7. Integration: what Namkhan data sources it would connect to (QB, PMS, ICP, media, YouTube)

Prioritize: (1) skills with 0% success rate that proven tools could replace, (2) hospitality-specific flows not in generic frameworks, (3) high-value flows for a luxury boutique hotel.

Return JSON array:
[{"type":"NEW|IMPROVE|REPLACE","skill_name":"slug","display_name":"Human Name","source_repo":"owner/repo or framework","namkhan_fit":"why","effort":"Low|Medium|High","value":"impact description","integration":"data sources","proposal":"what to build"}]`;

  const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 3000 });
  if (!isLlmOk(llm)) return NextResponse.json({ error: llm.error }, { status: 502 });

  const match = llm.text.match(/\[[\s\S]*\]/);
  const proposals = match ? JSON.parse(match[0]) as unknown[] : [];

  return NextResponse.json({
    ok: true,
    proposals,
    current_skill_count: (currentSkills ?? []).length,
    failing_skills: (currentSkills ?? []).filter(s => s.health_status === 'failing').map(s => s.name),
    repos_scanned: repoResults.reduce((s, r) => s + r.repos.length, 0),
    focus,
  });
}
