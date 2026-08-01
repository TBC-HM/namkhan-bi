// app/api/cockpit/skills/discover_agent_flows/route.ts
// REASONING AGENT LOOP: Generate -> Score -> Filter -> Persist -> Return
// TS fix: annotated typed as Array<Record<string,unknown>> -- index sig guarantees property access
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk, getVaultSecret } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const CURATED_SOURCES = [
  'anthropics/anthropic-cookbook: official -- tool_use/customer_service_agent, multimodal/using_sub_agents, patterns/agents/',
  'joaomdmoura/crewai: role-based multi-agent orchestration',
  'assafelovic/gpt-researcher: autonomous deep research and web synthesis',
  'microsoft/autogen: conversational multi-agent for analysis and narration',
  'felixbrock/lemon-agent: Plan-Validate-Solve with policy enforcement',
  'cpacker/MemGPT: persistent memory across agent sessions',
  'stepanogil/autonomous-hr-chatbot: tool-using Q&A -- phone/chat handler pattern',
  'ithiria894/awesome-claude-code-workflows (114 stars): hooks + MCP + skills + CLAUDE.md recipes',
  'MuhammadUsmanGM/claude-code-best-practices (67 stars): CLAUDE.md templates, multi-agent patterns',
  'simonwillison.net: parallel agent coding, worktree patterns, Claude Code workflows',
];

const QUALITY_GATE = `Score 1-10 on: hotel_fit, feasibility, uniqueness, effort_vs_value, roi_clarity.
HARD FAIL (score <= 2 on hotel_fit AND feasibility): proposal is fundamentally just LLM answering questions with no tools, pipeline, or structured action. A chatbot with a clever name is still a chatbot.
Deduct 5 on uniqueness if it duplicates an existing skill.
Reward: multi-step reasoning, tool use, structured output, measurable number in ROI.
Penalise: vague ROI, no named data source, output is only unstructured text.
Threshold to PASS: average >= 7.0.`.trim();

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
  const maxProps = Math.min(body.max_proposals ?? 6, 8);

  const sb = getSupabaseAdmin();
  const githubToken = await getVaultSecret('github_token');

  const { data: skills } = await sb.from('cockpit_skills_catalog').select('name,health_status').eq('active', true);
  const existingNames = (skills ?? []).map((s: Record<string, unknown>) => s.name as string).join(', ');
  const failingSkills = (skills ?? []).filter((s: Record<string, unknown>) => s.health_status === 'failing').map((s: Record<string, unknown>) => s.name as string);

  const [ghGeneral, ghAnthropic, ghClaudeMd, redditPosts] = await Promise.all([
    githubToken ? searchGitHub(userRequest + ' agent automation workflow', githubToken) : Promise.resolve([]),
    githubToken ? searchGitHub('anthropics ' + userRequest + ' agent', githubToken) : Promise.resolve([]),
    githubToken ? searchGitHub('CLAUDE.md agent workflow skills stars:>10', githubToken) : Promise.resolve([]),
    searchReddit(userRequest + ' AI agent automation'),
  ]);
  const ghLines = [...ghGeneral, ...ghAnthropic, ...ghClaudeMd].slice(0, 9);
  const rdLines = redditPosts.slice(0, 4);

  const sysGen = [
    'You are an expert AI agent architect. Discover high-value agent automation flows for a 30-room luxury boutique hotel.',
    'Failing skills to replace: ' + (failingSkills.join(', ') || 'none') + '.',
    'Verified sources: ' + CURATED_SOURCES.join('; '),
    'CRITICAL: Output ONLY a valid JSON array starting with [ and ending with ].',
    'Every string value MUST be under 120 characters. No preamble. No markdown. If you cannot comply output: []',
  ].join('\n');

  const usrGen = [
    'Discover: "' + userRequest + '"',
    'GitHub: ' + (ghLines.join(' | ') || 'none'),
    'Reddit: ' + (rdLines.join(' | ') || 'none'),
    'Skip (exist): ' + existingNames,
    'DIVERSITY RULE: Generate ' + (maxProps + 2) + ' proposals covering DIFFERENT aspects.',
    'Do NOT generate multiple variations of the same core concept.',
    'Think: (1) direct answer, (2) upstream/downstream skill, (3) complementary workflow, (4) failing skill replacement.',
    'Flows can come from ANY industry. Every field MAX 120 chars:',
    '[{"type":"NEW|IMPROVE|REPLACE","skill_name":"verb_noun","display_name":"Name","framework":"CrewAI|AutoGen|custom","source_repo":"owner/repo","found_via":"exact source","value":"outcome with number","effort":"Low|Medium|High","roi":"High|Medium|Low","proposal":"2 sentences: what+how","match_pct":85}]',
  ].join('\n');

  const gen = await callAnthropic({ systemPrompt: sysGen, userPrompt: usrGen, maxTokens: 6000 });
  if (!isLlmOk(gen)) return NextResponse.json({ error: 'llm_failed', detail: gen.error, stage: 'generate' }, { status: 502 });

  const rawProps = extractJsonArray(gen.text);
  if (!rawProps || rawProps.length === 0) {
    return NextResponse.json({ error: 'no_proposals', stage: 'json_parse', raw_preview: gen.text.slice(0, 800), hint: 'LLM did not return a parseable JSON array' }, { status: 502 });
  }

  const sysSco = 'You are a strict quality evaluator.\n' + QUALITY_GATE + '\nReturn ONLY a valid JSON array.';
  const usrSco = [
    'Existing skills (uniqueness check): ' + existingNames,
    '[{"index":0,"avg":8.1,"verdict":"PASS","scores":{"hotel_fit":9,"feasibility":8,"uniqueness":8,"effort_vs_value":7,"roi_clarity":8},"reason":"passes chatbot veto: uses CrewAI with real data, structured output"}]',
    'Proposals:',
    rawProps.map((p, i) => i + ': ' + String(p.skill_name) + '\n  ' + String(p.proposal).slice(0, 120) + '\n  value: ' + String(p.value).slice(0, 80)).join('\n'),
  ].join('\n');

  const sco = await callAnthropic({ systemPrompt: sysSco, userPrompt: usrSco, maxTokens: 2500 });

  // annotated as Array<Record<string,unknown>> -- preserves index signature so p.skill_name = unknown (compilable)
  let finalProps: Array<Record<string, unknown>> = rawProps;
  let rejectedProps: Array<{ skill_name: string; display_name?: string; _avg: number; _reason: string }> = [];
  let scoreMeta = { scored: 0, passed: 0, filtered: 0 };

  if (isLlmOk(sco)) {
    const scoreArr = extractJsonArray(sco.text);
    if (scoreArr) {
      scoreMeta.scored = scoreArr.length;
      type ScoreRow = { index: number; avg: number; verdict: string; reason: string; scores: Record<string, number> };
      const scores = scoreArr as ScoreRow[];
      // Array<Record<string,unknown>> preserves index signature -- no type errors on property access
      const annotated: Array<Record<string, unknown>> = rawProps.map((p, i) => {
        const s = scores.find(sc => sc.index === i);
        return { ...p, _avg: s?.avg ?? 5, _verdict: s?.verdict ?? 'UNKNOWN', _reason: s?.reason ?? '', _scores: s?.scores ?? {} };
      });
      finalProps = annotated.filter(p => (p._avg as number) >= 7.0).sort((a, b) => (b._avg as number) - (a._avg as number));
      rejectedProps = annotated
        .filter(p => (p._avg as number) < 7.0)
        .sort((a, b) => (b._avg as number) - (a._avg as number))
        .map(p => ({
          skill_name: String(p.skill_name ?? ''),
          display_name: p.display_name ? String(p.display_name) : undefined,
          _avg: p._avg as number,
          _reason: String(p._reason ?? ''),
        }));
      scoreMeta.passed = finalProps.length;
      scoreMeta.filtered = rejectedProps.length;
    }
  }

  // Persist with agent_handle='all' so future Claude sessions can recall research
  let savedCount = 0;
  for (const p of finalProps) {
    const content = [
      'RESEARCH PROPOSAL (not yet built): ' + String(p.display_name ?? p.skill_name),
      'slug: ' + String(p.skill_name) + ' | framework: ' + String(p.framework ?? 'custom') + ' | type: ' + String(p.type),
      'found_via: ' + String(p.found_via ?? 'n/a') + ' | source: ' + String(p.source_repo ?? 'n/a'),
      'roi: ' + String(p.roi) + ' | effort: ' + String(p.effort) + ' | score: ' + (p._avg as number).toFixed(1),
      '',
      'VALUE: ' + String(p.value),
      'BUILDS: ' + String(p.proposal),
      p._reason ? 'SCORER: ' + String(p._reason) : '',
      'query: ' + userRequest + ' | saved: ' + new Date().toISOString().slice(0, 16),
    ].filter(Boolean).join('\n');
    try {
      await sb.rpc('fn_kb_add_entry', {
        p_content: content,
        p_topics: ['research_proposal', userRequest.toLowerCase().replace(/\W+/g, '_').slice(0, 30), String(p.framework ?? 'custom').toLowerCase()],
        p_memory_type: 'pattern',
        p_agent_handle: 'all',
        p_importance: 2,
      });
      savedCount++;
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    ok: true,
    proposals: finalProps,
    rejected: rejectedProps,
    metadata: {
      user_request: userRequest, generated: rawProps.length,
      passed_quality_gate: scoreMeta.passed, filtered_low_quality: scoreMeta.filtered,
      quality_gate: '7.0/10 avg + hard chatbot veto',
      sources: 'GitHub + Reddit + Anthropic cookbook + CLAUDE.md repos',
      repos_scanned: ghLines.length, reddit_posts: rdLines.length,
      persisted: savedCount > 0, saved_count: savedCount,
    },
  });
}
