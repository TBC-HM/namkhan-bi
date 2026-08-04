#!/usr/bin/env node
/**
 * scripts/brief-builder-agent.ts — GHA brief-builder agent loop
 * (owner-signal-responder-v1 design item 3 / A3, 2026-08-04)
 *
 * Fired by .github/workflows/brief-builder.yml (workflow_dispatch from
 * public.fn_owner_signal_sweep). Claims ONE build brief via fn_builder_claim,
 * then runs a bounded Claude tool-use loop to build one coherent slice under
 * the standing-builder laws. All DB access goes through the service-role-only
 * bridge public.fn_builder_sql (one statement per call, audited); shell access
 * is the CI checkout only (tsc gate, esbuild parse). GitHub pushes happen via
 * SELECT public.fn_gh_push_file(...) inside run_sql — never git push.
 *
 * Deliberately NOT runner-v3: that is a single-shot ticket-diff generator.
 * This is a multi-turn loop because brief work is DB-first (migrations,
 * bridges, verification queries) with occasional file pushes.
 *
 * ENV: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      BRIEF_SLUG (required), BUILDER_MODEL (optional), GITHUB_RUN_ID
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const BRIEF_SLUG = process.env.BRIEF_SLUG!;
const MODEL = process.env.BUILDER_MODEL ?? 'claude-sonnet-4-5-20250929';
const RUN_ID = process.env.GITHUB_RUN_ID ?? 'local';
const WORKER = `gha-brief-builder-${RUN_ID}`;

const MAX_TURNS = 60;
const WALL_MS = 65 * 60 * 1000; // 65 min — workflow timeout is 75
const STARTED = Date.now();

if (!SUPABASE_URL || !SERVICE_ROLE) fail('missing supabase env');
if (!ANTHROPIC_KEY) fail('missing ANTHROPIC_API_KEY');
if (!BRIEF_SLUG) fail('missing BRIEF_SLUG');

const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

function fail(msg: string): never {
  console.error('FATAL:', msg);
  process.exit(1);
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const { data, error } = await supa.rpc(fn, args);
  if (error) throw new Error(`rpc ${fn}: ${error.message}`);
  return data;
}

async function sql(q: string): Promise<any> {
  return rpc('fn_builder_sql', { p_sql: q });
}

function sqlLit(s: string): string {
  return `$brf$${s}$brf$`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + `\n…[truncated ${s.length - n} chars]` : s;
}

const SYSTEM = `You are the GHA brief-builder for The Beyond Circle platform (Supabase namkhan-pms). You have claimed build brief "${BRIEF_SLUG}" and must build ONE coherent slice of it, then close cleanly.

HARD LAWS (violations burn the platform — obey exactly):
- ONE brief, one slice. Batch as many of the brief's open gaps as fit your budget, but never half-push an inconsistent state.
- SQL: one statement per run_sql call. SELECT-shaped calls return rows; DDL/DML return ok. Discover before create (query information_schema / existing objects first). Never DROP outside the brief's scope.
- GitHub: pushes ONLY via SELECT public.fn_gh_push_file('TBC-HM','namkhan-bi','main', path, content, message) inside run_sql (dollar-quote the content; NEVER sql-escape JSX with replace()). After every push, verify: SELECT status_code, left(content,120) FROM net._http_response WHERE id = <request_id> (the fn returns request_id; response lands in a LATER call — pg_net two-phase). HOT files (governance.push_hot_files: groups.ts, globals.css, hod_subpages_catalog.ts, nav-subgroups.ts) need SELECT public.fn_gh_declare_read(path) first. NEVER run git push / gh in run_shell.
- tsc gate: before any code push, run_shell "npx tsc --noEmit" in the checkout (it contains current main) — must be green. Edit files in the checkout with run_shell (heredoc/sed carefully) to test, but the PUSH still goes through fn_gh_push_file with the full file content.
- DB changes: only what the brief scopes. New objects need service_role grants + public.v_*/fn_* bridges (PostgREST exposes only public).
- No product decisions: if the brief needs an owner choice, set the brief status='needs_input' with the exact question (plain hotel-owner language, 2-4 options, one recommended) via run_sql, then finish(status='needs_input').
- Never self-grade: do NOT write completion_estimate or gap_list — the verifier does. Never claim tested without executed evidence.
- Update forward, never overwrite: append your build log; bump version.

WORKFLOW:
1. Read the brief (already provided). Identify the highest-value open gaps (look for §0.V objections / BUILD LOG remaining items).
2. Build. Verify each step with real queries/commands — evidence, not intent.
3. When done or out of budget, call finish with a build-log summary: what shipped (with object names, request ids, evidence), what remains, exact next-gap instructions.

Budget: ~${Math.round(WALL_MS / 60000)} min wall, ${MAX_TURNS} turns. Heartbeats are automatic. Work fast, verify hard.`;

const TOOLS = [
  {
    name: 'run_sql',
    description:
      'Run ONE SQL statement on namkhan-pms via the audited service-role bridge. SELECT-shaped statements return {ok,rows:[...]}. DDL/DML return {ok,note}. Errors return {ok:false,error}.',
    input_schema: {
      type: 'object',
      properties: { sql: { type: 'string', description: 'a single SQL statement' } },
      required: ['sql'],
    },
  },
  {
    name: 'run_shell',
    description:
      'Run a shell command in the repo checkout (current main). Use for npx tsc --noEmit, npx esbuild parse checks, reading files (cat/sed), scratch edits for local verification. NO git push / gh / network writes. 8-min timeout.',
    input_schema: {
      type: 'object',
      properties: { cmd: { type: 'string' } },
      required: ['cmd'],
    },
  },
  {
    name: 'finish',
    description:
      'End the run. status: "verifying" (full slice done, verifier grades next), "ready" (partial slice, more builder rounds needed), or "needs_input" (owner question parked on the brief). summary: the build log appended verbatim to the brief.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['verifying', 'ready', 'needs_input'] },
        summary: { type: 'string' },
      },
      required: ['status', 'summary'],
    },
  },
];

async function anthropic(messages: any[]): Promise<any> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM,
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`anthropic ${res.status}: ${errText.slice(0, 300)}`);
  }
  return res.json();
}

async function main() {
  // kill switch
  const ks = await sql('SELECT public.fn_automation_enabled() AS enabled');
  if (!ks?.ok || ks.rows?.[0]?.enabled !== true) {
    console.log('automation disabled — exiting');
    return;
  }

  // claim
  const claim = await rpc('fn_builder_claim', {
    p_slug: BRIEF_SLUG,
    p_worker_id: WORKER,
    p_lease_seconds: 900,
  });
  if (!claim?.ok) {
    console.log('brief already claimed — exiting clean:', JSON.stringify(claim));
    return;
  }
  const hb = claim.heartbeat_id as number;
  console.log(`claimed ${BRIEF_SLUG}, heartbeat ${hb}`);

  let finished = false;
  try {
    // brief + status guard
    const briefRes = await sql(
      `SELECT content_md, version, status FROM documentation.build_briefs WHERE slug = ${sqlLit(BRIEF_SLUG)}`
    );
    const brief = briefRes?.rows?.[0];
    if (!brief) throw new Error('brief not found');
    await sql(
      `UPDATE documentation.build_briefs SET status='in_progress' WHERE slug = ${sqlLit(BRIEF_SLUG)} AND status='ready'`
    );

    // law 763: module spec doc must exist at build start
    const q = await sql(
      `SELECT module_doc_type FROM governance.module_completion_queue WHERE brief_slug = ${sqlLit(BRIEF_SLUG)}`
    );
    const moduleDocType = q?.rows?.[0]?.module_doc_type as string | undefined;
    let law763Note = 'no module_completion_queue row — law 763 doc check n/a';
    if (moduleDocType) {
      const d = await sql(
        `SELECT 1 AS x FROM documentation.documents WHERE doc_type::text = ${sqlLit(moduleDocType)}`
      );
      law763Note = d?.rows?.length
        ? `law 763 OK — spec doc '${moduleDocType}' exists`
        : `law 763 GAP — no spec doc '${moduleDocType}': CREATE IT FIRST (ALTER TYPE doc_type_enum ADD VALUE IF NOT EXISTS in one call, INSERT the v1 doc distilled from the brief in the next; status='published')`;
    }

    const messages: any[] = [
      {
        role: 'user',
        content: `BRIEF ${BRIEF_SLUG} (status ${brief.status}, v${brief.version}) — ${law763Note}\n\n${truncate(
          brief.content_md,
          60000
        )}\n\nBuild the highest-value open slice now.`,
      },
    ];

    let turns = 0;
    while (!finished && turns < MAX_TURNS && Date.now() - STARTED < WALL_MS) {
      turns++;
      const resp = await anthropic(messages);
      if (resp.stop_reason === 'max_tokens')
        throw new Error('model hit max_tokens — brief too complex for single slice');

      messages.push({ role: 'assistant', content: resp.content });

      const toolUses = (resp.content as any[]).filter((c) => c.type === 'tool_use');
      if (!toolUses.length) {
        // model stopped without finish — nudge once, then bail
        if (resp.stop_reason === 'end_turn') {
          messages.push({
            role: 'user',
            content: 'You must end with the finish tool (status + build-log summary). Call it now.',
          });
          continue;
        }
        break;
      }

      const results: any[] = [];
      for (const tu of toolUses) {
        let out = '';
        try {
          if (tu.name === 'run_sql') {
            const r = await sql(String(tu.input.sql ?? ''));
            out = truncate(JSON.stringify(r), 30000);
          } else if (tu.name === 'run_shell') {
            try {
              out = execSync(String(tu.input.cmd ?? ''), {
                timeout: 8 * 60 * 1000,
                encoding: 'utf8',
                maxBuffer: 20 * 1024 * 1024,
                stdio: ['ignore', 'pipe', 'pipe'],
              });
            } catch (e: any) {
              out = `EXIT ${e.status ?? '?'}\n${e.stdout ?? ''}\n${e.stderr ?? ''}`;
            }
            out = truncate(out, 20000);
          } else if (tu.name === 'finish') {
            const status = String(tu.input.status);
            const summary = String(tu.input.summary ?? '');
            await sql(
              `UPDATE documentation.build_briefs SET content_md = content_md || ${sqlLit(
                `\n\n## §0.B BUILD LOG — GHA brief-builder run ${RUN_ID} (${WORKER})\n\n${summary}\n`
              )}, version = version + 1, status = ${sqlLit(status)}, last_updated_at = now(), last_updated_by = ${sqlLit(
                WORKER
              )} WHERE slug = ${sqlLit(BRIEF_SLUG)}`
            );
            await rpc('fn_builder_done', {
              p_heartbeat_id: hb,
              p_status: 'done',
              p_note: truncate(summary, 500),
            });
            finished = true;
            out = 'finished';
          } else {
            out = `unknown tool ${tu.name}`;
          }
        } catch (e: any) {
          out = `TOOL ERROR: ${e.message}`;
        }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: out });
        try {
          await rpc('fn_builder_beat', {
            p_heartbeat_id: hb,
            p_step: truncate(`${tu.name}: ${JSON.stringify(tu.input).slice(0, 160)}`, 200),
          });
        } catch {
          /* heartbeat best-effort */
        }
        if (finished) break;
      }
      if (!finished) messages.push({ role: 'user', content: results });
    }

    if (!finished) {
      const reason = turns >= MAX_TURNS ? 'turn budget exhausted' : 'wall clock exhausted';
      console.error('run ended without finish:', reason);
      // ZOMBIE-LEAK FIX (owner-signal-responder-v1 §0.E): reset brief to ready so it can be re-fired
      await sql(
        `UPDATE documentation.build_briefs SET status = 'ready', content_md = content_md || ${sqlLit(
          `\n\n> BUILDER-FAILED (${WORKER}): ${reason} after ${turns} turns — brief reset to ready for retry.\n`
        )}, version = version + 1, last_updated_at = now(), last_updated_by = ${sqlLit(WORKER)} WHERE slug = ${sqlLit(
          BRIEF_SLUG
        )}`
      );
      await rpc('fn_builder_done', { p_heartbeat_id: hb, p_status: 'failed', p_note: reason });
      process.exitCode = 1;
    }
  } catch (e: any) {
    console.error('RUN ERROR:', e.message);
    try {
      await rpc('fn_builder_done', {
        p_heartbeat_id: hb,
        p_status: 'failed',
        p_note: truncate(`error: ${e.message}`, 400),
      });
    } catch {
      /* best effort */
    }
    process.exitCode = 1;
  }
}

main().catch((e) => fail(e.message));
