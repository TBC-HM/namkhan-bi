// app/api/cockpit/skills/discover_agent_flows/route.ts
// REASONING AGENT LOOP: Generate -> Score -> Filter -> Return
// Bug fix: robust JSON extraction (depth-counting, not greedy regex)
// Persistence: passing proposals saved to cockpit.kn_agent_memory (memory_type=research_discovery)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk, getVaultSecret } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const CURATED_FRAMEWORKS = [
  { name: 'CrewAI', repo: 'joaomdmoura/crewai', use_case: 'Multi-agent role orchestration -- retreat proposal, guest email, ICP research teams' },
  { name: 'GPT Researcher', repo: 'assafelovic/gpt-researcher', use_case: 'Deep research agent -- market digest, competitor intel, ICP profiling' },
  { name: 'AutoGen', repo: 'microsoft/autogen', use_case: 'Conversational multi-agent -- financial narration, HOD reports' },
  { name: 'Lemon Agent', repo: 'felixbrock/lemon-agent', use_case: 'Plan-Validate-Solve -- guest email policy gates, retreat proposals' },
  { name: 'MemGPT', repo: 'cpacker/MemGPT', use_case: 'Persistent memory -- replacement for cockpit_knowledge_base' },
  { name: 'BabyAGI', repo: 'yoheinakajima/babyagi', use_case: 'Sequential task decomposition -- booking pipelines, onboarding' },
  { name: 'Autonomous HR Chatbot', repo: 'stepanogil/autonomous-hr-chatbot', use_case: 'Tool-using Q&A -- pattern for FO phone bot, ticket routing' },
  { name: 'FastAgency', repo: 'airtai/fastagency', use_case: 'Multi-agent deployment -- productionising flow library skills' },
];

const QUALITY_GATE = 'PASS (score 7-10): specific to Namkhan, uses real DB tables (finance.*/pms.*/sales.*), measurable ROI, not duplicate. FAIL (1-6): generic, no data, duplicates existing, vague ROI.';

// Depth-counting JSON array extractor -- tries each [ position, returns first valid parse
function extractJsonArray(text: string): Array<Record<string, unknown>> | null {
  let pos = 0;
  while ((pos = text.indexOf('[', pos)) !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
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
      } catch { /* try next [ */ }
    }
    pos++;
  }
  return null;
}

async function searchGitHub(query: string, token: string, max = 3) {
  const url = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(query) + '&sort=stars&order=desc&per_page=' + max;
  const res = await fetch(url, { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' }, cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json() as { items?: Array<{ full_name: string; description: string | null; stargazers_count: number }> };
  return (data.items ?? []).map(r => ({ repo: r.full_name, desc: (r.description ?? '').slice(0, 70), stars: r.stargazers_count }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { focus?: string; prompt?: string; max_proposals?: number };
  const userRequest = (body.prompt ?? body.focus ?? 'hospitality agent flows').trim();
  const maxProps = body.max_proposals ?? 8;

  const sb = getSupabaseAdmin();
  const githubToken = await getVaultSecret('github_token');

  const { data: skills } = await sb.from('cockpit_skills_catalog')
    .select('name,description,health_status,total_all_time,success_all_time')
    .eq('active', true);

  const existingNames = (skills ?? []).map((s: Record<string, unknown>) => s.name as string).join(', ');
  const failingSkills = (skills ?? [])
    .filter((s: Record<string, unknown>) => s.health_status === 'failing')
    .map((s: Record<string, unknown>) => s.name as string);

  // GitHub search
  const searches = [
    userRequest + ' agent hospitality LLM',
    'boutique hotel ' + userRequest + ' AI automation',
    userRequest + ' multi-agent workflow crewai',
  ];
  const repoLines: string[] = [];
  for (const q of searches) {
    if (githubToken) {
      const repos = await searchGitHub(q, githubToken, 3);
      if (repos.length) repoLines.push(q + ': ' + repos.map(r => r.repo + '(star' + r.stars + ') ' + r.desc).join(' | '));
    }
  }

  const curatedCtx = CURATED_FRAMEWORKS.map(f => '- ' + f.name + ': ' + f.use_case).join('\n');

  // STEP 1: GENERATE
  // CRITICAL: system prompt enforces JSON-only output
  const sysGen = [
    'You are an AI agent architect for The Namkhan -- 24-room 5-star luxury hotel, Luang Prabang, Laos.',
    'DB schemas: finance.* (QB GL), pms.* (Cloudbeds PMS), sales.* (ICPs), marketing.yt_* (YouTube), media.* (assets).',
    'Failing skills needing replacement: ' + (failingSkills.join(', ') || 'none') + '.',
    'Curated frameworks:\n' + curatedCtx,
    '',
    'CRITICAL OUTPUT RULE: Your ENTIRE response must be ONLY a valid JSON array.',
    'Start with [ and end with ]. No preamble, no explanation, no markdown, no code blocks.',
    'If you cannot comply, output: []',
  ].join('\n');

  const usrGen = [
    'USER REQUEST: "' + userRequest + '"',
    '',
    'GITHUB REFS:',
    repoLines.length ? repoLines.join('\n') : '(no results -- rely on curated frameworks above)',
    '',
    'EXISTING SKILLS (skip duplicates): ' + existingNames,
    '',
    'Generate ' + (maxProps + 3) + ' agent flow proposals for Namkhan. Each must use real DB tables.',
    '',
    'OUTPUT FORMAT -- JSON array only:',
    '[{"type":"NEW","skill_name":"verb_noun_slug","display_name":"Human Name","framework":"CrewAI|AutoGen|custom","source_repo":"owner/repo","namkhan_fit":"why this 24-room hotel specifically","effort":"Low|Medium|High","roi":"High|Medium|Low","value":"specific measurable outcome","integration":"exact_table_or_view_names","proposal":"2-3 sentences on what to build","match_pct":85}]',
  ].join('\n');

  const gen = await callAnthropic({ systemPrompt: sysGen, userPrompt: usrGen, maxTokens: 4000 });
  if (!isLlmOk(gen)) return NextResponse.json({ error: 'llm_failed', detail: gen.error, stage: 'generate' }, { status: 502 });

  const rawProps = extractJsonArray(gen.text);
  if (!rawProps || rawProps.length === 0) {
    return NextResponse.json({
      error: 'no_proposals',
      stage: 'json_parse',
      raw_preview: gen.text.slice(0, 600),
      hint: 'LLM did not return a parseable JSON array -- check raw_preview',
    }, { status: 502 });
  }

  // STEP 2: SCORE
  const sysSco = 'You are a quality evaluator. ' + QUALITY_GATE + '\nCRITICAL: Output ONLY a valid JSON array. No preamble.';
  const usrSco = [
    'Score each proposal 1-10 on: namkhan_fit, feasibility, uniqueness, data_integration, roi_clarity.',
    'DEDUCT 5 on uniqueness if similar to existing: ' + existingNames,
    '',
    'OUTPUT: [{"index":0,"avg":8.1,"verdict":"PASS","scores":{"namkhan_fit":9,"feasibility":8,"uniqueness":8,"data_integration":8,"roi_clarity":7},"reason":"..."}]',
    '',
    'Proposals to score:',
    rawProps.map((p, i) => i + ': ' + p.skill_name + ' | ' + p.namkhan_fit + ' | tables: ' + p.integration).join('\n'),
  ].join('\n');

  const sco = await callAnthropic({ systemPrompt: sysSco, userPrompt: usrSco, maxTokens: 2500 });

  let finalProps = rawProps;
  let scoreMeta = { scored: 0, passed: 0, filtered: 0 };

  if (isLlmOk(sco)) {
    const scoreArr = extractJsonArray(sco.text);
    if (scoreArr) {
      scoreMeta.scored = scoreArr.length;
      type ScoreRow = { index: number; avg: number; verdict: string; reason: string; scores: Record<string, number> };
      const scores = scoreArr as ScoreRow[];
      const annotated = rawProps.map((p, i) => {
        const s = scores.find(sc => sc.index === i);
        return { ...p, _avg: s?.avg ?? 5, _verdict: s?.verdict ?? 'UNKNOWN', _reason: s?.reason ?? '', _scores: s?.scores ?? {} };
      });
      finalProps = annotated.filter(p => (p._avg as number) >= 7).sort((a, b) => (b._avg as number) - (a._avg as number)).slice(0, maxProps);
      scoreMeta.passed = finalProps.length;
      scoreMeta.filtered = rawProps.length - finalProps.length;
    }
  }

  // STEP 3: PERSIST passing proposals to DB (memory_type=research_discovery, not readable by agents)
  if (finalProps.length > 0) {
    const summaryContent = [
      'DISCOVERY RUN: "' + userRequest + '" -- ' + new Date().toISOString(),
      'Passed quality gate: ' + finalProps.length + '/' + rawProps.length,
      '',
      ...finalProps.map((p, i) => [
        (i + 1) + '. ' + String(p.skill_name) + ' [' + String(p.type) + '] -- ' + String(p.display_name),
        '   Framework: ' + String(p.framework ?? 'custom'),
        '   Fit: ' + String(p.namkhan_fit).slice(0, 120),
        '   Tables: ' + String(p.integration),
        '   ROI: ' + String(p.roi) + ' | Effort: ' + String(p.effort),
        '   Score: ' + String((p._avg as number)?.toFixed(1) ?? 'n/a'),
        '   Build: ' + String(p.proposal).slice(0, 200),
      ].join('\n')),
    ].join('\n');

    try {
      await sb.rpc('fn_kb_add_entry', {
        p_content: summaryContent,
        p_topics: ['discovery', userRequest.toLowerCase().replace(/\s+/g, '_'), 'research'],
        p_memory_type: 'research_discovery',
        p_agent_handle: 'pbs_research',
        p_importance: 3,
      });
    } catch { /* non-fatal -- log failure but continue */ }
  }

  return NextResponse.json({
    ok: true,
    proposals: finalProps,
    metadata: {
      user_request: userRequest,
      generated: rawProps.length,
      passed_quality_gate: scoreMeta.passed,
      filtered_low_quality: scoreMeta.filtered,
      quality_gate: '7/10 avg across 5 dimensions',
      curated_source: 'e2b-dev/awesome-ai-agents (8 frameworks)',
      repos_scanned: repoLines.length * 3,
      persisted: finalProps.length > 0,
    },
  });
}
