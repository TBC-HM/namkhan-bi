// app/api/cockpit/tickets/route.ts
// PBS 2026-05-09: cockpit_tickets needs delete (days-old tasks pile up).
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
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

// PBS 2026-05-09: 13 tables FK-reference cockpit_tickets; several without
// ON DELETE clauses. A naive DELETE fails with FK violation when a ticket
// has audit_log/skill_calls/decisions rows. Clean dependents first.
async function deleteTicketIds(ids: number[]): Promise<{ deleted: number; error?: string }> {
  if (ids.length === 0) return { deleted: 0 };
  const dependents = [
    'cockpit_audit_log',
    'cockpit_decisions',
    'cockpit_skill_calls',
    'cockpit_skill_approvals',
    'cockpit_notifications',
    'cockpit_mismatches',
    'cockpit_plan_steps',
    'cockpit_plans',
  ];
  for (const tbl of dependents) {
    const colname = tbl === 'cockpit_plans' ? 'parent_ticket_id' : 'ticket_id';
    const { error } = await supabase.from(tbl).delete().in(colname, ids);
    if (error) return { deleted: 0, error: `dependent ${tbl}: ${error.message}` };
  }
  // Tables with ON DELETE SET NULL (cockpit_agent_prompts, cockpit_knowledge_base.source_ticket_id,
  // cockpit_departments.created_from_ticket_id, cockpit_agent_memory.source_ticket_id,
  // cockpit_proposals.ticket_id) handle themselves automatically — skip.
  const { error, count } = await supabase
    .from('cockpit_tickets')
    .delete({ count: 'exact' })
    .in('id', ids);
  if (error) return { deleted: 0, error: error.message };
  return { deleted: count ?? 0 };
}

export async function DELETE(req: Request) {
  noStore();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const status = url.searchParams.get('status');
  if (id) {
    const n = Number(id);
    if (!n) return NextResponse.json({ error: 'bad id' }, { status: 400 });
    const r = await deleteTicketIds([n]);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: r.deleted });
  }
  if (status) {
    const allowed = ['archived', 'completed', 'triage_failed', 'blocked'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: `bulk delete only allowed for: ${allowed.join(', ')}` }, { status: 400 });
    }
    const { data: rows, error: pickErr } = await supabase
      .from('cockpit_tickets')
      .select('id')
      .eq('status', status);
    if (pickErr) return NextResponse.json({ error: pickErr.message }, { status: 500 });
    const ids = (rows ?? []).map((r: { id: number }) => r.id);
    if (ids.length === 0) return NextResponse.json({ ok: true, deleted: 0 });
    const r = await deleteTicketIds(ids);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: r.deleted });
  }
  return NextResponse.json({ error: 'id or status required' }, { status: 400 });
}

export async function PATCH(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as { id?: number; status?: string };
  const id = Number(body.id);
  const status = body.status;
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'archived' || status === 'completed') patch.closed_at = new Date().toISOString();
  const { error } = await supabase.from('cockpit_tickets').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
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
  const { data, error } = await supabase
    .from('cockpit_tickets')
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}
