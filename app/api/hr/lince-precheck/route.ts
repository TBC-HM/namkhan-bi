// app/api/hr/lince-precheck/route.ts
//
// PBS 2026-05-15: Trigger Lince's pre-contract background-check workflow.
// MVP: files a ticket to Carla's queue saying "Run background check on
// candidate X" with the candidate metadata. The actual paid integrations
// (eInforma / Onfido / HireRight) require API keys not yet configured —
// this endpoint is the gate that opens the workflow.
//
// Returns a synthetic dossier verdict (YELLOW by default) so HR has to
// document override reasoning before the contract button enables.
// Once real OSINT skill handlers ship, this endpoint dispatches them.

import { NextResponse } from 'next/server';
import { SUPABASE } from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  property_id: number;
  candidate: {
    full_name: string;
    nif?: string;
    nationality?: string;
    claimed_position?: string;
    claimed_employers?: string[];
    minor_contact_role?: boolean;
  };
}

export async function POST(req: Request) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }); }

  if (!body?.candidate?.full_name) {
    return NextResponse.json({ ok: false, error: 'missing candidate.full_name' }, { status: 400 });
  }

  // Build a checklist of which skills Lince should run for this candidate.
  const checklist: { skill: string; status: string; reason?: string }[] = [
    { skill: 'bg_check_run_baseline',         status: 'pending', reason: 'Free OSINT — runs always' },
    { skill: 'bg_check_onfido_verify',        status: 'pending', reason: 'MANDATORY ID verification for every candidate' },
    { skill: 'bg_check_vida_laboral_request', status: 'pending', reason: 'Candidate self-service certificate request' },
  ];
  if (body.candidate.minor_contact_role) {
    checklist.push({ skill: 'bg_check_penales_request', status: 'pending', reason: 'MANDATORY for minor-contact roles' });
  }
  if (body.candidate.claimed_position?.toLowerCase().match(/hod|chef|sommelier|director|jefe|gerente/i)) {
    checklist.push({ skill: 'bg_check_einforma_lookup', status: 'pending', reason: 'HoD-level role → corporate registry check' });
  }
  if (body.candidate.nationality && !['ES', 'spain', 'español', 'española', 'eu'].some((s) => body.candidate.nationality!.toLowerCase().includes(s))) {
    checklist.push({ skill: 'bg_check_hireright_intl', status: 'pending_pbs_approval', reason: 'Non-EU candidate → international background check (PBS approval required)' });
  }
  checklist.push({ skill: 'bg_check_compose_dossier', status: 'pending', reason: 'Final A-G dossier composition' });

  // MVP verdict: YELLOW (HR override required) until real skill handlers run.
  // Once skill routes ship, this becomes GREEN / YELLOW / RED based on actual findings.
  const verdict = 'YELLOW' as const;
  const verdictNotes = 'Lince checklist generated. Real OSINT + Onfido + eInforma integrations pending (API keys not yet configured in env). HR may proceed with override + documented reasoning. Carla notified.';

  const subject = `[Background Check] ${body.candidate.full_name} · verdict ${verdict}`;
  const summary = [
    `**Pre-contract background check** · candidate: **${body.candidate.full_name}**`,
    `**Verdict:** ${verdict} (HR override required)`,
    `**Position claimed:** ${body.candidate.claimed_position ?? '[___]'}`,
    `**Nationality:** ${body.candidate.nationality ?? '[___]'}`,
    `**Minor-contact role:** ${body.candidate.minor_contact_role ? 'YES' : 'no'}`,
    '',
    '## Lince checklist (skills to run before contract is enabled)',
    ...checklist.map((c) => `- \`${c.skill}\` — ${c.status} · ${c.reason ?? ''}`),
    '',
    '## Notes',
    verdictNotes,
    '',
    '---',
    `_Filed by the Lince pre-check trigger · Carla to assign skill execution as integrations come online._`,
  ].join('\n');

  const { data: ticketRow, error } = await SUPABASE
    .from('cockpit_tickets')
    .insert({
      source: 'agent_delivery',
      arm: 'agent_work',
      intent: 'background_check_request',
      status: 'awaits_user',
      email_subject: subject,
      parsed_summary: summary,
      metadata: {
        property_id: body.property_id,
        candidate_name: body.candidate.full_name,
        candidate_nif: body.candidate.nif ?? null,
        candidate_nationality: body.candidate.nationality ?? null,
        verdict,
        verdict_notes: verdictNotes,
        checklist,
        assigned_role: 'background_checker_donna',
        supervisor_role: 'legal_specialist_donna',
        delivered_by_agent: 'Lince',
        delivery_channel: 'hod_inbox',
        priority: body.candidate.minor_contact_role ? 'high' : 'normal',
        category: 'hr_background_check',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !ticketRow) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'failed to file ticket' }, { status: 500 });
  }

  await SUPABASE.from('cockpit_audit_log').insert({
    agent: 'lince_precheck',
    action: 'background_check_requested',
    target: `candidate:${body.candidate.full_name}`,
    success: true,
    metadata: { property_id: body.property_id, ticket_id: ticketRow.id, verdict, checklist_len: checklist.length },
    reasoning: `Lince pre-check requested for ${body.candidate.full_name}. Verdict ${verdict} pending real skill handlers.`,
  }).then(() => null, () => null);

  return NextResponse.json({
    ok: true,
    ticket_id: ticketRow.id,
    verdict,
    verdict_notes: verdictNotes,
    checklist,
  });
}
