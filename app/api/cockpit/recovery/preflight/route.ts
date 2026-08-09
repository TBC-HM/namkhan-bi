// app/api/cockpit/recovery/preflight/route.ts
// Break-glass pre-flight for the database rewind (brief recovery-page-v1, recovery_module §7).
// PITR gets NO execute button — this route only:
//   1. verifies the caller has a live session (middleware also gates /api/*),
//   2. re-verifies their password against Supabase Auth (replaces the decorative
//      TOTP field — no MFA path exists in this auth stack; see brief §0.R R4),
//   3. gathers a pre-flight evidence pack (backup posture, live deployment, last
//      drill, timestamp, actor),
//   4. writes it permanently to public.cockpit_audit_log (append-only; zero new DDL).
// The rewind itself is executed manually in the Supabase dashboard.
// NO AI anywhere in this path (recovery_module §10).

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  // 1 — session
  const jar = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: () => { /* read-only — no session mutation from this route */ },
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (password.length < 6) return NextResponse.json({ error: 'Password required' }, { status: 400 });
  if (reason.length < 9) return NextResponse.json({ error: 'A meaningful reason is required' }, { status: 400 });

  // 2 — password re-auth (throwaway client, session never persisted)
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: authErr } = await verifier.auth.signInWithPassword({ email: user.email, password });
  if (authErr) {
    return NextResponse.json({ error: 'Password check failed — nothing was recorded' }, { status: 403 });
  }

  // 3 — evidence pack (service role; read-only queries)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const [postureRes, deployRes, drillRes] = await Promise.all([
    admin.from('v_dr_posture').select('data_class,freshness,status,age_hours,last_bytes,last_object_count'),
    admin.from('v_deployments').select('id,state,prod_aliased,created_at,url').order('created_at', { ascending: false }).limit(5),
    admin.from('v_dr_last_drill').select('passed,duration_secs,rows_asserted,days_ago').limit(1),
  ]);

  const pack = {
    kind: 'breakglass_rewind_preflight',
    actor: user.email,
    reason,
    recorded_at: new Date().toISOString(),
    posture: postureRes.data ?? [],
    recent_deployments: deployRes.data ?? [],
    last_drill: (drillRes.data ?? [])[0] ?? null,
    manual_steps: [
      'Supabase dashboard → Database → Backups: create a backup / restore-fork of the CURRENT state first (the safety copy is manual — it does not happen by itself)',
      'Record the current WAL position before the rewind: SELECT pg_current_wal_lsn();',
      'Execute the PITR restore in the dashboard — never from this app',
      'After the rewind, verify row counts against the posture snapshot in this pack',
    ],
  };

  // 4 — permanent record
  const { data: row, error: insErr } = await admin
    .from('cockpit_audit_log')
    .insert({
      agent: 'recovery-page',
      action: 'breakglass_rewind_preflight',
      target: 'namkhan-pms',
      success: true,
      metadata: pack,
      reasoning: `Break-glass pre-flight recorded by ${user.email}. Reason: ${reason}`,
    })
    .select('id')
    .single();

  if (insErr) return NextResponse.json({ error: `Could not record the evidence pack: ${insErr.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, id: row?.id ?? null });
}
