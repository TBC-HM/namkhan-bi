// app/api/cockpit/skills/discover_agent_flows/route.ts
// REASONING AGENT LOOP: Generate -> Score -> Filter -> Return
// Fix: maxTokens 6000 (was 4000 -- JSON was truncating mid-array), proposals capped at 8
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

const QUALITY_GATE = 'PASS (7-10): specific to Namkhan, uses real DB tables, measurable ROI, not duplicate. FAIL (1-6): generic, no data, duplicates existing, vague ROI.';

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
  return (data.items ?? []).map(r => ({ repo: r.full_name, desc: (r.description ?? '').slice(0, 60), stars: r.stargazers_count }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { focus?: string; prompt?: string; max_proposals?: number };
  const userRequest = (body.prompt ?? body.focus ?? 'hospitality agent flows').trim();
  const maxProps = Math.min(body.max_proposals ?? 6, 8);

  const sb = getSupabaseAdmin();
  const githubToken = await getVaultSecret('github_token');

  const { data: skills } = await sb.from('cockpit_skills_catalog')
    .select('name,description,health_status,total_all_time,success_all_time')
    .eq('active', true);

  const existingNames = (skills ?? []).map((s: Record<string, unknown>) => s.name as string).join(', ');
  const failingSkills = (skills ?? [])
    .filter((s: Record<string, unknown>) => s.health_status === 'failing')
    .map((s: Record<string, unknown>) => s.name as string);

  // GitHub searches -- run in parallel for speed
  const searches = [
    userRequest + ' agent hospitality LLM',
    'boutique hotel ' + userRequest + ' AI automation',
    userRequest + ' crewai autogen multi-agent',
  ];
  const repoResults = await Promise.all(
    searches.map(q => githubToken ? searchGitHub(q, githubToken, 2) : Promise.resolve([]))
  );
  const repoLines = repoResults
    .map((repos, i) => repos.length ? searches[i] + ': ' + repos.map(r => r.repo + '(★' + r.stars + ') ' + r.desc).join(' | ') : '')
    .filter(Boolean);

  const curatedCtx = CURATED_FRAMEWORKS.map(f => '- ' + f.name + ': ' + f.use_case).join('\n');

  // STEP 1: GENERATE -- 6000 tokens to avoid truncation
  const sysGen = [
    'You are an AI agent architect for The Namkhan -- 24-room 5-star hotel, Luang Prabang, Laos.',
    'DB: finance.* (QB GL), pms.* (Cloudbeds), sales.* (ICPs), marketing.yt_* (YouTube), media.*.',
    'Failing skills to replace: ' + (failingSkills.join(', ') || 'none') + '.',
    'Curated frameworks:\n' + curatedCtx,
    '',
    'CRITICAL: Output ONLY a valid JSON array. Start with [ end with ].',
    'Keep ALL field values under 100 characters. No preamble. No markdown. No code blocks.',
    'If you cannot comply, output exactly: []',
  ].join('\n');

  const usrGen = [
    'REQUEST: "' + userRequest + '"',
    'GITHUB: ' + (repoLines.length ? repoLines.join(' | ') : 'none'),
    'SKIP (already exist): ' + existingNames,
    '',
    'Generate exactly ' + maxProps + ' proposals. Each field MAX 100 chars.',
    '[{"type":"NEW","skill_name":"verb_noun","display_name":"Name","framework":"CrewAI|AutoGen|custom","source_repo":"owner/repo","namkhan_fit":"why this hotel specifically","effort":"Low|Medium|High","roi":"High|Medium|Low","value":"measurable outcome","integration":"table_name","proposal":"what to build in 2 sentences","match_pct":85}]',
  ].join('\n');

  const gen = await callAnthropic({ systemPrompt: sysGen, userPrompt: usrGen, maxTokens: 6000 });
  if (!isLlmOk(gen)) return NextResponse.json({ error: 'llm_failed', detail: gen.error, stage: 'generate' }, { status: 502 });

  const rawProps = extractJsonArray(gen.text);
  if (!rawProps || rawProps.length === 0) {
    return NextResponse.json({
      error: 'no_proposals', stage: 'json_parse',
      raw_preview: gen.text.slice(0, 800),
      hint: 'LLM output above -- check if truncated or wrong format',
    }, { status: 502 });
  }

  // STEP 2: SCORE
  const sysSco = 'Quality evaluator. ' + QUALITY_GATE + ' Output ONLY a valid JSON array. No preamble.';
  const usrSco = 'Score 1-10 on: namkhan_fit, feasibility, uniqueness, data_integration, roi_clarity. Deduct 5 on uniqueness if duplicates: ' + existingNames + '\n[{"index":0,"avg":8.1,"verdict":"PASS","scores":{"namkhan_fit":9,"feasibility":8,"uniqueness":8,"data_integration":8,"roi_clarity":7},"reason":"brief"}]\nProposals:\n' + rawProps.map((p, i) => i + ': ' + p.skill_name + ' | ' + String(p.namkhan_fit).slice(0,80) + ' | ' + p.integration).join('\n');

  const sco = await callAnthropic({ systemPrompt: sysSco, userPrompt: usrSco, maxTokens: 2000 });

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
      finalProps = annotated.filter(p => (p._avg as number) >= 7).sort((a, b) => (b._avg as number) - (a._avg as number));
      scoreMeta.passed = finalProps.length;
      scoreMeta.filtered = rawProps.length - finalProps.length;
    }
  }

  // STEP 3: PERSIST to research KB (agent_handle=pbs_research -- not auto-read by agents)
  if (finalProps.length > 0) {
    const summaryContent = [
      'DISCOVERY: "' + userRequest + '" ' + new Date().toISOString(),
      'Passed: ' + finalProps.length + '/' + rawProps.length,
      ...finalProps.map((p, i) => (i + 1) + '. ' + p.skill_name + ' [' + p.type + '] ' + p.framework + ' | ' + String(p.namkhan_fit).slice(0, 100) + ' | tables: ' + p.integration + ' | score: ' + String((p._avg as number)?.toFixed(1)) + ' | ' + String(p.proposal).slice(0, 150)),
    ].join('\n');
    try {
      await sb.rpc('fn_kb_add_entry', {
        p_content: summaryContent,
        p_topics: ['discovery', userRequest.toLowerCase().replace(/\W+/g, '_')],
        p_memory_type: 'research_discovery',
        p_agent_handle: 'pbs_research',
        p_importance: 3,
      });
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    ok: true, proposals: finalProps,
    metadata: {
      user_request: userRequest, generated: rawProps.length,
      passed_quality_gate: scoreMeta.passed, filtered_low_quality: scoreMeta.filtered,
      curated_source: 'e2b-dev/awesome-ai-agents (8 frameworks)',
      repos_scanned: repoLines.length * 2, persisted: finalProps.length > 0,
    },
  });
}
