// app/api/cron/pr-review-harvest/route.ts
// Brief harvest-pr-review-suggestions (2026-07-29, standing builder).
// Weekly sweep of vercel[bot] PR review comments — the free QA that was lying
// unread on dozens of PRs (example: PR #277 caught a query against a
// non-existent table). Each new comment is triaged against CURRENT main:
//   still valid   → filed as a bug (status 'new', open_question NULL, so the
//                   3h bug-agent drain auto-fires it per the OWNER RULING
//                   2026-07-27: auto-accept into the loop, never into main —
//                   reviewer + verifier + PBS-merges gates remain)
//   already fixed / false positive / superseded → ledgered with evidence.
// Ledger: governance.pr_review_harvest (PK comment_id → idempotent re-harvest),
// via public.v_pr_review_harvest (read) + public.fn_pr_harvest_record (write).
// Auth: x-cron-secret / ?secret= (CRON_SHARED_SECRET), house pattern from the
// yt_*/GBP shims. Called by pg_cron job pr-review-harvest-weekly, whose
// schedule-level guard honours public.fn_automation_enabled() (kill switch).
// Triage LLM calls are metered to public.ai_token_meter under 'pr-harvest'.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropicTool } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const GH_REPO = 'TBC-HM/namkhan-bi';
const BOT_LOGIN = 'vercel[bot]';
const MAX_PAGES = 5;           // 500 comments/run ceiling
const MAX_LLM_TRIAGES = 25;    // cost ceiling per run; rest carries to next run
const MAX_FILE_CHARS = 28_000; // context cap for the triage prompt

function authGate(req: Request): NextResponse | null {
  const required = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET;
  if (!required) return null;
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

interface GhComment {
  id: number;
  body: string | null;
  path: string | null;
  line: number | null;
  original_line: number | null;
  created_at: string;
  in_reply_to_id: number | null;
  pull_request_url: string;
  user: { login: string } | null;
}

async function getGhToken(): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_get_secret', { p_name: 'github_token' });
  if (error || typeof data !== 'string' || data.length < 20) {
    throw new Error(`gh_token_missing: ${error?.message ?? 'no data'}`);
  }
  return data;
}

async function ghFetch(path: string, tok: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${tok}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
}

async function ghGetFile(tok: string, path: string): Promise<string | null> {
  const r = await ghFetch(`/repos/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=main`, tok);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`gh_get_file ${r.status}: ${path}`);
  const j = (await r.json()) as { content?: string; encoding?: string };
  if (!j.content || j.encoding !== 'base64') return null;
  return Buffer.from(j.content, 'base64').toString('utf-8');
}

// Strip the VADE bot's HTML/comment boilerplate down to the actual claim.
function extractClaim(body: string | null): string {
  if (!body) return '';
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a href[\s\S]*?<\/a>/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!\/])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function deptFromPath(path: string | null): string {
  const p = path ?? '';
  if (p.startsWith('app/marketing/')) return 'marketing';
  if (p.startsWith('app/sales/')) return 'sales';
  if (p.startsWith('app/operations/')) return 'operations';
  if (p.startsWith('app/finance/')) return 'finance';
  if (p.startsWith('app/revenue/')) return 'revenue';
  if (p.startsWith('app/guest/')) return 'guest';
  return 'it';
}

function prNumber(c: GhComment): number {
  const n = Number(c.pull_request_url.split('/pulls/')[1]);
  return Number.isFinite(n) ? n : 0;
}

interface TriageOut {
  verdict: 'still_valid' | 'already_fixed' | 'false_positive';
  evidence: string;
  severity: 'low' | 'medium' | 'high';
  summary: string;
}

async function llmTriage(claim: string, path: string, fileContent: string): Promise<TriageOut> {
  return callAnthropicTool<TriageOut>({
    system: [
      'You are a skeptical code-review triager for the namkhan-bi Next.js repo.',
      'You receive a PR review-bot claim and the CURRENT content of the flagged file on main.',
      'Judge ONLY whether the specific defect described still exists in the current code.',
      'The repo compiles (deploys are tsc-gated), so pure "TypeScript compilation error" claims about code that has clearly changed are already_fixed.',
      'Default to already_fixed when the flagged code is no longer present; false_positive only when the claim was wrong about the code as written.',
    ].join('\n'),
    prompt: `CLAIM (from vercel[bot]):\n${claim}\n\nFILE: ${path}\nCURRENT CONTENT ON MAIN (may be truncated):\n${fileContent.slice(0, MAX_FILE_CHARS)}`,
    toolName: 'record_triage',
    toolDescription: 'Record the triage verdict for this PR review comment.',
    toolSchema: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['still_valid', 'already_fixed', 'false_positive'] },
        evidence: { type: 'string', description: 'One line of concrete evidence for the verdict (cite code)' },
        severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        summary: { type: 'string', description: 'One-line restatement of the defect (used for the bug body + dedupe)' },
      },
      required: ['verdict', 'evidence', 'severity', 'summary'],
    },
    maxTokens: 1000,
    meter: { property_id: null, agent_handle: 'pr-harvest', source: 'pr-review-harvest' },
  });
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 120);
}

async function handle(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;

  const sb = getSupabaseAdmin();
  const report = {
    ok: true, since: '', found: 0, new_comments: 0, filed: 0, already_fixed: 0,
    false_positive: 0, out_of_scope: 0, duplicates: 0, deferred: 0, errors: [] as string[],
  };

  try {
    const tok = await getGhToken();

    // Cursor: newest ledgered comment, minus a 3-day overlap (PK dedupes).
    const { data: lastRow } = await sb
      .from('v_pr_review_harvest')
      .select('comment_created_at')
      .order('comment_created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastTs = lastRow?.comment_created_at ? new Date(lastRow.comment_created_at as string) : new Date(Date.now() - 90 * 86400_000);
    const since = new Date(lastTs.getTime() - 3 * 86400_000).toISOString();
    report.since = since;

    // Pull review comments repo-wide, ascending so a budget-stop never strands
    // an older comment behind the cursor.
    const comments: GhComment[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const r = await ghFetch(`/repos/${GH_REPO}/pulls/comments?sort=created&direction=asc&since=${encodeURIComponent(since)}&per_page=100&page=${page}`, tok);
      if (!r.ok) throw new Error(`gh_list_comments ${r.status}`);
      const batch = (await r.json()) as GhComment[];
      comments.push(...batch);
      if (batch.length < 100) break;
    }
    const botComments = comments.filter((c) => c.user?.login === BOT_LOGIN);
    report.found = botComments.length;
    if (botComments.length === 0) return NextResponse.json(report);

    // Skip anything already ledgered.
    const ids = botComments.map((c) => c.id);
    const { data: ledgered } = await sb.from('v_pr_review_harvest').select('comment_id').in('comment_id', ids);
    const seen = new Set(((ledgered ?? []) as Array<{ comment_id: number }>).map((r) => Number(r.comment_id)));
    const fresh = botComments.filter((c) => !seen.has(c.id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    report.new_comments = fresh.length;

    // Open bugs for dedupe (A4): file_path + normalized summary.
    const { data: openBugs } = await sb
      .from('cockpit_bugs')
      .select('id, file_path, body')
      .not('status', 'in', '("done","archived")');
    const openList = (openBugs ?? []) as Array<{ id: number; file_path: string | null; body: string }>;

    const record = (c: GhComment, verdict: string, bugId: number | null, evidence: string) =>
      sb.rpc('fn_pr_harvest_record', {
        p_comment_id: c.id,
        p_pr_number: prNumber(c),
        p_file_path: c.path,
        p_comment_created_at: c.created_at,
        p_verdict: verdict,
        p_bug_id: bugId,
        p_evidence: evidence.slice(0, 500),
      });

    let llmUsed = 0;
    const fileCache = new Map<string, string | null>();

    for (const c of fresh) {
      try {
        if (c.in_reply_to_id) {
          await record(c, 'out_of_scope', null, 'bot thread reply, not a finding');
          report.out_of_scope++;
          continue;
        }
        const path = c.path ?? '';
        if (!fileCache.has(path)) fileCache.set(path, path ? await ghGetFile(tok, path) : null);
        const content = fileCache.get(path) ?? null;
        if (content === null) {
          await record(c, 'out_of_scope', null, 'file no longer exists on main (superseded code, brief §7)');
          report.out_of_scope++;
          continue;
        }
        if (llmUsed >= MAX_LLM_TRIAGES) {
          // Budget hit: leave un-ledgered — ascending order + 3-day overlap
          // guarantees the next weekly run picks it up.
          report.deferred++;
          continue;
        }
        llmUsed++;
        const t = await llmTriage(extractClaim(c.body), path, content);
        if (t.verdict === 'already_fixed') {
          await record(c, 'already_fixed', null, t.evidence);
          report.already_fixed++;
        } else if (t.verdict === 'false_positive') {
          await record(c, 'false_positive', null, t.evidence);
          report.false_positive++;
        } else {
          // still_valid → dedupe, then file per the R2 row contract.
          const norm = normalize(t.summary);
          const dup = openList.find((b) => (b.file_path ?? '') === path && normalize(b.body).includes(norm.slice(0, 60)));
          if (dup) {
            await record(c, 'filed', dup.id, `duplicate of open bug ${dup.id} — not re-filed`);
            report.duplicates++;
            continue;
          }
          const body = `PR-harvest (vercel[bot] PR #${prNumber(c)}, comment ${c.id}): ${t.summary} — ${t.evidence} File: ${path}:${c.line ?? c.original_line ?? ''}. https://github.com/${GH_REPO}/pull/${prNumber(c)}`;
          const { data: ins, error: insErr } = await sb
            .from('cockpit_bugs')
            .insert({
              dept_slug: deptFromPath(path), body, status: 'new', created_by: 'pr-harvest',
              file_path: path, severity: t.severity, bug_type: 'logic',
              notes: `pr-harvest comment_id=${c.id}`,
            })
            .select('id')
            .single();
          if (insErr) throw new Error(`bug_insert: ${insErr.message}`);
          const bugId = (ins as { id: number }).id;
          openList.push({ id: bugId, file_path: path, body });
          await record(c, 'filed', bugId, `still valid on main — filed as bug ${bugId}`);
          report.filed++;
        }
      } catch (e) {
        report.errors.push(`comment ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    report.ok = false;
    report.errors.push(e instanceof Error ? e.message : String(e));
    return NextResponse.json(report, { status: 500 });
  }
  return NextResponse.json(report);
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
