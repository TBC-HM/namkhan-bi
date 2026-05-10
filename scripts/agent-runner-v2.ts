#!/usr/bin/env node
/**
 * scripts/agent-runner-v2.ts — CARLA, REBUILT (PBS 2026-05-10)
 *
 * Why v2: v1 was single-shot blind code generation. ~80% of attempts shipped
 * code that didn't compile — Carla imported things that didn't exist,
 * referenced components that didn't exist, used jest globals (not installed),
 * etc. Retry-once-with-tsc-feedback helped marginally; usually the retry
 * also failed because Carla still couldn't see the files she was editing.
 *
 * v2 design: a multi-turn tool-using agent that mirrors how a human (or
 * Claude Code) writes code:
 *   1. The model gets a spec + the list of available tools
 *   2. The model uses `grep` and `read_file` to explore the codebase
 *   3. The model uses `edit_file` / `write_file` to apply changes
 *   4. The model uses `run_tsc` to verify before declaring done
 *   5. The model calls `finalize` only when tsc passes — that's the trigger
 *      to commit + push + open PR
 *
 * This burns more tokens per ticket (~3-10 turns instead of 1-2) but the
 * tradeoff is shipping clean PRs vs the v1 90% abort rate.
 *
 * Required env (same as v1):
 *   ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GITHUB_TOKEN
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const TICKET_ID = process.env.TICKET_ID;
const MAX_BATCH = Number(process.env.AGENT_RUNNER_BATCH ?? '5');
const MAX_TURNS = Number(process.env.AGENT_RUNNER_MAX_TURNS ?? '12');
const FORCE_ACT_AFTER = 4; // PBS 2026-05-10: after N turns of pure read/grep without an edit, inject a system warning forcing edit-or-abort decision
const MODEL = process.env.AGENT_RUNNER_MODEL ?? 'claude-sonnet-4-6';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error('ANTHROPIC_API_KEY required');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

interface Ticket {
  id: number;
  parsed_summary: string | null;
  email_subject: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  arm: string | null;
  intent: string | null;
  status: string;
}

const SYSTEM_PROMPT = `You are Carla, the code-writer for Namkhan BI. Repo is Next.js 14 App Router + Supabase + Vercel. Your job is to ship a small surgical patch for a single ticket.

You have these tools — use them. Do NOT guess at file paths or component names; look them up.

Rules:
- ALWAYS start with grep / read_file to understand the codebase before editing.
- Make minimal, surgical changes. Prefer editing existing files over creating new ones.
- Match existing code style. If the file uses 4-space indent, you do too.
- Brand: '$' for USD, '₭' for LAK, em-dash '—' for empty cells, italic Fraunces for KPI values.
- Six canonical primitives only: <Page>, <KpiBox>, <Panel>, <DataTable>, <Brief>, <Lane>+<ProposalCard>. Don't invent new tile/card markup.
- Never touch: .env*, supabase/migrations/*, package.json (unless the spec is a dep change), .github/workflows/* (unless the spec is a CI change).
- After your edits, ALWAYS call run_tsc. If it fails, fix the errors and try again. Don't call finalize until tsc passes.
- If you can't see how to fix something safely (missing design spec, ambiguous scope, would break other things), call abort with a short reason.

Branch name format: 'autorun/ticket-<id>-<3-word-slug>'.
PR title: '<verb>: <one-line summary> (ticket #<id>)'.
PR body: 2-3 short paragraphs covering what, why, how to verify. Include a "Rollback" line.`;

interface ToolCall {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

const TOOLS = [
  {
    name: 'grep',
    description: 'Search the codebase for a pattern. Returns file paths (one per line, max 20). Use this BEFORE editing to find the right files.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Literal string to search for. No regex.' },
        path: { type: 'string', description: 'Optional path to search under. Defaults to "app components lib styles".' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file. Returns up to 3000 chars. Use offset+limit to read more.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        offset: { type: 'number', description: 'Line offset (default 0)' },
        limit: { type: 'number', description: 'Max lines to return (default 200)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'edit_file',
    description: 'Replace a unique string in an existing file. Returns ok or error. Use this for surgical edits.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string', description: 'Exact text to replace. MUST be unique in the file.' },
        new_string: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'write_file',
    description: 'Create a new file or fully replace an existing one. Use only when edit_file is not enough (new file or full rewrite).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        contents: { type: 'string' },
      },
      required: ['path', 'contents'],
    },
  },
  {
    name: 'run_tsc',
    description: 'Run npx tsc --noEmit and return the result. Returns "passed" or first 30 lines of errors. ALWAYS call this before finalize.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'finalize',
    description: 'Commit changes, push branch, open PR. ONLY call when run_tsc has passed.',
    input_schema: {
      type: 'object',
      properties: {
        branch_name: { type: 'string', description: 'autorun/ticket-<id>-<3-word-slug>' },
        pr_title: { type: 'string' },
        pr_body: { type: 'string' },
      },
      required: ['branch_name', 'pr_title', 'pr_body'],
    },
  },
  {
    name: 'abort',
    description: 'Give up on this ticket. Use when the spec is too vague or the change would be unsafe.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'One sentence on why.' },
      },
      required: ['reason'],
    },
  },
];

const REPO_ROOT = process.cwd();

function gitSh(cmd: string, env: NodeJS.ProcessEnv = process.env): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env }).trim();
}

function toolGrep(args: { pattern: string; path?: string }): string {
  const path = args.path ?? 'app components lib styles';
  try {
    const escaped = args.pattern.replace(/[\\"]/g, '\\$&');
    const out = execSync(
      `grep -rl --include='*.tsx' --include='*.ts' --include='*.css' "${escaped}" ${path} 2>/dev/null | head -20`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return out || '(no matches)';
  } catch {
    return '(no matches)';
  }
}

function toolReadFile(args: { path: string; offset?: number; limit?: number }): string {
  const full = join(REPO_ROOT, args.path);
  if (!existsSync(full)) return `ERROR: file not found: ${args.path}`;
  const lines = readFileSync(full, 'utf8').split('\n');
  const start = args.offset ?? 0;
  const end = Math.min(lines.length, start + (args.limit ?? 200));
  const slice = lines.slice(start, end);
  const numbered = slice.map((l, i) => `${start + i + 1}\t${l}`).join('\n');
  const content = numbered.length > 6000 ? numbered.slice(0, 6000) + '\n...(truncated)' : numbered;
  return `// ${args.path} (${start + 1}-${end} of ${lines.length} lines)\n${content}`;
}

function toolEditFile(args: { path: string; old_string: string; new_string: string }): string {
  const full = join(REPO_ROOT, args.path);
  if (!existsSync(full)) return `ERROR: file not found: ${args.path}`;
  const text = readFileSync(full, 'utf8');
  const idx = text.indexOf(args.old_string);
  if (idx < 0) return `ERROR: old_string not found in ${args.path}`;
  if (text.indexOf(args.old_string, idx + 1) >= 0) {
    return `ERROR: old_string is not unique in ${args.path} — provide more context`;
  }
  writeFileSync(full, text.replace(args.old_string, args.new_string), 'utf8');
  return `ok: edited ${args.path}`;
}

function toolWriteFile(args: { path: string; contents: string }): string {
  const full = join(REPO_ROOT, args.path);
  const dir = dirname(full);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(full, args.contents, 'utf8');
  return `ok: wrote ${args.path} (${args.contents.length} chars)`;
}

function toolRunTsc(): string {
  try {
    execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 });
    return 'passed';
  } catch (e) {
    const stdout = (e as { stdout?: Buffer }).stdout?.toString() ?? '';
    const head = stdout.split('\n').slice(0, 30).join('\n');
    return `FAILED:\n${head}`;
  }
}

interface FinalizeArgs { branch_name: string; pr_title: string; pr_body: string; }

async function toolFinalize(args: FinalizeArgs, ticketId: number): Promise<{ ok: boolean; pr_url: string | null; err?: string }> {
  const branch = args.branch_name.replace(/[^a-zA-Z0-9/_-]/g, '-').slice(0, 80);
  try {
    try { gitSh(`git checkout -b ${branch}`); }
    catch { gitSh(`git checkout -B ${branch}`); }
    gitSh('git add -A');
    const msgPath = `/tmp/commit-msg-${ticketId}-${Date.now()}.txt`;
    writeFileSync(msgPath, `${args.pr_title}\n\n${args.pr_body}\n\n[ticket #${ticketId}]`, 'utf8');
    gitSh(`git commit -F "${msgPath}"`);
    gitSh(`git push -u origin ${branch}`);
    let prUrl: string | null = null;
    if (process.env.GITHUB_TOKEN) {
      const bodyPath = `/tmp/pr-body-${ticketId}-${Date.now()}.txt`;
      writeFileSync(bodyPath, args.pr_body, 'utf8');
      const safeTitle = args.pr_title.replace(/[\r\n\t]+/g, ' ').replace(/"/g, "'").slice(0, 200);
      try {
        const out = execSync(
          `gh pr create --title "${safeTitle}" --body-file "${bodyPath}" --head ${branch} --base main`,
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN } },
        ).trim();
        prUrl = out.match(/https:\/\/[^\s]+/)?.[0] ?? null;
        if (!prUrl) {
          console.error(`gh pr create produced no URL. raw output: ${out.slice(0, 400)}`);
          return { ok: false, pr_url: null, err: `gh pr create returned no URL: ${out.slice(0, 400)}` };
        }
      } catch (e) {
        const err = e as { stderr?: string | Buffer; stdout?: string | Buffer; message?: string };
        const stderr = (typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString()) ?? '';
        const stdout = (typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString()) ?? '';
        const msg = `gh pr create failed: ${stderr.slice(0, 300)} | stdout: ${stdout.slice(0, 100)}`;
        console.error(msg);
        return { ok: false, pr_url: null, err: msg };
      }
    }
    return { ok: true, pr_url: prUrl };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error(`toolFinalize outer error: ${msg}`);
    return { ok: false, pr_url: null, err: msg };
  }
}

async function dispatchTool(name: string, input: Record<string, unknown>, ticketId: number): Promise<string> {
  switch (name) {
    case 'grep':
      return toolGrep(input as { pattern: string; path?: string });
    case 'read_file':
      return toolReadFile(input as { path: string; offset?: number; limit?: number });
    case 'edit_file':
      return toolEditFile(input as { path: string; old_string: string; new_string: string });
    case 'write_file':
      return toolWriteFile(input as { path: string; contents: string });
    case 'run_tsc':
      return toolRunTsc();
    case 'finalize': {
      const r = await toolFinalize(input as unknown as FinalizeArgs, ticketId);
      return JSON.stringify(r);
    }
    case 'abort':
      return JSON.stringify({ ok: true, aborted: true, reason: (input as { reason: string }).reason });
    default:
      return `ERROR: unknown tool ${name}`;
  }
}

async function carlaSession(ticket: Ticket): Promise<{ pr_url: string | null; aborted: boolean; reason: string | null; turns: number; tokens_in: number; tokens_out: number }> {
  const meta = (ticket.metadata ?? {}) as Record<string, unknown>;
  const spec = [
    `# Ticket #${ticket.id}`,
    `**Subject**: ${ticket.email_subject ?? '(none)'}`,
    `**Arm**: ${ticket.arm ?? ''}  **Intent**: ${ticket.intent ?? ''}`,
    '',
    '## Spec',
    typeof meta.spec === 'string' ? meta.spec : (ticket.parsed_summary ?? '(no spec body)'),
  ].join('\n');

  type Msg = { role: 'user' | 'assistant'; content: unknown };
  const messages: Msg[] = [{ role: 'user', content: spec }];
  let totalIn = 0;
  let totalOut = 0;
  let prUrl: string | null = null;
  let aborted = false;
  let abortReason: string | null = null;
  let turnsSinceEdit = 0;
  let everEdited = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
    });
    if (!res.ok) {
      console.error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
      break;
    }
    const json = await res.json();
    totalIn += json?.usage?.input_tokens ?? 0;
    totalOut += json?.usage?.output_tokens ?? 0;
    const blocks = (json?.content ?? []) as ContentBlock[];
    const stop = json?.stop_reason as string | undefined;

    const toolUses = blocks.filter((b): b is ContentBlock & ToolCall => b.type === 'tool_use') as ToolCall[];
    if (toolUses.length === 0 || stop !== 'tool_use') {
      // Model returned only text — done (or stuck without finalizing).
      const text = blocks.find((b) => b.type === 'text')?.text ?? '';
      console.log(`turn ${turn}: model returned text without tool_use, stopping. text head: ${text.slice(0, 200)}`);
      break;
    }

    messages.push({ role: 'assistant', content: blocks });
    const results: Array<{ type: string; tool_use_id: string; content: string }> = [];
    for (const tu of toolUses) {
      const result = await dispatchTool(tu.name ?? '', tu.input ?? {}, ticket.id);
      console.log(`  tool=${tu.name} result=${result.slice(0, 120).replace(/\n/g, ' | ')}`);
      results.push({ type: 'tool_result', tool_use_id: tu.id ?? '', content: result.slice(0, 8000) });
      // Detect terminal tools
      if (tu.name === 'edit_file' || tu.name === 'write_file') {
        if (typeof result === 'string' && result.startsWith('ok')) {
          everEdited = true;
          turnsSinceEdit = 0;
        }
      }
      if (tu.name === 'finalize') {
        try {
          const parsed = JSON.parse(result);
          if (parsed.ok && parsed.pr_url) {
            prUrl = parsed.pr_url as string;
          } else if (!parsed.ok) {
            // Surface the error loudly and mark as aborted so the runner
            // records it properly rather than silently falling through to
            // the "no_finalize" path (the original bug: 14/16 tickets lost).
            const errMsg = parsed.err ?? 'finalize returned ok=false with no error detail';
            console.error(`finalize FAILED (ticket #${ticket.id}): ${errMsg}`);
            aborted = true;
            abortReason = `finalize_failed: ${errMsg}`;
          }
        } catch { /* nm */ }
      }
      if (tu.name === 'abort') {
        try {
          const parsed = JSON.parse(result);
          if (parsed.aborted) { aborted = true; abortReason = parsed.reason ?? 'no reason given'; }
        } catch { /* nm */ }
      }
    }
    // PBS 2026-05-10 emergency v2: append force-act nudge EVERY turn once we pass FORCE_ACT_AFTER without an edit.
    // The first version used === which only fired once and the model ignored it. >= keeps escalating until edit or abort.
    let userContent: unknown = results;
    if (!everEdited && turn >= FORCE_ACT_AFTER) {
      const escalation = turn >= FORCE_ACT_AFTER + 2 ? 'FINAL WARNING — your next response will be cut off if it is not edit_file/write_file/abort.' : '';
      userContent = [...results, { type: 'text', text: `[ENFORCEMENT TURN ${turn + 1}] You have used ${turn + 1} turns without ANY successful edit_file or write_file call. ${escalation} You MUST now do exactly one of: (1) call edit_file or write_file with a concrete change to a real file you have already read, or (2) call abort with reason="spec_too_vague" or "no_matching_code". DO NOT call grep. DO NOT call read_file. ANY further investigation tool calls are an error.` }];
    }
    // PBS 2026-05-10 emergency v2: hard cap — if 7 turns have passed without any edit, force-abort the ticket from the runner side.
    if (!everEdited && turn >= 6) {
      console.log(`  [FORCE-ABORT] turn=${turn}, no edits made, terminating session`);
      aborted = true;
      abortReason = 'runner_force_abort: 7 turns without an edit';
    }
    messages.push({ role: 'user', content: userContent });

    if (prUrl) break;
    if (aborted) break;
  }

  return { pr_url: prUrl, aborted, reason: abortReason, turns: messages.length, tokens_in: totalIn, tokens_out: totalOut };
}

async function fetchTickets(): Promise<Ticket[]> {
  if (TICKET_ID) {
    const { data } = await supa
      .from('cockpit_tickets')
      .select('id, parsed_summary, email_subject, notes, metadata, arm, intent, status')
      .eq('id', Number(TICKET_ID))
      .single();
    return data ? [data as Ticket] : [];
  }
  const { data } = await supa
    .from('cockpit_tickets')
    .select('id, parsed_summary, email_subject, notes, metadata, arm, intent, status, preview_url')
    .eq('status', 'triaged')
    .in('arm', ['dev', 'code'])
    .in('intent', ['build', 'spec', 'fix'])
    .is('preview_url', null)
    .is('processed_at', null)
    .order('updated_at', { ascending: true })
    .limit(MAX_BATCH);
  return (data ?? []) as Ticket[];
}

async function audit(ticketId: number, action: string, notes: Record<string, unknown>, role = 'agent_runner') {
  await supa.from('cockpit_audit_log').insert({
    agent: role,
    action,
    success: action !== 'agent_run_failed' && action !== 'agent_run_tsc_failed' && action !== 'agent_run_aborted',
    ticket_id: ticketId,
    notes: JSON.stringify(notes),
  });
}

async function processOne(t: Ticket): Promise<void> {
  console.log(`\n=== ticket #${t.id} ===`);
  let triageRole = 'agent_runner';
  try {
    const tr = JSON.parse(t.notes ?? '{}');
    triageRole = (tr.recommended_agent || tr.recommended_role || 'agent_runner').toLowerCase();
  } catch { /* nm */ }

  await audit(t.id, 'agent_run_start', { model: MODEL, role: triageRole, version: 'v2' }, triageRole);

  // Make sure we're on main and clean before starting
  try {
    gitSh('git checkout main');
    gitSh('git reset --hard origin/main');
  } catch (e) {
    console.error(`git reset failed: ${(e as Error).message}`);
  }

  const result = await carlaSession(t);
  console.log(`  result: pr_url=${result.pr_url} aborted=${result.aborted} turns=${result.turns} tokens=${result.tokens_in}+${result.tokens_out}`);

  if (result.pr_url) {
    await audit(t.id, 'agent_run_pr_opened', { pr_url: result.pr_url, turns: result.turns, tokens_in: result.tokens_in, tokens_out: result.tokens_out }, triageRole);
    await supa
      .from('cockpit_tickets')
      .update({
        pr_url: result.pr_url,
        preview_url: result.pr_url,
        status: 'awaits_user',
        processed_at: new Date().toISOString(),
      })
      .eq('id', t.id);
    console.log(`  ✓ ticket #${t.id} → PR ${result.pr_url}`);
    return;
  }

  if (result.aborted) {
    await audit(t.id, 'agent_run_aborted', { reason: result.reason, turns: result.turns }, triageRole);
    await supa
      .from('cockpit_tickets')
      .update({
        status: 'awaits_user',
        processed_at: new Date().toISOString(),
        notes: JSON.stringify({ kind: 'agent_aborted', reason: result.reason }),
      })
      .eq('id', t.id);
    console.log(`  aborted: ${result.reason}`);
    return;
  }

  // No PR, not aborted — Carla ran out of turns or got stuck
  await audit(t.id, 'agent_run_no_finalize', { turns: result.turns, tokens_in: result.tokens_in, tokens_out: result.tokens_out }, triageRole);
  await supa
    .from('cockpit_tickets')
    .update({
      status: 'triage_failed',
      processed_at: new Date().toISOString(),
      notes: JSON.stringify({ kind: 'agent_no_finalize', turns: result.turns }),
    })
    .eq('id', t.id);
  console.log(`  no finalize after ${result.turns} turns`);
}

async function main(): Promise<void> {
  const tickets = await fetchTickets();
  console.log(`agent-runner v2: ${tickets.length} ticket(s) to process`);
  for (const t of tickets) {
    try {
      await processOne(t);
    } catch (e) {
      console.error(`ticket #${t.id} threw: ${(e as Error).message}`);
      await audit(t.id, 'agent_run_failed', { error: (e as Error).message }, 'agent_runner');
    }
  }
  console.log('agent-runner v2: done');
}

void main();
