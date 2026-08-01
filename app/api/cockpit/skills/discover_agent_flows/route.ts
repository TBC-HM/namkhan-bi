// app/api/cockpit/skills/discover_agent_flows/route.ts
// REASONING AGENT LOOP: Generate -> Score -> Filter -> Return
// Design: hotel-generic discovery -- good flows come from any industry
// Fix: TS syntax fix, maxTokens 6000, 6 proposals, parallel GitHub, 30-room hotel
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk, getVaultSecret } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const CURATED_FRAMEWORKS = [
  'CrewAI (joaomdmoura/crewai) -- role-based multi-agent orchestration',
  'GPT Researcher (assafelovic/gpt-researcher) -- autonomous deep research, market intel',
  'AutoGen (microsoft/autogen) -- conversational multi-agent, report narration',
  'Lemon Agent (felixbrock/lemon-agent) -- Plan-Validate-Solve with policy enforcement',
  'MemGPT (cpacker/MemGPT) -- persistent memory across agent sessions',
  'BabyAGI (yoheinakajima/babyagi) -- iterative task decomposition',
  'Autonomous HR Bot (stepanogil/autonomous-hr-chatbot) -- tool-using Q&A, phone/chat pattern',
  'FastAgency (airtai/fastagency) -- multi-agent deployment and orchestration',
];

const QUALITY_GATE = 'PASS (7-10): clear value for a small hospitality team, technically feasible, measurable time or revenue impact, novel vs existing. FAIL (1-6): pure chatbot, no measurable outcome, duplicates existing, requires unavailable infrastructure.';

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
  const url = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(query) + '&sort=stars&order=desc&per_page=3';
  const res = await fetch(url, { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' }, cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json() as { items?: Array<{ full_name: string; description: string | null; stargazers_count: number }> };
  return (data.items ?? []).map(r => r.full_name + '(star' + r.stargazers_count + ') -- ' + (r.description ?? '').slice(0, 70));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { focus?: string; prompt?: string; max_proposals?: number };
  const userRequest = (body.prompt ?? body.focus ?? 'hospitality automation').trim();
  const maxProps = Math.min(body.max_proposals ?? 6, 6);

  const sb = getSupabaseAdmin();
  const githubToken = await getVaultSecret('github_token');

  const { data: skills } = await sb.from('cockpit_skills_catalog')
    .select('name,health_status').eq('active', true);

  const existingNames = (skills ?? []).map((s: Record<string, unknown>) => s.name as string).join(', ');
  const failingSkills = (skills ?? [])
    .filter((s: Record<string, unknown>) => s.health_status === 'failing')
    .map((s: Record<string, unknown>) => s.name as string);

  // Parallel GitHub searches
  const queries = [
    userRequest + ' agent automation LLM workflow',
    'hospitality hotel ' + userRequest + ' AI',
    userRequest + ' crewai autogen multi-agent',
  ];
  const repoResults = await Promise.all(
    queries.map(q => githubToken ? searchGitHub(q, githubToken) : Promise.resolve([]))
  );
  const repoLines = repoResults.flatMap(r => r).slice(0, 9);

  // STEP 1: GENERATE -- hotel-generic, not Namkhan-locked
  const sysGen = [
    'You are an AI agent architect. Find high-value agent automation flows for the hospitality industry.',
    'Context: 30-room luxury boutique hotel, small team (8-12 staff), systems: PMS, GL accounting, CRM, YouTube, email marketing.',
    'Failing skills to replace: ' + (failingSkills.join(', ') || 'none') + '.',
    'Curated frameworks: ' + CURATED_FRAMEWORKS.join('; '),
    '',
    'CRITICAL: Output ONLY a valid JSON array starting with [ and ending with ].',
    'Every string value MUST be under 120 characters. No preamble. No markdown. No code blocks.',
    'If you cannot comply output: []',
  ].join('\n');

  const usrGen = [
    'Discover agent flows for: "' + userRequest + '"',
    '',
    'GitHub refs: ' + (repoLines.length ? repoLines.join(' | ') : 'none'),
    'Skip (already built): ' + existingNames,
    '',
    'Rules: flows can come from ANY industry (legal, finance, content, HR) -- if adaptable for a hotel, include it.',
    'Focus on: time saved, revenue impact, guest experience, team productivity.',
    '',
    'Generate exactly ' + maxProps + ' proposals. Every field MAX 120 chars:',
    '[{"type":"NEW|IMPROVE|REPLACE","skill_name":"verb_noun_slug","display_name":"Human Name","framework":"CrewAI|AutoGen|custom","source_repo":"owner/repo","value":"specific outcome eg saves 3h/week","effort":"Low|Medium|High","roi":"High|Medium|Low","proposal":"2 sentences: what to build and how","match_pct":85}]',
  ].join('\n');

  const gen = await callAnthropic({ systemPrompt: sysGen, userPrompt: usrGen, maxTokens: 6000 });
  if (!isLlmOk(gen)) return NextResponse.json({ error: 'llm_failed', detail: gen.error, stage: 'generate' }, { status: 502 });

  const rawProps = extractJsonArray(gen.text);
  if (!rawProps || rawProps.length === 0) {
    return NextResponse.json({
      error: 'no_proposals', stage: 'json_parse',
      raw_preview: gen.text.slice(0, 800),
      hint: 'LLM did not return a parseable JSON array -- see raw_preview',
    }, { status: 502 });
  }

  // STEP 2: SCORE -- hotel fit, not DB-table fit
  const sysSco = 'Score AI agent proposals for a small luxury hotel. ' + QUALITY_GATE + ' Return ONLY valid JSON array.';
  const usrSco = [
    'Score each 1-10: hotel_fit, feasibility, uniqueness, effort_vs_value, roi_clarity.',
    'Deduct 5 on uniqueness if duplicates existing: ' + existingNames,
    '[{"index":0,"avg":8.2,"verdict":"PASS","scores":{"hotel_fit":9,"feasibility":8,"uniqueness":8,"effort_vs_value":8,"roi_clarity":8},"reason":"brief"}]',
    'Proposals:',
    rawProps.map((p, i) => i + ': ' + p.skill_name + ' | ' + String(p.proposal).slice(0, 100) + ' | value: ' + String(p.value).slice(0, 80)).join('\n'),
  ].join('\n');

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

  // STEP 3: PERSIST -- agent_handle=pbs_research so agents do not auto-read
  if (finalProps.length > 0) {
    const content = [
      'DISCOVERY "' + userRequest + '" ' + new Date().toISOString().slice(0, 16),
      'Passed ' + finalProps.length + '/' + rawProps.length,
      ...finalProps.map((p, i) =>
        (i + 1) + '. [' + p.type + '] ' + p.skill_name + ' (' + p.framework + ') -- ' +
        String(p.value).slice(0, 100) + ' | score: ' + String((p._avg as number)?.toFixed(1)) +
        '\n   ' + String(p.proposal).slice(0, 150)
      ),
    ].join('\n');
    try {
      await sb.rpc('fn_kb_add_entry', {
        p_content: content,
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
      repos_scanned: repoLines.length, persisted: finalProps.length > 0,
    },
  });
}
