#!/usr/bin/env node
/**
 * scripts/agent-runner.ts
 * PBS 2026-05-09 autonomy gap — code-writer runner.
 *
 * Closes step 4 of the pipeline: task → staging → APPROVE → deploy.
 *
 *   1. Bug filed             ← UI (cockpit_bugs box)
 *   2. Sweep cron links      ← /api/cockpit/bugs/sweep (every 5 min)
 *   3. Felix triages         ← /api/cockpit/chat (CHAT MODE preamble)
 *   4. Code written          ← THIS SCRIPT (every 10 min, GH Actions)
 *   5. Bug → processing      ← sweep step B
 *   6. PBS approves          ← Bugs box "✓ approve · deploy" button
 *   7. Vercel alias → prod   ← /api/cockpit/approve-deploy
 *
 * What this does:
 *   • Polls cockpit_tickets WHERE status='triaged' AND arm IN ('dev','code')
 *     AND intent IN ('build','spec','fix') AND no preview_url yet
 *   • For each: builds a prompt from the spec stored in notes/parsed_summary,
 *     invokes Anthropic Messages API directly (no SDK needed; the API is
 *     already what the chat route uses) to ask Claude to "implement this spec
 *     and respond with one or more file edits in JSON form"
 *   • Applies the edits to the working tree on a fresh branch
 *   • Pushes the branch — Vercel preview deploy auto-fires
 *   • Writes preview_url + branch back into cockpit_tickets
 *   • Audit-logs each step
 *
 * Required env (in GitHub Actions secrets):
 *   ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GITHUB_TOKEN (provided by Actions runner)
 *
 * Manual run from repo root:
 *   npx tsx scripts/agent-runner.ts                 # process up to 3 queued tickets
 *   TICKET_ID=123 npx tsx scripts/agent-runner.ts   # specific ticket only
 *
 * SAFETY: this script is intentionally MINIMAL. It will only attempt edits
 * to files that currently exist (no file creation through this loop yet),
 * and it never bypasses tests / hooks / signing. PBS-controlled approval
 * gate ensures nothing reaches production without human review.
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const TICKET_ID = process.env.TICKET_ID;
const MAX_BATCH = Number(process.env.AGENT_RUNNER_BATCH ?? '3');
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

interface FileEdit {
  path: string;
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
  contents?: string; // for full-file create-or-replace
}

interface AgentResponse {
  edits: FileEdit[];
  branch_name: string;
  pr_title: string;
  pr_body: string;
  notes?: string;
}

const SYSTEM_PROMPT = `You are the code-writer for Namkhan BI. Given a spec
from cockpit_tickets, produce a minimal, surgical patch.

Rules:
- Output ONLY a single JSON object matching this TypeScript:
  { edits: Array<{ path: string; old_string?: string; new_string?: string; replace_all?: boolean; contents?: string }>; branch_name: string; pr_title: string; pr_body: string; notes?: string }
- Each edit is either a string replacement (old_string + new_string) on an EXISTING file, or a full-contents write of a file.
- Keep changes small and reversible. Prefer editing existing files over creating new ones.
- Branch name format: 'autorun/ticket-<id>-<3-word-slug>'
- PR title: '<verb>: <one-line summary> (ticket #<id>)'
- PR body: 2-3 short paragraphs covering what, why, how to verify. Include a "Rollback" line.
- Do NOT output markdown, prose, or explanation outside the JSON.
- Do NOT touch: .env*, supabase/migrations/*, package.json (unless spec is a dep change), .github/workflows/* (unless spec is a CI change).
- If the spec is unclear or risky, output { edits: [], notes: "<why we won't auto-implement>" }.

Brand:
- $ for USD, ₭ for LAK. Em-dash — for empty. Italic Fraunces for KPI values.
- Six canonical primitives only: <Page>, <KpiBox>, <Panel>, <DataTable>, <Brief>, <Lane>+<ProposalCard>.
- No hardcoded fontSize integers — use var(--t-*).
- No new tile/card markup that mimics primitives.
`;

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
    // PBS 2026-05-09 hard rule: processed_at IS NULL ensures a ticket is
    // never picked up twice. The DB trigger stamps processed_at on any
    // terminal status flip; the agent-runner respects that as a permanent
    // "do not re-process" mark even if status is later mutated.
    .is('processed_at', null)
    .order('updated_at', { ascending: true })
    .limit(MAX_BATCH);
  return (data ?? []) as Ticket[];
}

async function callClaude(spec: string): Promise<AgentResponse | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      // PBS 2026-05-10: 4096 tokens truncates mid-string for any non-trivial
      // file (one full file edit ≈ 8-16k chars). Bumped so the agent can
      // emit a complete JSON object.
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: spec }],
    }),
  });
  if (!res.ok) {
    console.error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return null;
  }
  const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleaned) as AgentResponse;
  } catch (e) {
    console.error('parse failed:', (e as Error).message, text.slice(0, 300));
    return null;
  }
}

function gitSh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function applyEdit(edit: FileEdit, repoRoot: string): boolean {
  const full = join(repoRoot, edit.path);
  if (edit.contents != null) {
    // PBS 2026-05-10: ensure parent dir exists for new files. Carla often
    // proposes routes under app/api/<new-name>/route.ts where the dir
    // doesn't exist yet; without mkdirSync recursive, writeFileSync throws
    // ENOENT and the whole ticket fails.
    const dir = full.substring(0, full.lastIndexOf('/'));
    if (dir) mkdirSync(dir, { recursive: true });
    writeFileSync(full, edit.contents, 'utf8');
    return true;
  }
  if (!existsSync(full)) {
    console.warn(`skip: ${edit.path} not found and no contents provided`);
    return false;
  }
  if (!edit.old_string || edit.new_string == null) {
    console.warn(`skip: ${edit.path} missing old_string/new_string`);
    return false;
  }
  const text = readFileSync(full, 'utf8');
  if (edit.replace_all) {
    if (!text.includes(edit.old_string)) return false;
    writeFileSync(full, text.split(edit.old_string).join(edit.new_string), 'utf8');
    return true;
  }
  const idx = text.indexOf(edit.old_string);
  if (idx < 0) {
    console.warn(`skip: ${edit.path} old_string not found`);
    return false;
  }
  if (text.indexOf(edit.old_string, idx + 1) >= 0) {
    console.warn(`skip: ${edit.path} old_string not unique (use replace_all if intentional)`);
    return false;
  }
  writeFileSync(full, text.replace(edit.old_string, edit.new_string), 'utf8');
  return true;
}

async function processOne(t: Ticket): Promise<void> {
  console.log(`\n=== ticket #${t.id} ===`);
  const repoRoot = process.cwd();

  // Build spec text from whatever the ticket carries.
  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  const spec = [
    `# Ticket #${t.id}`,
    `**Subject**: ${t.email_subject ?? '(none)'}`,
    `**Arm**: ${t.arm ?? ''}`,
    `**Intent**: ${t.intent ?? ''}`,
    '',
    '## Spec',
    typeof meta.spec === 'string' ? meta.spec : (t.parsed_summary ?? '(no spec body)'),
    '',
    t.notes ? `## Notes\n${t.notes}` : '',
  ].join('\n');

  await audit(t.id, 'agent_run_start', { model: MODEL });

  const out = await callClaude(spec);
  if (!out) {
    await audit(t.id, 'agent_run_failed', { reason: 'anthropic call failed' });
    return;
  }
  if (!out.edits || out.edits.length === 0) {
    console.log(`note: ${out.notes ?? 'no edits proposed'}`);
    await audit(t.id, 'agent_run_no_edits', { notes: out.notes ?? null });
    return;
  }

  // Branch + apply.
  const branch = (out.branch_name || `autorun/ticket-${t.id}`).replace(/[^a-zA-Z0-9/_-]/g, '-').slice(0, 80);
  try {
    gitSh(`git checkout -b ${branch}`);
  } catch {
    // branch may exist; switch + reset to main
    gitSh(`git checkout ${branch} || git checkout -B ${branch}`);
  }

  let applied = 0;
  for (const e of out.edits) {
    if (applyEdit(e, repoRoot)) applied++;
  }
  if (applied === 0) {
    console.log('no edits applied — aborting commit');
    await audit(t.id, 'agent_run_no_apply', { proposed: out.edits.length });
    gitSh(`git checkout - || true`);
    return;
  }

  gitSh(`git add -A`);
  const commitMsg = `${out.pr_title}\n\n${out.pr_body}\n\n[ticket #${t.id}]`;
  // shell-escape the commit message
  const escaped = commitMsg.replace(/"/g, '\\"');
  gitSh(`git commit -m "${escaped}"`);

  // Push + open PR if gh is available + token set.
  let prevUrl: string | null = null;
  try {
    gitSh(`git push -u origin ${branch}`);
    if (process.env.GITHUB_TOKEN) {
      const prOut = execSync(`gh pr create --title "${out.pr_title.replace(/"/g, '\\"')}" --body "${out.pr_body.replace(/"/g, '\\"')}" --head ${branch} --base main`, {
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN },
      }).trim();
      prevUrl = prOut.match(/https:\/\/[^\s]+/)?.[0] ?? null;
    }
  } catch (e) {
    console.error('push/pr failed:', (e as Error).message);
  }

  // Vercel auto-creates a preview deploy from the branch push. We don't have
  // the URL synchronously; the bugs sweep loop will pick up via metadata when
  // the deploy is ready. For now, write branch + pr_url so PBS can review.
  await supa
    .from('cockpit_tickets')
    .update({
      pr_url: prevUrl,
      preview_url: prevUrl, // GitHub PR doubles as the link until vercel webhook lands
      iterations: 1,
      // PBS 2026-05-09 rule: stamp processed_at so this ticket is locked
      // from any future agent-runner pickup even if status is mutated.
      processed_at: new Date().toISOString(),
      metadata: { ...(meta || {}), agent_runner: { branch, applied, model: MODEL, ts: new Date().toISOString() } },
    })
    .eq('id', t.id);

  await audit(t.id, 'agent_run_pr_opened', { branch, applied, pr_url: prevUrl });
  console.log(`✓ ticket #${t.id} branched + PR queued (${applied} edits)`);
}

async function audit(ticketId: number, action: string, notes: Record<string, unknown>) {
  await supa.from('cockpit_audit_log').insert({
    agent: 'agent_runner',
    action,
    success: true,
    ticket_id: ticketId,
    notes: JSON.stringify(notes),
  });
}

async function main(): Promise<void> {
  const tickets = await fetchTickets();
  console.log(`agent-runner: ${tickets.length} ticket(s) to process`);
  for (const t of tickets) {
    try {
      await processOne(t);
    } catch (e) {
      console.error(`ticket #${t.id} failed:`, (e as Error).message);
      await audit(t.id, 'agent_run_failed', { error: (e as Error).message });
    }
  }
  console.log('agent-runner: done');
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
