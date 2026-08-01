// app/api/cockpit/skills/discover_agent_flows/route.ts
// REASONING AGENT LOOP: Generate -> Score -> Filter -> Persist individually -> Return
// Fix: memory_type='pattern' (allowed), save each proposal individually, accurate persisted flag
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk, getVaultSecret } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const CURATED_SOURCES = [
  'anthropics/anthropic-cookbook: official agent patterns -- tool_use/customer_service_agent, multimodal/using_sub_agents, patterns/agents/, managed_agents/',
  'joaomdmoura/crewai: role-based multi-agent orchestration, sequential workflows',
  'assafelovic/gpt-researcher: autonomous deep research, web + source synthesis',
  'microsoft/autogen: conversational multi-agent, report narration and data analysis',
  'felixbrock/lemon-agent: Plan-Validate-Solve with policy enforcement',
  'cpacker/MemGPT: persistent memory across agent sessions',
  'stepanogil/autonomous-hr-chatbot: tool-using Q&A -- template for phone/chat bots',
  'ithiria894/awesome-claude-code-workflows (114 stars): hooks + MCP + skills + CLAUDE.md workflow recipes',
  'MuhammadUsmanGM/claude-code-best-practices (67 stars): CLAUDE.md templates, multi-agent patterns under 150 lines',
  'runtimenoteslabs/cc-rig (32 stars): project generator with CLAUDE.md + agents auto-configured',
  'simonwillison.net: parallel agent coding, worktree patterns, agentic search, Claude Code workflows',
];

const QUALITY_GATE = 'PASS (7-10): clear value for small hotel team, technically feasible, measurable time/revenue impact, novel vs existing. FAIL (1-6): pure chatbot, vague outcome, duplicates existing, unavailable infrastructure.';

function extractJsonArray(text: string): Array<Record<string, unknown>> | null {
  let pos = 0;
  while ((pos = text.indexOf('[', pos)) !== -1) {
    let depth = 0; let inStr = false; let esc = false; let end = -1;
    for (let i = pos; i < text.length; i++) {
      const c = text[i];
      if (esc) { esc = false; continue; }
      if (c === '\\' && inStr) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '[') depth++;
      if (c === ']') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      try {
        const parsed = JSON.parse(text.slice(pos, end + 1));
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as Array<Record<string, unknown>>;
      } catch { /* try next */ }
    }
    pos++;
  }
  return null;
}

async function searchGitHub(query: string, token: string): Promise<string[]> {
  try {
    const url = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(query) + '&sort=stars&order=desc&per_page=3';
    const res = await fetch(url, { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' }, cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json() as { items?: Array<{ full_name: string; description: string | null; stargazers_count: number }> };
    return (data.items ?? []).map(r => r.full_name + '(star' + r.stargazers_count + ') -- ' + (r.description ?? '').slice(0, 65));
  } catch { return []; }
}

async function searchReddit(query: string): Promise<string[]> {
  try {
    const url = 'https://www.reddit.com/search.json?q=' + encodeURIComponent(query) + '&sort=relevance&t=year&limit=5';
    const res = await fetch(url, { headers: { 'User-Agent': 'namkhan-discover-bot/1.0' }, cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json() as { data?: { children?: Array<{ data: { title: string; subreddit: string; score: number } }> } };
    return (data.data?.children ?? []).map(p => 'r/' + p.data.subreddit + ': ' + p.data.title.slice(0, 80));
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { focus?: string; prompt?: string; max_proposals?: number };
  const userRequest = (body.prompt ?? body.focus ?? 'luxury hotel automation').trim();
  const maxProps = Math.min(body.max_proposals ?? 6, 6);

  const sb = getSupabaseAdmin();
  const githubToken = await getVaultSecret('github_token');

  const { data: skills } = await sb.from('cockpit_skills_catalog').select('name,health_status').eq('active', true);
  const existingNames = (skills ?? []).map((s: Record<string, unknown>) => s.name as string).join(', ');
  const failingSkills = (skills ?? []).filter((s: Record<string, unknown>) => s.health_status === 'failing').map((s: Record<string, unknown>) => s.name as string);

  const [ghGeneral, ghAnthropic, ghClaudeMd, redditPosts] = await Promise.all([
    githubToken ? searchGitHub(userRequest + ' agent automation LLM workflow', githubToken) : Promise.resolve([]),
    githubToken ? searchGitHub('anthropics ' + userRequest + ' agent', githubToken) : Promise.resolve([]),
    githubToken ? searchGitHub('CLAUDE.md agent workflow skills stars:>10', githubToken) : Promise.resolve([]),
    searchReddit(userRequest + ' AI agent automation'),
  ]);
  const ghLines = [...ghGeneral, ...ghAnthropic, ...ghClaudeMd].slice(0, 9);
  const rdLines = redditPosts.slice(0, 4);

  const sysGen = [
    'You are an expert AI agent architect. Discover high-value agent automation flows for hospitality.',
    'Context: 30-room luxury boutique hotel, small team (8-12 staff), systems: PMS, GL accounting, CRM, YouTube, email.',
    'Failing skills to replace: ' + (failingSkills.join(', ') || 'none') + '.',
    'Verified sources: ' + CURATED_SOURCES.join('; '),
    'CRITICAL: Output ONLY a valid JSON array starting with [ and ending with ].',
    'Every string value MUST be under 120 characters. No preamble. No markdown.',
    'If you cannot comply output: []',
  ].join('\n');

  const usrGen = [
    'Discover flows for: "' + userRequest + '"',
    'GitHub: ' + (ghLines.length ? ghLines.join(' | ') : 'none'),
    'Reddit: ' + (rdLines.length ? rdLines.join(' | ') : 'none'),
    'Skip (already built): ' + existingNames,
    'Flows can come from ANY industry -- legal, finance, content, HR. If adaptable for a 30-room hotel, include it.',
    'Prioritise: Anthropic cookbook patterns, CLAUDE.md workflow repos, proven multi-agent frameworks.',
    'Generate exactly ' + maxProps + ' proposals. Every field MAX 120 chars:',
    '[{"type":"NEW|IMPROVE|REPLACE","skill_name":"verb_noun_slug","display_name":"Human Name","framework":"CrewAI|AutoGen|custom","source_repo":"owner/repo","value":"specific outcome e.g. saves 3h/week","effort":"Low|Medium|High","roi":"High|Medium|Low","proposal":"2 sentences: what to build and how","match_pct":85}]',
  ].join('\n');

  const gen = await callAnthropic({ systemPrompt: sysGen, userPrompt: usrGen, maxTokens: 6000 });
  if (!isLlmOk(gen)) return NextResponse.json({ error: 'llm_failed', detail: gen.error, stage: 'generate' }, { status: 502 });

  const rawProps = extractJsonArray(gen.text);
  if (!rawProps || rawProps.length === 0) {
    return NextResponse.json({ error: 'no_proposals', stage: 'json_parse', raw_preview: gen.text.slice(0, 800), hint: 'LLM did not return a parseable JSON array' }, { status: 502 });
  }

  const sysSco = 'Score AI agent proposals for a small luxury hotel. ' + QUALITY_GATE + ' Return ONLY valid JSON array.';
  const usrSco = [
    'Score each 1-10: hotel_fit, feasibility, uniqueness, effort_vs_value, roi_clarity.',
    'Deduct 5 on uniqueness if duplicates existing: ' + existingNames,
    '[{"index":0,"avg":8.2,"verdict":"PASS","scores":{"hotel_fit":9,"feasibility":8,"uniqueness":8,"effort_vs_value":8,"roi_clarity":8},"reason":"brief"}]',
    'Proposals:',
    rawProps.map((p, i) => i + ': ' + p.skill_name + ' | ' + String(p.proposal).slice(0, 100) + ' | ' + p.value).join('\n'),
  ].join('\n');

  const sco = await callAnthropic({ systemPrompt: sysSco, userPrompt: usrSco, maxTokens: 2000 });
  let finalProps = rawProps;
  let scoreMeta = { scored: 0, passed: 0, filtered: 0 };
  if (isLlmOk(sco)) {
    const scoreArr = extractJsonArray(sco.text);
    if (scoreArr) {
      scoreMeta.scored = scoreArr.length;
      type ScoreRow = { index: number; avg: number; verdict: string; reason: string; scores: Record<string, number> };
      const annotated = rawProps.map((p, i) => {
        const s = (scoreArr as ScoreRow[]).find(sc => sc.index === i);
        return { ...p, _avg: s?.avg ?? 5, _verdict: s?.verdict ?? 'UNKNOWN', _reason: s?.reason ?? '', _scores: s?.scores ?? {} };
      });
      finalProps = annotated.filter(p => (p._avg as number) >= 7).sort((a, b) => (b._avg as number) - (a._avg as number));
      scoreMeta.passed = finalProps.length;
      scoreMeta.filtered = rawProps.length - finalProps.length;
    }
  }

  // Save each proposal individually as memory_type='pattern' (allowed enum value)
  // agent_handle='pbs_research' keeps them separate from agent-readable memory
  let savedCount = 0;
  for (const p of finalProps) {
    const content = [
      'AGENT FLOW PROPOSAL: ' + String(p.display_name ?? p.skill_name),
      'slug: ' + String(p.skill_name) + ' | type: ' + String(p.type) + ' | framework: ' + String(p.framework ?? 'custom'),
      'source: ' + String(p.source_repo ?? 'n/a') + ' | roi: ' + String(p.roi) + ' | effort: ' + String(p.effort),
      'score: ' + String((p._avg as number)?.toFixed(1) ?? 'n/a'),
      '',
      'VALUE: ' + String(p.value),
      '',
      'WHAT IT BUILDS: ' + String(p.proposal),
      p._reason ? 'SCORER: ' + String(p._reason) : '',
      '',
      'query: ' + userRequest + ' | saved: ' + new Date().toISOString().slice(0, 16),
    ].filter(Boolean).join('\n');

    try {
      await sb.rpc('fn_kb_add_entry', {
        p_content: content,
        p_topics: ['discovery', userRequest.toLowerCase().replace(/\W+/g, '_').slice(0, 30), String(p.framework ?? 'custom').toLowerCase(), 'agent_flow'],
        p_memory_type: 'pattern',
        p_agent_handle: 'pbs_research',
        p_importance: 3,
      });
      savedCount++;
    } catch { /* non-fatal -- continue saving others */ }
  }

  return NextResponse.json({
    ok: true, proposals: finalProps,
    metadata: {
      user_request: userRequest, generated: rawProps.length,
      passed_quality_gate: scoreMeta.passed, filtered_low_quality: scoreMeta.filtered,
      sources: 'GitHub + Reddit + Anthropic cookbook + CLAUDE.md repos',
      repos_scanned: ghLines.length, reddit_posts: rdLines.length,
      persisted: savedCount > 0, saved_count: savedCount,
    },
  });
}
