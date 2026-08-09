// app/api/cockpit/recovery/trigger/route.ts
// Safe-tier "run backup now" (brief recovery-page-v1 §4 guard ladder — one click,
// no confirm). Fires workflow_dispatch on .github/workflows/dr-nightly.yml (on
// main since 2026-08-08) using the vault github_token — same pattern as
// app/api/cockpit/deployments/github/route.ts. Session-gated; every trigger is
// written to public.cockpit_audit_log. NO AI in this path (recovery_module §10).

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GH_REPO = 'TBC-HM/namkhan-bi';
const WORKFLOW = 'dr-nightly.yml';

export async function POST() {
  // session gate (middleware also 401s /api/* without a session cookie)
  const jar = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: () => { /* read-only */ },
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: token, error: secErr } = await admin.rpc('fn_get_secret', { p_name: 'github_token' });
  if (secErr || !token) {
    return NextResponse.json({ error: 'GitHub credential unavailable on the server' }, { status: 500 });
  }

  const gh = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
    cache: 'no-store',
  });

  const ok = gh.status === 204;
  let ghDetail: string | null = null;
  if (!ok) {
    const t = await gh.text().catch(() => '');
    ghDetail = `${gh.status} ${t.slice(0, 300)}`;
  }

  await admin.from('cockpit_audit_log').insert({
    agent: 'recovery-page',
    action: 'dr_backup_triggered',
    target: `${GH_REPO}/${WORKFLOW}`,
    success: ok,
    metadata: { actor: user.email, ref: 'main', gh_status: gh.status, gh_detail: ghDetail },
    reasoning: `Manual backup run requested from the Recovery page by ${user.email}.`,
  });

  if (!ok) return NextResponse.json({ error: `GitHub refused the dispatch (${ghDetail})` }, { status: 502 });
  return NextResponse.json({ ok: true });
}
