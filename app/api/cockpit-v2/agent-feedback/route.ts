// app/api/cockpit-v2/agent-feedback/route.ts
//
// PBS 2026-05-17: agent-output feedback loop.
//
// POST { role, audit_log_id, rating: 'good' | 'bad', note?: string }
//
// 'good' → writes a cockpit_audit_log "feedback" row tagging the run as good
// 'bad'  → as above + creates a cockpit_tickets row (arm=dev, intent=prompt_fix)
//          with metadata.audit_log_id + metadata.role + the user's note in
//          parsed_summary, so runner_v3 can pick it up and propose a prompt diff.
//
// No write guard for now (PBS-only environment). Add session-scope check
// later if multi-user editing arrives.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface Body {
  role: string;
  audit_log_id: string | number;
  rating: 'good' | 'bad';
  note?: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { role, audit_log_id, rating, note } = body;
  if (!role || !audit_log_id || (rating !== 'good' && rating !== 'bad')) {
    return NextResponse.json({ error: 'missing_or_invalid_fields' }, { status: 400 });
  }
  if (rating === 'bad' && (!note || !note.trim())) {
    return NextResponse.json({ error: 'note_required_for_bad_rating' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // 1. record the feedback event in audit log itself
  await sb.from('cockpit_audit_log').insert({
    agent: 'pbs:cockpit-v2',
    action: 'agent_feedback',
    target: `${role}#audit_log_id=${audit_log_id}`,
    success: true,
    notes: rating === 'good' ? '✓ confirmed good' : `✗ dismissed: ${note}`,
    metadata: {
      kind: 'agent_feedback',
      role,
      rated_audit_log_id: audit_log_id,
      rating,
      note: note ?? null,
    },
  });

  // 2. if bad, create a prompt-fix ticket for runner_v3
  let ticketId: number | null = null;
  if (rating === 'bad') {
    const { data: ticket, error: tErr } = await sb
      .from('cockpit_tickets')
      .insert({
        source: 'hod_subticket',
        arm: 'dev',
        intent: 'prompt_fix',
        status: 'triaged',
        email_subject: `[code_writer] **PROMPT FIX — ${role}** (output flagged by PBS)`,
        parsed_summary:
          `Agent ${role} produced a dismissed output. PBS feedback:\n\n` +
          `"${note}"\n\n` +
          `Run reference: cockpit_audit_log.id = ${audit_log_id}\n` +
          `Action: read the audit_log row (input + reasoning + tool_trace + output), ` +
          `read the current cockpit_agent_prompts row for role=${role}, ` +
          `propose a minimal prompt edit that would have produced a different output. ` +
          `Open a PR that bumps the version per the #78 prompt-edit guard.`,
        metadata: {
          kind: 'prompt_fix',
          role,
          audit_log_id,
          user_note: note,
          requested_by: 'pbs',
          source_surface: 'cockpit-v2/agent/runs',
        },
      })
      .select('id')
      .single();
    if (tErr) {
      console.error('[agent-feedback] ticket insert error', tErr);
    } else {
      ticketId = (ticket as any)?.id ?? null;
    }
  }

  return NextResponse.json({
    ok: true,
    rating,
    ticket_id: ticketId,
    audit_log_id,
    role,
  });
}
