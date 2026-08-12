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
 * SELECT public.fn_gh_deploy_file(...) inside run_sql — never git push. That is the
 * mandated deploy route (L18); it wraps fn_gh_push_file, which holds the hot-file CAS,
 * protected-path gate, md5 verification, shrink guard and push_ledger write.
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
let METER_TURN = 0; // finding #87: idempotent run_ref counter for per-call metering

// ADR-240: 60 turns with no cache is what produced the 80:1 input:output ratio — cost grows with
// the SQUARE of turn count. 25 is enough for one coherent slice, which is all a builder may do.
// 2026-08-06 · 60 -> 25 this morning to stop the burn, 25 -> 40 tonight because 25
// was too few to finish anything: gha-brief-builder-31120629673 died on
// forecasting-module-v1 at 95 seconds with "turn budget exhausted". With prompt
// caching live (ADR-240) an extra turn re-reads cached context at ~10% of the old
// price, so turns are now the cheap axis and brief SIZE is the expensive one.
// The three 55-69k-char briefs still need slicing — this raise does not fix them.
const MAX_TURNS = 40;
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
- GitHub: pushes ONLY via SELECT public.fn_gh_deploy_file('TBC-HM','namkhan-bi','main', path, content, message, <prior_request_id_or_NULL>) inside run_sql (dollar-quote the content; NEVER sql-escape JSX with replace()). Pass NULL as the last argument for your FIRST push; for every push after that, pass the request_id returned by your PREVIOUS push — fn_gh_deploy_file verifies that earlier push as part of this call. This is the mandated deploy route (it wraps fn_gh_push_file, which carries the hot-file CAS, protected-path gate, md5 verification, shrink guard and push_ledger write). DO NOT spend a turn on "SELECT status_code FROM net._http_response WHERE id = ..." — pg_net is two-phase, the response is not there yet, and polling for it is what exhausts the turn budget (agent memory 852: a run landed lib/tenancy.ts and was then killed at turn 40 polling for its own verification). Any push you cannot verify inline is reconciled asynchronously into governance.push_ledger.verified; trust that. HOT files (governance.push_hot_files: groups.ts, globals.css, hod_subpages_catalog.ts, nav-subgroups.ts) still need SELECT public.fn_gh_declare_read(path) first. NEVER run git push / gh in run_shell.
- tsc gate: before any code push, run_shell "npx tsc --noEmit" in the checkout (it contains current main) — must be green. Edit files in the checkout with run_shell (heredoc/sed carefully) to test, but the PUSH still goes through fn_gh_deploy_file with the full file content.
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

/**
 * ADR-240 — put a cache breakpoint at the end of the conversation.
 * Anthropic caches the prefix UP TO a breakpoint, so marking the newest message means the next
 * turn reads everything before it from cache instead of paying full input price again.
 * Blocks under ~1024 tokens are not cacheable; the API ignores the marker rather than erroring.
 */
function withCache(messages: any[]): any[] {
  if (messages.length === 0) return messages;
  const out = messages.map((m) => ({ ...m }));
  const last: any = out[out.length - 1];
  if (Array.isArray(last.content) && last.content.length > 0) {
    last.content = last.content.map((b: any, i: number) =>
      i === last.content.length - 1 ? { ...b, cache_control: { type: 'ephemeral' } } : b);
  } else if (typeof last.content === 'string') {
    last.content = [{ type: 'text', text: last.content, cache_control: { type: 'ephemeral' } }];
  }
  return out;
}

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
      // ADR-240 (finding #92): prompt caching. Before this, every turn re-sent the ENTIRE
      // accumulated conversation at full input price. August 2026 ran 159.3M tokens IN against
      // 2.0M OUT — 80:1 — and ~94% of the money bought re-reads of context the model had already
      // seen. Cached input bills at 10% of base. Three breakpoints: the system prompt and the
      // tools array are static across all 25 turns, and withCache() moves a third breakpoint to
      // the end of the message list each turn so the whole prefix is a cache hit on the next one.
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS.map((t: any, i: number) =>
        i === TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t),
      messages: withCache(messages),
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`anthropic ${res.status}: ${errText.slice(0, 300)}`);
  }
  const json = await res.json();
  // ADR-230 §3 / finding #87: builders were invisible — 475 duplicate sessions over 7
  // days cost thousands while costs.ai_usage_events recorded $2.23 and cost_burn_alarm
  // watched a number that could not move. The 08-06 fix (raw INSERT into
  // costs.ai_usage_events) NEVER inserted a row: it omitted NOT NULL no-default columns
  // (provider_id, calculated_cost, idempotency_key) and the silent catch hid every
  // failure. Now: report via public.fn_ai_usage_report → public.ai_token_meter, and the
  // existing hourly ingest (costs.fn_ingest_ai_usage + ledger) flows it into
  // costs.ai_usage_events AND costs.cost_events consistently (parity preserved,
  // map-don't-duplicate). run_ref is idempotent per run+turn. Failures LOG — a broken
  // meter must be visible in the GHA log, never silent again — but never break a build.
  try {
    const u = json?.usage ?? {};
    METER_TURN++;
    const r = await rpc('fn_ai_usage_report', {
      p_agent_handle: WORKER,
      p_model: String(MODEL),
      p_tokens_in: Number(u.input_tokens ?? 0),
      p_tokens_cached: Number(u.cache_read_input_tokens ?? 0),
      p_tokens_out: Number(u.output_tokens ?? 0),
      p_run_ref: `gha:${RUN_ID}:t${METER_TURN}`,
      p_source: 'gha-brief-builder',
    });
    if (!r?.ok) console.error('METERING FAILED (non-fatal):', JSON.stringify(r));
  } catch (e: any) {
    console.error('METERING FAILED (non-fatal):', e?.message ?? e);
  }
  return json;
}

let BEAT_TIMER: any = null;
function startBeatTimer(hb: number) {
  BEAT_TIMER = setInterval(() => {
    rpc('fn_builder_beat', { p_heartbeat_id: hb, p_step: 'wall-clock beat' }).catch(() => {});
  }, 120_000);
  if (BEAT_TIMER.unref) BEAT_TIMER.unref();
}
function stopBeatTimer() { if (BEAT_TIMER) clearInterval(BEAT_TIMER); BEAT_TIMER = null; }

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
    // ADR-229: lease MUST exceed the workflow timeout (brief-builder.yml: 75 min).
    // At 900s a run was stealable 15 min in while still executing, so every later
    // dispatch re-claimed the SAME brief and burned another full paid session.
    // Measured 2026-08-05: fb_menu_module-owner-findings-v1 claimed 7x by 7 workers
    // in 5.5h; 55 builder sessions in 3h; ~EUR430 + a prior grant with $2.23 recorded.
    p_lease_seconds: 5400,
  });
  if (!claim?.ok) {
    console.log('brief already claimed — exiting clean:', JSON.stringify(claim));
    return;
  }
  const hb = claim.heartbeat_id as number;
  console.log(`claimed ${BRIEF_SLUG}, heartbeat ${hb}`);
  startBeatTimer(hb);   // ADR-230 §4

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
            out = truncate(JSON.stringify(r), 8000);
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
            out = truncate(out, 6000);
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

      // PARTIAL-BUILD ACCOUNTING (2026-08-12, agent memory 852).
      //
      // A run that pushed working code and then died in the pg_net push-verification
      // tail was still recorded as "> BUILDER-FAILED". Three such records auto-tag the
      // brief needs_slice (ADR-271), fn_owner_signal_sweep then excludes it from the
      // candidate query, and the brief leaves the dispatch queue permanently. That is
      // how 32 briefs sealed themselves and the loop idled for two days while logging
      // success=true.
      //
      // Proof this is real: run gha-brief-builder-31610419243 landed lib/tenancy.ts on
      // main (commit cb46c0b, governance.push_ledger id 1350, ok=true, http=200) at
      // 15:12:06 and was killed at turn 40 at 15:12:17 — eleven seconds later — while
      // running the push-verification SELECT the system prompt mandates.
      //
      // So: if an ok push landed during THIS run for THIS brief, annotate the outcome as
      // PARTIAL instead of FAILED. governance.fn_count_consecutive_builder_failures()
      // only counts lines beginning "> BUILDER-FAILED" and breaks its streak on any
      // non-empty line that does not start with ">", so a plain-text PARTIAL line
      // records the outcome honestly WITHOUT feeding the 3-strike sealer.
      //
      // Deliberately conservative:
      //   - only ok=true pushes, only since this run started, only matching this slug;
      //   - any error, empty result or unexpected shape falls through to the original
      //     "> BUILDER-FAILED" behaviour, so this can never mask a genuine failure;
      //   - fn_builder_done still reports 'failed' (the run DID fail to finish, and
      //     builder_heartbeats.status only permits running/done/failed/reclaimed).
      let landed: Array<{ id: number; path: string }> = [];
      try {
        const rows = await sql(
          `SELECT id, path FROM governance.push_ledger
            WHERE ok IS TRUE
              AND pushed_at >= ${sqlLit(new Date(STARTED).toISOString())}::timestamptz
              AND message LIKE ${sqlLit('%' + BRIEF_SLUG + '%')}
            ORDER BY id`
        );
        if (Array.isArray(rows)) landed = rows as Array<{ id: number; path: string }>;
      } catch (e: any) {
        console.error('partial-build check failed, defaulting to FAILED:', e?.message);
      }

      const outcomeNote = landed.length
        ? `\n\nBUILDER-PARTIAL (${WORKER}): ${reason} after ${turns} turns, but ${
            landed.length
          } push(es) LANDED on main during this run — ${landed
            .map((p) => `${p.path} (push_ledger ${p.id})`)
            .join(
              ', '
            )}. Recorded as PARTIAL, not failed: this run produced real work. DO NOT re-create those files on retry — continue from them. Brief reset to ready. See agent memory 852.\n`
        : `\n\n> BUILDER-FAILED (${WORKER}): ${reason} after ${turns} turns — brief reset to ready for retry.\n`;

      console.error(
        landed.length
          ? `recorded PARTIAL — ${landed.length} push(es) landed: ${landed.map((p) => p.path).join(', ')}`
          : 'recorded FAILED — no pushes landed this run'
      );

      // ZOMBIE-LEAK FIX (owner-signal-responder-v1 §0.E): reset brief to ready so it can be re-fired
      await sql(
        `UPDATE documentation.build_briefs SET status = 'ready', content_md = content_md || ${sqlLit(
          outcomeNote
        )}, version = version + 1, last_updated_at = now(), last_updated_by = ${sqlLit(WORKER)} WHERE slug = ${sqlLit(
          BRIEF_SLUG
        )}`
      );
      await rpc('fn_builder_done', {
        p_heartbeat_id: hb,
        p_status: 'failed',
        p_note: landed.length ? `${reason} (PARTIAL — ${landed.length} push(es) landed)` : reason,
      });
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
