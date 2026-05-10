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
const BATCH = Number(process.env.RUNNER_BATCH ?? '3');
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
- A short view of the repo file tree (top-level dirs)

You MUST output a valid unified diff that can be applied with \`git apply\`.
Output ONLY the diff, no commentary, no markdown fences.

Rules:
- Surgical patches only. Minimal scope. One ticket = one focused change.
- Match existing code style. Tailwind for styling. TypeScript strict.
- Never touch: .env*, package.json, .github/workflows/*, supabase/migrations/*.
- Brand: '$' for USD, '₭' for LAK, em-dash '—' for empty. Italic Fraunces for KPI values.
- NEVER push back. If the spec is thin, pick reasonable defaults and ship something.
- If you cannot produce a useful diff, output the single line: NO_DIFF
  (Do this only when the request would require creating new pages/routes from scratch with no signal where.)

OUTPUT FORMAT — ONLY THE DIFF:
\`\`\`
diff --git a/path/to/file.tsx b/path/to/file.tsx
--- a/path/to/file.tsx
+++ b/path/to/file.tsx
@@ -10,3 +10,6 @@
 existing line
+new line
+another new line
 existing line
\`\`\`
(but without the markdown fences — just raw diff)`;

function repoSnapshot(): string {
  try {
    const dirs = sh('ls -la', { quiet: true });
    const appDirs = sh('ls app/ 2>/dev/null || true', { quiet: true });
    const componentsDirs = sh('ls components/ 2>/dev/null || true', { quiet: true });
    return `Top-level:\n${dirs}\n\napp/:\n${appDirs}\n\ncomponents/:\n${componentsDirs}`;
  } catch (e) {
    return 'repo snapshot failed';
  }
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
      max_tokens: 4096,
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
    const userPrompt = `TICKET #${t.id}\n\nSubject: ${t.email_subject ?? ''}\n\nSummary:\n${t.parsed_summary ?? ''}\n\nNotes (PBS answers if any):\n${t.notes ?? ''}\n\n---\n\nRepo snapshot:\n${repoSnapshot()}`;

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

    // Try to extract diff if wrapped in fences
    let diff = text.trim();
    const fenceMatch = diff.match(/```(?:diff)?\n([\s\S]*?)\n```/);
    if (fenceMatch) diff = fenceMatch[1];

    // Apply diff
    const slug = String(t.id) + '-' + Math.random().toString(36).slice(2, 8);
    const branch = `autorun/ticket-${slug}`;
    sh(`git checkout -b ${branch}`, { quiet: true });

    const diffPath = `/tmp/ticket-${t.id}.diff`;
    writeFileSync(diffPath, diff + '\n');
    
    try {
      sh(`git apply --check ${diffPath}`, { quiet: true });
    } catch (e) {
      console.error(`diff did not apply cleanly for #${t.id}`);
      sh(`git checkout main && git branch -D ${branch}`, { quiet: true });
      await audit(t.id, 'agent_run_diff_failed', false, { error: (e as Error).message });
      await supa.from('cockpit_tickets').update({
        status: 'awaits_user',
        processed_at: new Date().toISOString(),
        notes: JSON.stringify({ kind: 'diff_failed', diff_preview: diff.slice(0, 500) }),
      }).eq('id', t.id);
      return { ticket_id: t.id, outcome: 'error', error: 'diff did not apply', duration_ms: Date.now() - t0 };
    }
    
    sh(`git apply ${diffPath}`, { quiet: true });
    sh('git add -A', { quiet: true });
    
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
    await supa.from('cockpit_tickets').update({
      status: 'awaits_user',
      pr_url: prUrl,
      preview_url: prUrl,
      processed_at: new Date().toISOString(),
      notes: JSON.stringify({ kind: 'pr_opened', pr_url: prUrl, branch, runner: 'v3' }),
    }).eq('id', t.id);

    console.log(`  ✓ #${t.id} → ${prUrl}`);
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
