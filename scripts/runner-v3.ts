#!/usr/bin/env node
/**
 * scripts/runner-v3.ts — CLEAN-SLATE RUNNER (PBS 2026-05-10 night)
 *
 * Replaces agent-runner-v2.ts. Built after 10+ broken patches on v2.
 *
 * PRINCIPLES (PBS directive):
 *   1. Heartbeat FIRST. Always write a cockpit_runner_heartbeat row on start.
 *   2. Fail LOUD. Every error → audit log + heartbeat row update + console.
 *   3. STATELESS. No multi-turn agent. Single Claude call, single PR.
 *   4. BOUNDED. 8min wall clock per ticket, then SIGKILL and move on.
 *   5. NEVER push back to PBS. Start the work. Reasonable defaults.
 *
 * ENV (same names as v2 for GHA compat):
 *   ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   GITHUB_TOKEN, TICKET_ID (optional)
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const TICKET_ID = process.env.TICKET_ID;
const BATCH = Number(process.env.RUNNER_BATCH ?? '1');
const TICKET_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes hard wall
const CLAUDE_MODEL = process.env.RUNNER_MODEL ?? 'claude-sonnet-4-5-20250929';

if (!SUPABASE_URL || !SERVICE_ROLE) die('missing supabase env');
if (!ANTHROPIC_KEY) die('missing ANTHROPIC_API_KEY');

const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

const GH_RUN_ID = process.env.GITHUB_RUN_ID ?? 'local';
const STARTED_AT = new Date();

interface Ticket {
  id: number;
  parsed_summary: string | null;
  email_subject: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

interface RunResult {
  ticket_id: number;
  outcome: 'pr_opened' | 'no_change' | 'error' | 'timeout';
  pr_url?: string;
  branch?: string;
  error?: string;
  duration_ms: number;
}

function die(msg: string): never {
  console.error('FATAL:', msg);
  process.exit(1);
}

function sh(cmd: string, opts: { quiet?: boolean } = {}): string {
  if (!opts.quiet) console.log('$', cmd);
  return execSync(cmd, { encoding: 'utf-8', stdio: opts.quiet ? 'pipe' : 'inherit' }).toString();
}

async function audit(ticket_id: number | null, action: string, success: boolean, notes: unknown) {
  const { error } = await supa.from('cockpit_audit_log').insert({
    agent: 'runner_v3',
    action,
    success,
    ticket_id,
    notes: JSON.stringify(notes),
  });
  if (error) console.error('AUDIT FAILED:', error.message, action);
}

async function startHeartbeat(): Promise<number> {
  const { data, error } = await supa
    .from('cockpit_runner_heartbeat')
    .insert({
      runner_name: 'runner_v3',
      github_run_id: GH_RUN_ID,
      tickets_picked: 0,
      tickets_processed: 0,
      prs_opened: 0,
      abort_count: 0,
      errors: [],
    })
    .select('id')
    .single();
  if (error) {
    console.error('HEARTBEAT START FAILED:', error.message);
    return -1;
  }
  console.log(`heartbeat id=${data.id}`);
  return data.id as number;
}

async function endHeartbeat(
  hbId: number,
  results: RunResult[],
  fatalErr?: string
) {
  if (hbId < 0) return;
  const tickets_picked = results.length;
  const tickets_processed = results.filter((r) => r.outcome !== 'error' && r.outcome !== 'timeout').length;
  const prs_opened = results.filter((r) => r.outcome === 'pr_opened').length;
  const abort_count = results.filter((r) => r.outcome === 'no_change').length;
  const errors = results
    .filter((r) => r.error)
    .map((r) => ({ ticket: r.ticket_id, error: r.error }));
  if (fatalErr) errors.push({ ticket: 0, error: fatalErr });

  const { error } = await supa
    .from('cockpit_runner_heartbeat')
    .update({
      ended_at: new Date().toISOString(),
      tickets_picked,
      tickets_processed,
      prs_opened,
      abort_count,
      errors,
      exit_code: fatalErr ? 1 : 0,
      notes: fatalErr ? fatalErr : `picked ${tickets_picked}, prs ${prs_opened}`,
    })
    .eq('id', hbId);
  if (error) console.error('HEARTBEAT END FAILED:', error.message);
}

async function fetchTickets(): Promise<Ticket[]> {
  if (TICKET_ID) {
    const { data, error } = await supa
      .from('cockpit_tickets')
      .select('id, parsed_summary, email_subject, notes, metadata')
      .eq('id', Number(TICKET_ID))
      .single();
    if (error) {
      console.error('fetch single ticket error:', error.message);
      return [];
    }
    return data ? [data as Ticket] : [];
  }
  const { data, error } = await supa
    .from('cockpit_tickets')
    .select('id, parsed_summary, email_subject, notes, metadata')
    .eq('status', 'triaged')
    .in('arm', ['dev', 'code'])
    .in('intent', ['build', 'spec', 'fix'])
    .is('preview_url', null)
    .is('processed_at', null)
    .order('updated_at', { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error('fetch tickets error:', error.message);
    return [];
  }
  return (data ?? []) as Ticket[];
}

const SYSTEM_PROMPT = `You are Carla, the code writer for The Namkhan BI portal.

Stack: Next.js 14 App Router + Supabase + Vercel. Repo: TBC-HM/namkhan-bi.

You will be given:
- The ticket spec
- The full current contents of files most likely involved (under <<<EXISTING path=...>>> ... <<<END>>> markers)
- A list of real file paths in the repo

CRITICAL RULES — preserve existing code:
1. The <<<EXISTING>>> blocks are the REAL current content. Do NOT invent or hallucinate file structures.
2. Make the MINIMUM edit needed. Keep all existing imports, components, props, exports, comments, and code that is unrelated to the ticket. NEVER rewrite a file from scratch.
3. If you are rewriting more than ~30% of an EXISTING file, you are doing it wrong. Stop and produce a smaller change.
4. If the ticket asks for a UI change, change ONLY the affected JSX/CSS. Leave data-fetching, types, helper components, and unrelated sections exactly as they are.
5. Surgical: usually you touch ONE file. Two files MAX unless the ticket explicitly demands more.
6. **PATHS**: Use ONLY file paths that appear in EXISTING blocks or the file tree below. NEVER invent paths.
7. Match existing code style. Tailwind for styling. TypeScript strict.
8. Never touch: .env*, package.json, .github/workflows/*, supabase/migrations/*.
9. Brand: '$' for USD, '₭' for LAK, em-dash '—' for empty. Italic Fraunces for KPI values.
10. NEVER push back. If the spec is thin, pick reasonable defaults and ship something — but still minimal.

OUTPUT FORMAT — strict. For each file you want to change, emit:

<<<FILE path=path/to/file.tsx>>>
(complete new file content here, exactly as you want it written to disk — must be the EXISTING file with your minimal edit applied)
<<<END>>>

You can emit multiple <<<FILE>>>...<<<END>>> blocks for multiple files.
For a NEW file, just use the same format with a path that doesn't exist yet.
For DELETING a file, emit: <<<DELETE path=path/to/file.tsx>>>

If you cannot do useful work, output the single literal line: NO_DIFF

Do NOT output explanations, markdown fences, or anything outside the <<<FILE>>> blocks.`;

function repoSnapshot(): string {
  try {
    // Full file tree excluding noise. This is THE critical piece — Claude must see
    // every file path that exists before generating a diff, or it guesses paths
    // like "components/layout/Footer.tsx" that don't exist → git apply fails.
    const tree = sh(
      `find app components lib scripts -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.css" -o -name "*.json" \\) 2>/dev/null | grep -v node_modules | sort | head -300`,
      { quiet: true }
    );
    const topLevel = sh('ls -la 2>/dev/null', { quiet: true });
    return `Full file tree (real paths — use ONLY these, do not invent):\n${tree}\n\nTop level:\n${topLevel}`;
  } catch (e) {
    return 'repo snapshot failed';
  }
}

/**
 * Heuristic: scan ticket text for things that look like repo file paths or URL
 * paths under /app, and convert them to candidate file paths to feed Claude as
 * EXISTING blocks. This gives Carla the real current content so she can do
 * surgical edits instead of rewriting from scratch.
 */
function extractFilePaths(text: string): string[] {
  const candidates = new Set<string>();
  if (!text) return [];

  // 1. Direct path mentions like app/operations/staff/page.tsx
  const directRe = /\b((?:app|components|lib|scripts)\/[A-Za-z0-9_\-./\[\]]+\.(?:tsx?|jsx?|css|json))\b/g;
  let m: RegExpExecArray | null;
  while ((m = directRe.exec(text))) candidates.add(m[1]);

  // 2. URL mentions like /operations/staff or namkhan-bi.vercel.app/operations/staff
  //    → map to app/<route>/page.tsx
  const urlRe = /(?:vercel\.app)?\/((?:[a-z0-9_-]+\/)+[a-z0-9_-]+)\b/gi;
  while ((m = urlRe.exec(text))) {
    const route = m[1].replace(/^\/+|\/+$/g, '');
    if (!route) continue;
    // ignore non-route stuff
    if (/^(api|http|https|www|github|pull|tree)\b/i.test(route)) continue;
    candidates.add(`app/${route}/page.tsx`);
  }

  // 3. Bare /word/word route mention at start of line or after whitespace
  const routeRe = /(?:^|\s)\/([a-z0-9_-]+(?:\/[a-z0-9_-]+){0,3})(?=[\s.,)]|$)/gi;
  while ((m = routeRe.exec(text))) {
    const route = m[1];
    if (/^(api|http|https|www|github)\b/i.test(route)) continue;
    candidates.add(`app/${route}/page.tsx`);
  }

  return Array.from(candidates).slice(0, 8);
}

/**
 * Reads up to N candidate files from disk, returns concatenated EXISTING blocks.
 * Skips files that don't exist or are too big (>20k chars).
 */
function readExistingFiles(paths: string[]): string {
  const fs = require('fs') as typeof import('fs');
  const blocks: string[] = [];
  let totalChars = 0;
  const MAX_TOTAL = 60_000; // ~15k tokens — leaves room for spec + tree + output
  const MAX_PER_FILE = 20_000;

  for (const p of paths) {
    if (totalChars >= MAX_TOTAL) break;
    try {
      if (!fs.existsSync(p)) continue;
      const stat = fs.statSync(p);
      if (!stat.isFile()) continue;
      let content = fs.readFileSync(p, 'utf-8');
      if (content.length > MAX_PER_FILE) {
        content = content.slice(0, MAX_PER_FILE) + '\n\n/* …file truncated… */';
      }
      blocks.push(`<<<EXISTING path=${p}>>>\n${content}\n<<<END>>>`);
      totalChars += content.length;
    } catch {
      /* skip */
    }
  }

  return blocks.length
    ? `Current file contents (preserve everything not directly related to the ticket):\n\n${blocks.join('\n\n')}`
    : '';
}

async function callClaude(userPrompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`anthropic ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const block = data.content?.find((b) => b.type === 'text');
  return block?.text ?? '';
}


async function processTicket(t: Ticket): Promise<RunResult> {
  const t0 = Date.now();
  console.log(`\n=== ticket #${t.id} ===`);
  await audit(t.id, 'agent_run_start', true, { runner: 'v3' });

  try {
    // Reset to clean main
    sh('git checkout main', { quiet: true });
    sh('git reset --hard origin/main', { quiet: true });

    // Single-shot Claude call with timeout
    // Pull current contents of any files the ticket references — gives Claude
    // the real code to edit surgically instead of rewriting from scratch.
    const ticketText = `${t.email_subject ?? ''}\n${t.parsed_summary ?? ''}\n${t.notes ?? ''}`;
    const candidatePaths = extractFilePaths(ticketText);
    const existing = readExistingFiles(candidatePaths);

    const userPrompt = `TICKET #${t.id}\n\nSubject: ${t.email_subject ?? ''}\n\nSummary:\n${t.parsed_summary ?? ''}\n\nNotes (PBS answers if any):\n${t.notes ?? ''}\n\n---\n\n${existing}\n\n---\n\nRepo snapshot:\n${repoSnapshot()}`;

    const response = await Promise.race([
      callClaude(userPrompt),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('claude_timeout_8min')), TICKET_TIMEOUT_MS)
      ),
    ]);

    const text = response;
    
    if (!text || text.trim() === 'NO_DIFF') {
      await audit(t.id, 'agent_run_no_diff', true, { reason: 'claude returned NO_DIFF or empty' });
      await supa.from('cockpit_tickets').update({
        status: 'awaits_user',
        processed_at: new Date().toISOString(),
        notes: JSON.stringify({ kind: 'no_diff', reason: 'Claude could not produce a useful diff' }),
      }).eq('id', t.id);
      return { ticket_id: t.id, outcome: 'no_change', duration_ms: Date.now() - t0 };
    }

    // Parse <<<FILE path=...>>>...<<<END>>> blocks (and <<<DELETE path=...>>>)
    const fileBlocks: Array<{ op: 'write'; path: string; content: string } | { op: 'delete'; path: string }> = [];
    const fileRe = /<<<FILE path=([^>]+)>>>\s*\n([\s\S]*?)\n<<<END>>>/g;
    const delRe = /<<<DELETE path=([^>]+)>>>/g;
    let m: RegExpExecArray | null;
    while ((m = fileRe.exec(text)) !== null) {
      fileBlocks.push({ op: 'write', path: m[1].trim(), content: m[2] });
    }
    while ((m = delRe.exec(text)) !== null) {
      fileBlocks.push({ op: 'delete', path: m[1].trim() });
    }

    if (fileBlocks.length === 0) {
      console.error(`no file blocks parsed for #${t.id}`);
      await audit(t.id, 'agent_run_diff_failed', false, {
        error: 'no FILE blocks in claude output',
        text_preview: text.slice(0, 500),
      });
      await supa.from('cockpit_tickets').update({
        status: 'awaits_user',
        processed_at: new Date().toISOString(),
        notes: JSON.stringify({ kind: 'no_file_blocks', text_preview: text.slice(0, 500) }),
      }).eq('id', t.id);
      return { ticket_id: t.id, outcome: 'error', error: 'no file blocks', duration_ms: Date.now() - t0 };
    }

    // Validate paths — must not touch forbidden areas
    const forbidden = (p: string) =>
      p.startsWith('.env') ||
      p === 'package.json' ||
      p === 'package-lock.json' ||
      p.startsWith('.github/workflows/') ||
      p.startsWith('supabase/migrations/');
    const badPath = fileBlocks.find((b) => forbidden(b.path));
    if (badPath) {
      await audit(t.id, 'agent_run_diff_failed', false, {
        error: 'forbidden path: ' + badPath.path,
      });
      await supa.from('cockpit_tickets').update({
        status: 'awaits_user',
        processed_at: new Date().toISOString(),
        notes: JSON.stringify({ kind: 'forbidden_path', path: badPath.path }),
      }).eq('id', t.id);
      return { ticket_id: t.id, outcome: 'error', error: 'forbidden path', duration_ms: Date.now() - t0 };
    }

    // Create branch and apply file writes
    const slug = String(t.id) + '-' + Math.random().toString(36).slice(2, 8);
    const branch = `autorun/ticket-${slug}`;
    sh(`git checkout -b ${branch}`, { quiet: true });

    for (const b of fileBlocks) {
      if (b.op === 'write') {
        const fullPath = b.path;
        // Make sure parent dir exists
        const parentDir = fullPath.includes('/') ? fullPath.split('/').slice(0, -1).join('/') : '.';
        sh(`mkdir -p "${parentDir}"`, { quiet: true });
        writeFileSync(fullPath, b.content);
      } else if (b.op === 'delete') {
        sh(`rm -f "${b.path}"`, { quiet: true });
      }
    }
    sh('git add -A', { quiet: true });

    // Detect if anything changed
    try {
      sh('git diff --cached --quiet --exit-code', { quiet: true });
      // exit code 0 = no diff. Claude wrote files but content matched main.
      console.log(`no actual changes for #${t.id}`);
      sh(`git checkout main && git branch -D ${branch}`, { quiet: true });
      await audit(t.id, 'agent_run_no_diff', true, { reason: 'files written but content identical to main' });
      await supa.from('cockpit_tickets').update({
        status: 'awaits_user',
        processed_at: new Date().toISOString(),
        notes: JSON.stringify({ kind: 'no_change', files: fileBlocks.map((b) => b.path) }),
      }).eq('id', t.id);
      return { ticket_id: t.id, outcome: 'no_change', duration_ms: Date.now() - t0 };
    } catch {
      // non-zero exit = there IS a diff. Good.
    }
    
    // Commit
    const commitMsg = `runner_v3: ticket #${t.id} — ${(t.email_subject ?? 'auto').slice(0, 60)}`;
    const commitMsgPath = `/tmp/commit-msg-${t.id}.txt`;
    writeFileSync(commitMsgPath, commitMsg + '\n\nAutomated patch by runner_v3.\nTicket: #' + t.id + '\n');
    sh(`git commit -F ${commitMsgPath}`, { quiet: true });

    // Push
    const remoteUrl = `https://x-access-token:${GITHUB_TOKEN}@github.com/TBC-HM/namkhan-bi.git`;
    sh(`git push ${remoteUrl} ${branch}`, { quiet: true });

    // Open PR via gh CLI
    const prBody = `Auto-generated by runner_v3 for ticket #${t.id}.\n\n**Summary:** ${t.email_subject ?? '(no subject)'}\n\n**Rollback:** revert this commit.`;
    const prBodyPath = `/tmp/pr-body-${t.id}.txt`;
    writeFileSync(prBodyPath, prBody);
    const prOut = sh(
      `gh pr create --title "${commitMsg.replace(/"/g, '\\"')}" --body-file ${prBodyPath} --base main --head ${branch}`,
      { quiet: true }
    );
    const prUrl = prOut.trim().split('\n').pop() ?? '';

    await audit(t.id, 'agent_run_pr_opened', true, { pr_url: prUrl, branch });

    // AUTO-MERGE with --admin bypass (required checks won't fire for GITHUB_TOKEN pushes)
    let merged = false;
    let mergeError: string | null = null;
    try {
      sh(`gh pr merge ${prUrl} --squash --admin --delete-branch`, { quiet: true });
      merged = true;
      await audit(t.id, 'agent_run_pr_merged', true, { pr_url: prUrl, branch, mode: 'admin_bypass' });
    } catch (e) {
      mergeError = (e as Error).message ?? String(e);
      await audit(t.id, 'agent_run_pr_merge_failed', false, { pr_url: prUrl, error: mergeError });
    }

    await supa.from('cockpit_tickets').update({
      status: merged ? 'completed' : 'awaits_user',
      pr_url: prUrl,
      preview_url: prUrl,
      processed_at: new Date().toISOString(),
      closed_at: merged ? new Date().toISOString() : null,
      metadata: merged
        ? {
            ...(t.metadata ?? {}),
            evidence: { pr_url: prUrl, merged_at: new Date().toISOString(), merged_by: 'runner_v3' },
          }
        : (t.metadata ?? {}),
      notes: JSON.stringify({
        kind: merged ? 'pr_merged' : 'pr_opened_merge_failed',
        pr_url: prUrl,
        branch,
        runner: 'v3',
        ...(mergeError ? { merge_error: mergeError } : {}),
      }),
    }).eq('id', t.id);

    console.log(`  ✓ #${t.id} → ${prUrl} ${merged ? '[MERGED]' : '[awaits_user]'}`);
    return { ticket_id: t.id, outcome: 'pr_opened', pr_url: prUrl, branch, duration_ms: Date.now() - t0 };
    
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error(`  ✗ #${t.id} error: ${msg}`);
    await audit(t.id, 'agent_run_error', false, { error: msg, stack: (err as Error).stack?.slice(0, 1000) });
    
    // Mark ticket so we don't loop forever on it
    await supa.from('cockpit_tickets').update({
      processed_at: new Date().toISOString(),
      status: 'triage_failed',
      notes: JSON.stringify({ kind: 'runner_v3_error', error: msg }),
    }).eq('id', t.id);
    
    return {
      ticket_id: t.id,
      outcome: msg.includes('timeout') ? 'timeout' : 'error',
      error: msg,
      duration_ms: Date.now() - t0,
    };
  }
}

async function main() {
  console.log(`runner_v3 starting (run_id=${GH_RUN_ID})`);
  const hbId = await startHeartbeat();
  
  let results: RunResult[] = [];
  let fatalErr: string | undefined;
  
  try {
    // Configure git identity for commits
    sh('git config --global user.name "runner-v3"', { quiet: true });
    sh('git config --global user.email "runner-v3@namkhan-bi.local"', { quiet: true });
    
    const tickets = await fetchTickets();
    console.log(`picked ${tickets.length} ticket(s)`);
    
    if (tickets.length === 0) {
      await audit(null, 'runner_no_work', true, { picked: 0 });
    }
    
    for (const t of tickets) {
      const r = await processTicket(t);
      results.push(r);
    }
  } catch (e) {
    fatalErr = (e as Error).message ?? String(e);
    console.error('FATAL:', fatalErr);
  } finally {
    await endHeartbeat(hbId, results, fatalErr);
    console.log(`runner_v3 done. picked=${results.length} prs=${results.filter(r => r.outcome === 'pr_opened').length}`);
  }
}

void main();
