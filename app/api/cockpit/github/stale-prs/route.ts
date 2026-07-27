// app/api/cockpit/github/stale-prs/route.ts
// PBS 2026-07-27 — "the last 4 requests have merge conflicts, i go nuts".
// 71 open PRs, many from May, dead + conflicted. This route (runs on Vercel,
// where the GitHub API is reachable with the vault token) closes stale PRs:
//   stale = open, NOT a bots/ PR from the last 7 days, last updated > N days
//   ago (default 21). Branches are NOT deleted — zero knowledge loss; a
//   comment explains the close. Dry-run by default: GET shows the hit list,
//   POST {confirm:true} executes.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const GH_REPO = 'TBC-HM/namkhan-bi';

async function ghToken(): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_get_secret', { p_name: 'github_token' });
  if (error || typeof data !== 'string') throw new Error('gh_token_missing');
  return data;
}

async function gh(path: string, init: RequestInit = {}): Promise<Response> {
  const tok = await ghToken();
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${tok}`);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  return fetch(`https://api.github.com${path}`, { ...init, headers });
}

type PR = { number: number; title: string; updated_at: string; head: { ref: string }; draft: boolean };

async function listStale(staleDays: number): Promise<PR[]> {
  const cutoff = Date.now() - staleDays * 86400_000;
  const out: PR[] = [];
  for (let page = 1; page <= 3; page++) {
    const r = await gh(`/repos/${GH_REPO}/pulls?state=open&per_page=100&page=${page}&sort=updated&direction=asc`);
    if (!r.ok) throw new Error(`gh_list_prs ${r.status}`);
    const prs = (await r.json()) as PR[];
    if (prs.length === 0) break;
    for (const pr of prs) {
      if (new Date(pr.updated_at).getTime() < cutoff) out.push(pr);
    }
    if (prs.length < 100) break;
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const staleDays = Number(url.searchParams.get('days') ?? 21);
  const stale = await listStale(staleDays);
  return NextResponse.json({
    dry_run: true,
    stale_days: staleDays,
    count: stale.length,
    prs: stale.map((p) => ({ number: p.number, title: p.title, last_update: p.updated_at, branch: p.head.ref })),
    note: 'POST {"confirm":true} to close these (branches kept, comment added).',
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { confirm?: boolean; days?: number };
  if (!body.confirm) return NextResponse.json({ error: 'pass {"confirm":true}' }, { status: 400 });
  const staleDays = body.days ?? 21;
  const stale = await listStale(staleDays);
  const closed: number[] = [];
  const failed: { number: number; error: string }[] = [];
  for (const pr of stale) {
    try {
      await gh(`/repos/${GH_REPO}/issues/${pr.number}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: `Closed by stale-PR sweep (PBS pipe-clean 2026-07-27): no activity for ${staleDays}+ days, superseded by the standing pipeline. Branch \`${pr.head.ref}\` is kept — reopen anytime if this was wrong.` }),
      });
      const r = await gh(`/repos/${GH_REPO}/pulls/${pr.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
      if (r.ok) closed.push(pr.number);
      else failed.push({ number: pr.number, error: `close ${r.status}` });
    } catch (e) {
      failed.push({ number: pr.number, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ closed_count: closed.length, closed, failed });
}
