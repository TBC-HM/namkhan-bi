// app/api/hr/warning-letter/route.ts
//
// PBS 2026-05-15: Generate a formal written warning via Claude and file it in
// dms.documents (category='warning', metadata.employee_id) + Reports inbox
// (cockpit_tickets, source='agent_delivery', intent='warning_letter').
// Jurisdiction-aware: Spain → amonestación in spanish; Laos → English with
// Lao-Labour-Law-2014 framing.

import { NextResponse } from 'next/server';
import { callAnthropic, isLlmOk, SUPABASE } from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  property_id: number;
  employee_id: number;
  employee_name: string | null;
  position: string | null;
  department: string | null;
  incident: string;
  severity: 'minor' | 'moderate' | 'serious';
  jurisdiction: 'ES' | 'LA';
}

const SEVERITY_LABEL_ES = {
  minor:    'Amonestación verbal recogida por escrito',
  moderate: 'Primera amonestación por escrito',
  serious:  'Amonestación grave (previa a despido)',
} as const;

const SEVERITY_LABEL_LA = {
  minor:    'Verbal note (written record)',
  moderate: 'First written warning',
  serious:  'Final written warning (pre-dismissal)',
} as const;

export async function POST(req: Request) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }); }

  if (!body?.employee_name || !body?.incident?.trim()) {
    return NextResponse.json({ ok: false, error: 'missing employee or incident' }, { status: 400 });
  }

  const isES = body.jurisdiction === 'ES';
  const sevLabel = isES ? SEVERITY_LABEL_ES[body.severity] : SEVERITY_LABEL_LA[body.severity];

  const systemPrompt = isES
    ? `Eres Vera, abogada laboralista local de Donna Portals, redactando una amonestación formal en español castellano. Debe ser jurídicamente sólida, factual, sin adjetivos cargados, con cita expresa del Estatuto de los Trabajadores Art. 58 y la cláusula correspondiente del Convenio Colectivo de Hostelería Baleares.

FORMATO:
- Encabezado: "AMONESTACIÓN POR ESCRITO" centrado, mayúsculas.
- Datos empresa (Donna Portals SL, CIF, domicilio) — placeholders cuando falten.
- Datos trabajador: nombre, NIF, categoría, departamento.
- Tipo de amonestación según gravedad (verbal recogida / primera escrita / grave previa-despido).
- Hechos: enunciados de forma factual, fecha + hora si procede.
- Calificación jurídica: cita del artículo del CCT que tipifica la falta (leve / grave / muy grave).
- Advertencia formal: reiteración puede conllevar sanción mayor (suspensión empleo y sueldo o despido).
- Acuse de recibo del trabajador + firma representante empresa.
- NO uses emojis. NO inventes datos del trabajador.`
    : `You are the HR Manager of The Namkhan, drafting a formal written warning in clear, professional English. Reference the Lao Labour Law 2014 Art. 83 on workplace discipline and the company's internal regulations.

FORMAT:
- Letterhead: "WRITTEN WARNING" centred, all caps.
- Company block: The Namkhan, Luang Prabang, Lao PDR.
- Employee block: name, position, department, date.
- Warning level (verbal record / first written / final written pre-dismissal).
- Facts: enumerated, factual, with date/time when relevant.
- Reference: Lao Labour Law 2014 Art. 83 + internal regulations clause.
- Formal warning: state that repetition may lead to higher sanctions including suspension or termination.
- Employee acknowledgment line + HR signature block.
- NO emojis. NO fabrication.`;

  const userPrompt = isES
    ? `Redacta la amonestación. Tipo: ${sevLabel}.

DATOS DEL TRABAJADOR:
- Nombre: ${body.employee_name}
- Departamento: ${body.department ?? '[___]'}
- Puesto: ${body.position ?? '[___]'}
- Fecha de emisión: ${new Date().toISOString().slice(0, 10)}

HECHO MOTIVO DE LA AMONESTACIÓN (en una frase, proporcionada por HR):
"${body.incident}"

OUTPUT: solo la carta en markdown — sin preámbulo, sin notas para mí.`
    : `Draft the written warning. Level: ${sevLabel}.

EMPLOYEE DATA:
- Name: ${body.employee_name}
- Department: ${body.department ?? '[___]'}
- Position: ${body.position ?? '[___]'}
- Issue date: ${new Date().toISOString().slice(0, 10)}

INCIDENT (one sentence, provided by HR):
"${body.incident}"

OUTPUT: only the warning letter in markdown — no preamble, no notes to me.`;

  const llm = await callAnthropic({
    systemPrompt,
    userPrompt,
    maxTokens: 2500,
  });

  if (!isLlmOk(llm)) {
    return NextResponse.json({ ok: false, error: `LLM failed: ${llm.error}` }, { status: 502 });
  }

  const warningMd = llm.text;
  const ticketSubject = `[Warning · ${body.severity}] ${body.employee_name} · ${new Date().toISOString().slice(0, 10)}`;
  const summary = [
    `**Formal warning** for ${body.employee_name}`,
    `**Severity:** ${sevLabel} · **Incident:** "${body.incident}"`,
    `**Jurisdiction:** ${isES ? 'Spain (ET Art. 58 + CCT)' : 'Laos (Labour Law 2014 Art. 83)'}`,
    '',
    '---',
    '',
    warningMd,
    '',
    '---',
    `_AI-drafted · review by HR/legal before delivery to employee · filed in docs as category='warning'._`,
  ].join('\n');

  // File into Reports inbox
  const { data: ticketRow, error: tErr } = await SUPABASE
    .from('cockpit_tickets')
    .insert({
      source: 'agent_delivery',
      arm: 'agent_work',
      intent: 'warning_letter',
      status: 'awaits_user',
      email_subject: ticketSubject,
      parsed_summary: summary,
      metadata: {
        property_id: body.property_id,
        employee_id: body.employee_id,
        employee_name: body.employee_name,
        severity: body.severity,
        severity_label: sevLabel,
        incident: body.incident,
        jurisdiction: body.jurisdiction,
        assigned_role: isES ? 'finance_hod_donna' : 'finance_hod',
        delivered_by_agent: isES ? 'Vera' : 'HR Namkhan',
        delivery_channel: 'hod_inbox',
        priority: body.severity === 'serious' ? 'high' : 'normal',
        category: 'hr_warning',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (tErr || !ticketRow) {
    return NextResponse.json({ ok: false, error: tErr?.message ?? 'failed to file ticket' }, { status: 500 });
  }

  // Best-effort filing into dms.documents (skip silently if dms write fails).
  try {
    await SUPABASE.schema('dms').from('documents').insert({
      property_id: body.property_id,
      title: ticketSubject,
      body_md: warningMd,
      doc_type: 'hr_warning',
      category: 'warning',
      language: isES ? 'es' : 'en',
      created_by: 'hr_warning_wizard',
      metadata: {
        employee_id: body.employee_id,
        employee_name: body.employee_name,
        severity: body.severity,
        incident: body.incident,
        source_ticket_id: ticketRow.id,
      },
    });
  } catch { /* dms is optional best-effort */ }

  await SUPABASE.from('cockpit_audit_log').insert({
    agent: 'hr_warning_wizard',
    action: 'warning_letter_generated',
    target: `hr.employees:${body.employee_id}`,
    success: true,
    metadata: { property_id: body.property_id, ticket_id: ticketRow.id, severity: body.severity },
    reasoning: `Warning issued for ${body.employee_name} (${sevLabel}, incident: ${body.incident.slice(0, 120)}).`,
  }).then(() => null, () => null);

  return NextResponse.json({ ok: true, ticket_id: ticketRow.id, letter_chars: warningMd.length });
}
