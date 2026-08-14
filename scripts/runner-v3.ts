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

async function checkAutomation(): Promise<boolean> {
  const { data, error } = await supa
    .from('v_automation_state')
    .select('enabled')
    .single();
  
  if (error) {
    console.error('AUTOMATION CHECK FAILED:', error.message);
    return false; // fail CLOSED: if we cannot read the switch, do not run
  }
  
  return data?.enabled ?? false;
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
      started_at: STARTED_AT.toISOString(),
      status: 'running',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('HEARTBEAT START FAILED:', error?.message);
    process.exit(1);
  }

  console.log(`HEARTBEAT STARTED: id=${data.id}`);
  return data.id;
}

async function updateHeartbeat(
  hbId: number,
  picked: number,
  processed: number,
  prs: number,
  status: 'running' | 'done' | 'error',
  errorMsg?: string
) {
  const { error } = await supa
    .from('cockpit_runner_heartbeat')
    .update({
      tickets_picked: picked,
      tickets_processed: processed,
      prs_opened: prs,
      finished_at: new Date().toISOString(),
      status,
      error_message: errorMsg,
    })
    .eq('id', hbId);

  if (error) console.error('HEARTBEAT UPDATE FAILED:', error.message);
}

async function fetchTickets(): Promise<Ticket[]> {
  let query = supa
    .from('cockpit_tickets')
    .select('id, parsed_summary, email_subject, notes, metadata')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH);

  if (TICKET_ID) {
    query = query.eq('id', TICKET_ID);
  }

  const { data, error } = await query;
  if (error) {
    console.error('FETCH TICKETS FAILED:', error.message);
    return [];
  }
  return data || [];
}

function buildPrompt(ticket: Ticket): string {
  const summary = ticket.parsed_summary || ticket.email_subject || '(no subject)';
  const notes = ticket.notes || 'No additional notes.';
  const meta = ticket.metadata ? JSON.stringify(ticket.metadata, null, 2) : '{}';

  return `
You are a dev agent. A user has sent this request:

SUMMARY: ${summary}

NOTES:
${notes}

METADATA:
${meta}

Return a JSON object with:
{
  "changes": [ {"file": "path/to/file.ts", "content": "full new content"} ],
  "commit_message": "one-liner describing the change"
}

If no code change is needed, return { "changes": [], "commit_message": "" }.
Do NOT push or deploy — just produce the file changes.
`;
}

async function processTicket(ticket: Ticket, timeout_ms: number): Promise<RunResult> {
  const start = Date.now();
  console.log(`\n=== TICKET ${ticket.id} ===`);

  let outcome: RunResult['outcome'] = 'error';
  let pr_url: string | undefined;
  let branch: string | undefined;
  let errMsg: string | undefined;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    console.warn(`TIMEOUT after ${timeout_ms}ms for ticket ${ticket.id}`);
    controller.abort();
  }, timeout_ms);

  try {
    const prompt = buildPrompt(ticket);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    if (!resp.ok) {
      const errText = await resp.text();
      errMsg = `Anthropic error ${resp.status}: ${errText}`;
      console.error(errMsg);
      outcome = 'error';
      return { ticket_id: ticket.id, outcome, error: errMsg, duration_ms: Date.now() - start };
    }

    const json = await resp.json();
    const textBlock = json.content?.find((c: any) => c.type === 'text');
    if (!textBlock) {
      errMsg = 'No text block in Claude response';
      console.error(errMsg);
      outcome = 'error';
      return { ticket_id: ticket.id, outcome, error: errMsg, duration_ms: Date.now() - start };
    }

    const raw = textBlock.text || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      errMsg = 'No JSON found in Claude response';
      console.error(errMsg);
      outcome = 'error';
      return { ticket_id: ticket.id, outcome, error: errMsg, duration_ms: Date.now() - start };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.changes || parsed.changes.length === 0) {
      console.log('No changes proposed → marking no_change');
      outcome = 'no_change';
      return { ticket_id: ticket.id, outcome, duration_ms: Date.now() - start };
    }

    // Write files
    for (const change of parsed.changes) {
      console.log(`Writing ${change.file}`);
      writeFileSync(change.file, change.content, 'utf-8');
    }

    // Commit and push
    branch = `ticket-${ticket.id}`;
    sh(`git checkout -b ${branch}`, { quiet: true });
    sh('git add -A', { quiet: true });
    sh(`git commit -m "${parsed.commit_message || 'auto commit'}"`, { quiet: true });
    sh(`git push origin ${branch}`, { quiet: true });

    // Open PR via gh CLI
    const prOut = sh(
      `gh pr create --base main --head ${branch} --title "Ticket #${ticket.id}: ${parsed.commit_message}" --body "Auto-generated by runner_v3"`,
      { quiet: true }
    );
    pr_url = prOut.trim();

    // Mark ticket as completed
    await supa
      .from('cockpit_tickets')
      .update({ status: 'completed', resolved_at: new Date().toISOString() })
      .eq('id', ticket.id);

    console.log(`PR opened: ${pr_url}`);
    outcome = 'pr_opened';

  } catch (err: any) {
    if (err.name === 'AbortError') {
      outcome = 'timeout';
      errMsg = 'Claude call timed out';
    } else {
      outcome = 'error';
      errMsg = err.message || String(err);
    }
    console.error('PROCESS ERROR:', errMsg);
  } finally {
    clearTimeout(timeoutHandle);
  }

  await audit(ticket.id, `ticket_${outcome}`, outcome !== 'error', { pr_url, branch, error: errMsg });
  return { ticket_id: ticket.id, outcome, pr_url, branch, error: errMsg, duration_ms: Date.now() - start };
}

async function main() {
  console.log(`runner_v3 starting (run_id=${GH_RUN_ID})`);
  const hbId = await startHeartbeat();
  
  // KILL-SWITCH CHECK (cost-gov-findings-slice-kill-switch-coverage 2026-08-14)
  const automationEnabled = await checkAutomation();
  if (!automationEnabled) {
    console.log('AUTOMATION DISABLED — runner skipped, no provider calls made');
    await audit(null, 'runner_automation_disabled', true, { run_id: GH_RUN_ID, skipped: true });
    
    // Log to scheduled_run_skipped for unified skip tracking (item 1, slice D)
    const { data: skipId, error: skipErr } = await supa.rpc('fn_scheduled_run_skip_log', {
      p_scheduler: 'github_actions',
      p_identifier: 'agent-runner',
      p_reason: 'automation_disabled',
      p_notes: JSON.stringify({ github_run_id: GH_RUN_ID })
    });
    if (skipErr) {
      console.error('Failed to log skip record:', skipErr.message);
    } else {
      console.log('Skip record logged: id =', skipId);
    }

    return; // exit early, do not fetch tickets or call Claude
  }
  
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
    
    await updateHeartbeat(hbId, tickets.length, 0, 0, 'running');
    
    for (const ticket of tickets) {
      const res = await processTicket(ticket, TICKET_TIMEOUT_MS);
      results.push(res);
    }
    
    const prs = results.filter(r => r.outcome === 'pr_opened').length;
    await updateHeartbeat(hbId, tickets.length, results.length, prs, 'done');
    
  } catch (err: any) {
    fatalErr = err.message || String(err);
    console.error('FATAL ERROR:', fatalErr);
    await updateHeartbeat(hbId, 0, 0, 0, 'error', fatalErr);
    await audit(null, 'runner_fatal', false, { error: fatalErr });
    process.exit(1);
  }
  
  console.log(`runner_v3 finished: ${results.length} tickets processed`);
}

main().catch(err => {
  console.error('UNCAUGHT:', err);
  process.exit(1);
});
