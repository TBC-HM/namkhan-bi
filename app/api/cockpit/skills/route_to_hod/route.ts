// app/api/cockpit/skills/route_to_hod/route.ts
// Routes a cockpit_tickets row to the correct HoD
// Updates ticket: assignee=hod_role, status=routed, notes log entry
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ARMS = ['chat','dev','marketing','ops','newsletter','it','revenue','sales','operations','finance','hr'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    ticket_id: number;
    hod_role: string;
    arm?: string;
    note?: string;
  };

  if (!body.ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 });
  if (!body.hod_role) return NextResponse.json({ error: 'hod_role required' }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data: ticket, error: fetchErr } = await sb
    .from('cockpit_tickets')
    .select('id, status, arm, metadata')
    .eq('id', body.ticket_id)
    .single();

  if (fetchErr || !ticket) return NextResponse.json({ error: 'ticket not found' }, { status: 404 });

  const arm = body.arm && VALID_ARMS.includes(body.arm) ? body.arm : ticket.arm;
  const prevMeta = (ticket.metadata ?? {}) as Record<string, unknown>;
  const auditLog = [...((prevMeta.audit_log as unknown[]) ?? []), {
    action: 'routed_to_hod',
    hod_role: body.hod_role,
    arm,
    at: new Date().toISOString(),
    note: body.note ?? '',
  }];

  const { data, error } = await sb
    .from('cockpit_tickets')
    .update({
      status: 'routed',
      arm,
      notes: (ticket as Record<string, unknown>).notes
        ? String((ticket as Record<string, unknown>).notes) + '\nRouted to ' + body.hod_role + ': ' + (body.note ?? '')
        : 'Routed to ' + body.hod_role + ': ' + (body.note ?? ''),
      metadata: { ...prevMeta, assignee_hod: body.hod_role, audit_log: auditLog },
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.ticket_id)
    .select('id, status, arm, metadata')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ticket: data, message: 'Ticket #' + body.ticket_id + ' routed to ' + body.hod_role });
}
