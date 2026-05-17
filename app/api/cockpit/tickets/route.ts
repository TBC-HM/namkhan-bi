// app/api/cockpit/tickets/route.ts
//
// PBS 2026-05-17 EMERGENCY FIX: cockpit_tickets is a VIEW over cockpit.exec_tickets.
// Deleting from a view via PostgREST returns 204 with 0 rows affected — looked like
// success in the UI, did nothing in the DB. Same problem with the 8 dependent
// tables (all views over cockpit.* and cockpit.aud_audit_log). All paths now route
// through SECURITY DEFINER SQL functions that hit the real underlying tables:
//   public.fn_delete_ticket(bigint)
//   public.fn_delete_tickets_by_status(text)
//   public.fn_patch_ticket(bigint, text)
//
// DELETE ?id=N           — single
// DELETE ?status=archived — bulk
// PATCH  { id, status }   — re-status single (e.g. archive)
// POST   { source, intent, summary, dept? } — manual create from dept-entry box

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'build-placeholder-key',
);

export async function DELETE(req: Request) {
  noStore();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const status = url.searchParams.get('status');

  if (id) {
    const n = Number(id);
    if (!n) return NextResponse.json({ error: 'bad id' }, { status: 400 });
    const { data, error } = await supabase.rpc('fn_delete_ticket', { p_id: n });
    if (error) {
      console.error('[cockpit/tickets DELETE id] rpc error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const deleted = (data as any)?.deleted ?? 0;
    if (deleted === 0) {
      return NextResponse.json({ ok: false, error: `ticket #${n} not found`, raw: data }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted, dependents: (data as any)?.dependents });
  }

  if (status) {
    const { data, error } = await supabase.rpc('fn_delete_tickets_by_status', { p_status: status });
    if (error) {
      console.error('[cockpit/tickets DELETE status] rpc error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: (data as any)?.deleted ?? 0, ids: (data as any)?.ids });
  }

  return NextResponse.json({ error: 'id or status required' }, { status: 400 });
}

export async function PATCH(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as { id?: number; status?: string };
  const id = Number(body.id);
  const status = body.status;
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

  const { data, error } = await supabase.rpc('fn_patch_ticket', { p_id: id, p_status: status });
  if (error) {
    console.error('[cockpit/tickets PATCH] rpc error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const updated = (data as any)?.updated ?? 0;
  if (updated === 0) {
    return NextResponse.json({ ok: false, error: `ticket #${id} not found` }, { status: 404 });
  }
  return NextResponse.json({ ok: true, updated });
}

export async function POST(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as {
    summary?: string;
    intent?: string;
    source?: string;
    dept?: string;
  };
  const summary = (body.summary ?? '').trim();
  if (!summary) return NextResponse.json({ error: 'summary required' }, { status: 400 });

  // INSERT into the real table via the cockpit schema (uses .schema()).
  // The exec_tickets table is writable via service role even though PostgREST
  // doesn't expose the schema by default — .schema('cockpit').from() works
  // because supabase-js routes through the underlying REST endpoint that
  // can accept a schema header.
  const { data, error } = await supabase
    .schema('cockpit')
    .from('exec_tickets')
    .insert({
      status: 'new',
      arm: body.dept ?? null,
      intent: body.intent ?? 'task',
      source: body.source ?? 'dept-entry',
      email_subject: summary.slice(0, 140),
      email_body: summary,
      parsed_summary: summary,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[cockpit/tickets POST] insert error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: (data as any)?.id });
}
