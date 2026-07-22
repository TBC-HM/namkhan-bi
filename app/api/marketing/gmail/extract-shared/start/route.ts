// app/api/marketing/gmail/extract-shared/start/route.ts
// Newsletter Module §12.3 — 2026-07-22
//
// Async gmail extract — /start entry point.
//
// Replaces the synchronous walk in /api/marketing/contacts/extract for long
// runs that would exceed Vercel's 300s hard cap. Instead of walking every
// mailbox in one HTTP request, this route ENQUEUES one row per mailbox in
// marketing.gmail_extract_jobs and returns immediately. A pg_cron every 2 min
// hits /process which pops one queued job, walks up to max_messages, and
// writes the result back.
//
// The legacy /contacts/extract synchronous route is preserved untouched — this
// route is additive.
//
// Auth (any of):
//   1. x-cron-secret header matches vault CRON_SHARED_SECRET (or env fallback).
//   2. Signed-in user with holding_role ∈ ('owner','admin','marketing_hod').
//
// POST body: {
//   account_email?: string,       // enqueue just this connected mailbox
//   max_messages?: number,        // per-job cap (default 2000)
//   include_personal?: boolean,   // default true
//   include_shared?: boolean,     // default true
// }
//
// Response: {
//   ok: true, batch_id, enqueued_count,
//   mailboxes: [{ account_email, source }]
// }

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ADMIN_ROLES = new Set(['owner', 'admin', 'marketing_hod']);

interface StartBody {
  account_email?: string;
  max_messages?: number;
  include_personal?: boolean;
  include_shared?: boolean;
}

interface PersonalConnRow {
  gmail_address: string;
  active: boolean;
}

interface SharedConnRow {
  email: string;
  refresh_token: string;
}

interface MailboxEnqueue {
  account_email: string;
  source: 'personal' | 'shared';
  max_messages: number;
}

async function checkAdminSession(): Promise<boolean> {
  try {
    const jar = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })), setAll: () => {} } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const role = String(meta.holding_role ?? meta.role ?? appMeta.holding_role ?? appMeta.role ?? '').toLowerCase();
    return ADMIN_ROLES.has(role);
  } catch {
    return false;
  }
}

function checkCronSecret(req: Request): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!provided) return false;
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  return provided === envSecret;
}

export async function POST(req: Request) {
  const cronOk = checkCronSecret(req);
  const adminOk = cronOk ? true : await checkAdminSession();
  if (!cronOk && !adminOk) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: StartBody = {};
  try { body = (await req.json()) as StartBody; } catch { body = {}; }
  const maxMessages = Math.max(1, Math.min(50000, Number(body.max_messages ?? 2000)));
  const includePersonal = body.include_personal !== false;
  const includeShared = body.include_shared !== false;
  const accountFilter = body.account_email ? body.account_email.toLowerCase() : null;

  const admin = getSupabaseAdmin();
  const mailboxes: MailboxEnqueue[] = [];

  if (includePersonal) {
    let pq = admin
      .schema('marketing')
      .from('user_gmail_connections')
      .select('gmail_address, active')
      .eq('active', true);
    if (accountFilter) pq = pq.eq('gmail_address', accountFilter);
    const pRes = await pq;
    if (pRes.error) {
      return NextResponse.json(
        { ok: false, error: 'conn_list_personal_' + pRes.error.message },
        { status: 500 },
      );
    }
    for (const r of (pRes.data ?? []) as PersonalConnRow[]) {
      mailboxes.push({
        account_email: r.gmail_address,
        source: 'personal',
        max_messages: maxMessages,
      });
    }
  }

  if (includeShared) {
    let sq = admin
      .schema('sales')
      .from('gmail_connections')
      .select('email, refresh_token');
    if (accountFilter) sq = sq.eq('email', accountFilter);
    const sRes = await sq;
    if (sRes.error) {
      return NextResponse.json(
        { ok: false, error: 'conn_list_shared_' + sRes.error.message },
        { status: 500 },
      );
    }
    for (const r of ((sRes.data ?? []) as SharedConnRow[]).filter((r) => !!r.refresh_token)) {
      mailboxes.push({
        account_email: r.email,
        source: 'shared',
        max_messages: maxMessages,
      });
    }
  }

  if (mailboxes.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'no_active_connections' + (accountFilter ? '_for_' + accountFilter : ''),
    }, { status: 404 });
  }

  const { data, error } = await admin.rpc('fn_gmail_extract_job_enqueue', {
    p_mailboxes: mailboxes,
    p_created_by: null,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'enqueue_' + error.message },
      { status: 500 },
    );
  }
  const row = Array.isArray(data) ? data[0] : data;
  const batchId = (row?.batch_id ?? null) as string | null;
  const enqueuedCount = Number(row?.enqueued_count ?? mailboxes.length);

  return NextResponse.json({
    ok: true,
    batch_id: batchId,
    enqueued_count: enqueuedCount,
    mailboxes: mailboxes.map((m) => ({ account_email: m.account_email, source: m.source })),
    hint: 'Poll fn_gmail_extract_batch_status(batch_id) or wait for pg_cron to drain the queue.',
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST to enqueue an async gmail extract batch. Header x-cron-secret or admin session required. Body: { account_email?, max_messages?, include_personal?, include_shared? }',
  });
}
