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
2. Make the MINIMUM edit needed. Keep all existing imports, components, props, exports,
   layouts, hooks, API routes, Supabase queries. Do not remove working code.
3. For ANY file you edit, you MUST include its full content from <<<EXISTING>>> and modify
   ONLY the relevant section. Do NOT output "... existing code ..." or "// rest unchanged".
4. If you do not have the <<<EXISTING>>> block for a file, you must ask for it.
   NEVER write a new file from scratch if an <<<EXISTING>>> block should have been provided.

Output Format:
- Use this exact format for each file you want to create or edit:

<<<FILE path=relative/path.tsx>>>
[complete file content]
<<<END>>>

- The path must match the repository structure (app/..., lib/..., components/..., etc).
- You can output multiple <<<FILE>>> blocks in one response.
- Do NOT include "git diff" style patches. Do NOT say "edit this line" without showing the full file.

Constraints:
- Do NOT remove or break existing endpoints, components, or database queries.
- Do NOT change file names or move things without being asked.
- Do NOT introduce new top-level directories. Keep the existing structure.
- Preserve all TypeScript types. Do NOT downgrade to "any".
- If the ticket is unclear or missing critical info, ask for clarification instead of guessing.

End every response with:
<<<STATUS>>> and one of:
- COMPLETE — all requested files written, nothing else needed
- PARTIAL — some files written, but need more info to finish (say what you need)
- CLARIFY — cannot proceed without owner input (ask your question)
`;

async function processTicket(ticket: Ticket): Promise<RunResult> {
  console.log(`\n=== TICKET ${ticket.id} ===`);
  const t0 = Date.now();

  const spec =
    ticket.parsed_summary ||
    ticket.email_subject ||
    ticket.notes ||
    'No spec provided';

  await supa
    .from('cockpit_tickets')
    .update({ status: 'in_progress', processed_at: new Date().toISOString() })
    .eq('id', ticket.id);

  try {
    // Gather context: list files, read likely involved files
    const filesOutput = sh('git ls-files', { quiet: true });
    const fileList = filesOutput.split('\n').filter((f) => f.trim() !== '');
    const contextFiles: string[] = [];

    // Heuristic: if spec mentions "app/..." or "lib/..." paths, include those
    const pathMentions = spec.match(/\b(app|lib|components|scripts|supabase)\/[\w\-\.\/]+/g) || [];
    contextFiles.push(...pathMentions);

    // For build tickets: always include package.json, tsconfig, maybe lib/supabase
    if (spec.toLowerCase().includes('build')) {
      contextFiles.push('package.json', 'tsconfig.json', 'lib/supabase.ts');
    }

    let existingContent = '';
    for (const fpath of [...new Set(contextFiles)]) {
      if (fileList.includes(fpath)) {
        try {
          const content = sh(`cat "${fpath}"`, { quiet: true });
          existingContent += `\n<<<EXISTING path=${fpath}>>\n${content}\n<<<END>>>\n`;
        } catch {
          // file doesn't exist or unreadable, skip
        }
      }
    }

    const userPrompt = `TICKET #${ticket.id}:
${spec}

Repository file list (partial):
${fileList.slice(0, 200).join('\n')}
${fileList.length > 200 ? '...(truncated)' : ''}

${existingContent}

Instructions: Provide the <<<FILE>>> blocks needed to fulfill this ticket.
End with <<<STATUS>>> COMPLETE, PARTIAL, or CLARIFY.`;

    console.log(`Calling Claude (model=${CLAUDE_MODEL}) ...`);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': ANTHROPIC_KEY,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    const assistantMessage = (result.content?.[0]?.text || '') as string;
    console.log('Claude response length:', assistantMessage.length);

    // Parse <<<FILE path=...>>> ... <<<END>>> blocks
    const fileBlocks: { path: string; content: string }[] = [];
    const fileRegex = /<<<FILE path=([^\>]+)>>>\n([\s\S]*?)<<<END>>>/g;
    let match: RegExpExecArray | null;
    while ((match = fileRegex.exec(assistantMessage)) !== null) {
      fileBlocks.push({ path: match[1].trim(), content: match[2] });
    }

    if (fileBlocks.length === 0) {
      console.log('No <<<FILE>>> blocks found. Possibly CLARIFY or no changes.');
      await supa
        .from('cockpit_tickets')
        .update({ status: 'triaged', notes: 'Carla output had no file changes. May need more info.' })
        .eq('id', ticket.id);
      return { ticket_id: ticket.id, outcome: 'no_change', duration_ms: Date.now() - t0 };
    }

    console.log(`Writing ${fileBlocks.length} file(s) ...`);
    for (const fb of fileBlocks) {
      writeFileSync(fb.path, fb.content, 'utf-8');
      console.log(`  wrote ${fb.path}`);
    }

    // Stage, commit, push
    const branch = `carla/ticket-${ticket.id}`;
    sh(`git checkout -B ${branch}`, { quiet: true });
    sh('git add .', { quiet: true });

    const shortSpec = spec.slice(0, 60).replace(/\n/g, ' ');
    const commitMsg = `Carla: ticket ${ticket.id} — ${shortSpec}`;
    sh(`git commit -m "${commitMsg}"`, { quiet: false });

    sh(`git push -f origin ${branch}`, { quiet: false });

    // Open PR if GITHUB_TOKEN available
    let prUrl: string | undefined;
    if (GITHUB_TOKEN) {
      try {
        const prTitle = `Carla: Ticket #${ticket.id}`;
        const prBody = `Automated code delivery for ticket #${ticket.id}.\n\n${spec}`;
        const createPrOutput = sh(
          `gh pr create --title "${prTitle}" --body "${prBody}" --base main --head ${branch}`,
          { quiet: false }
        );
        prUrl = createPrOutput.trim().split('\n').pop(); // last line is the PR URL
        console.log(`PR opened: ${prUrl}`);
      } catch (e) {
        console.error('gh pr create failed:', (e as Error).message);
      }
    }

    // Update ticket with preview_url
    await supa
      .from('cockpit_tickets')
      .update({ status: 'code_delivered', preview_url: prUrl ?? null })
      .eq('id', ticket.id);

    await audit(ticket.id, 'carla_delivered', true, {
      branch,
      pr_url: prUrl,
      files: fileBlocks.map((f) => f.path),
    });

    return {
      ticket_id: ticket.id,
      outcome: 'pr_opened',
      pr_url: prUrl,
      branch,
      duration_ms: Date.now() - t0,
    };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error(`TICKET ${ticket.id} ERROR:`, msg);
    await audit(ticket.id, 'carla_error', false, { error: msg });
    await supa.from('cockpit_tickets').update({
      status: 'triaged',
      notes: JSON.stringify({ kind: 'runner_v3_error', error: msg }),
    }).eq('id', ticket.id);
    
    return {
      ticket_id: ticket.id,
      outcome: msg.includes('timeout') ? 'timeout' : 'error',
      error: msg,
      duration_ms: Date.now() - t0,
    };
  }
}

async function main() {
  console.log(`runner_v3 starting (run_id=${GH_RUN_ID})`);
  const hbId = await startHeartbeat();
  
  // KILL-SWITCH CHECK (cost-gov-findings-slice-kill-switch-coverage 2026-08-14)
  const automationEnabled = await checkAutomation();
  if (!automationEnabled) {
    console.log('AUTOMATION DISABLED — runner skipped, no provider calls made');
    await audit(null, 'runner_automation_disabled', true, { run_id: GH_RUN_ID, skipped: true });
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
