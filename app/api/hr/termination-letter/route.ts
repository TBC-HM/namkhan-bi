// app/api/hr/termination-letter/route.ts
//
// PBS 2026-05-15: Generate a formal termination letter via Claude and drop
// the result into the property's Reports inbox (cockpit_tickets,
// source='agent_delivery', intent='termination_letter'). Jurisdiction-aware:
// Spain → carta de despido with CCT Hostelería Baleares clauses; Laos →
// termination letter with Lao Labour Law 2014 Art. 82 notice reference.

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
  hire_date: string | null;
  monthly_eur: number;
  seniority_years: number;
  seniority_label: string;
  indem_unfair: number | null;
  indem_objective: number | null;
  indem_fixed_end: number | null;
  contract_type: string | null;
  reason: 'unfair' | 'objective' | 'fixed_term_end' | 'voluntary' | 'disciplinary';
  effective_date: string;
  jurisdiction: 'ES' | 'LA';
}

const REASON_LABEL_ES: Record<Body['reason'], string> = {
  unfair:         'Despido improcedente',
  objective:      'Despido objetivo (causa económica/organizativa)',
  disciplinary:   'Despido disciplinario',
  fixed_term_end: 'Fin de contrato de duración determinada',
  voluntary:      'Baja voluntaria',
};

const REASON_LABEL_LA: Record<Body['reason'], string> = {
  unfair:         'Unfair termination',
  objective:      'Notice termination',
  disciplinary:   'Disciplinary termination',
  fixed_term_end: 'End of fixed-term contract',
  voluntary:      'Voluntary resignation',
};

export async function POST(req: Request) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }); }

  if (!body?.employee_name || !body?.property_id) {
    return NextResponse.json({ ok: false, error: 'missing employee or property' }, { status: 400 });
  }

  const isES = body.jurisdiction === 'ES';
  const reasonLabel = isES ? REASON_LABEL_ES[body.reason] : REASON_LABEL_LA[body.reason];

  const indemFor = (r: Body['reason']): number | null => {
    if (r === 'unfair')         return body.indem_unfair;
    if (r === 'objective')      return body.indem_objective;
    if (r === 'fixed_term_end') return body.indem_fixed_end;
    return null;
  };
  const indem = indemFor(body.reason);

  const systemPrompt = isES
    ? `Eres Vera, abogada laboralista local de Donna Portals (Baleares, España), especialista en CCT Hostelería Baleares + Estatuto de los Trabajadores. Redactas cartas de despido formales, jurídicamente correctas, en español castellano, listas para firma del representante de la empresa.

ESTILO Y FORMATO:
- Encabezado: "CARTA DE DESPIDO" en mayúsculas, centrado.
- Datos de la empresa (Donna Portals SL, CIF, domicilio) — usa placeholders [CIF: ___] cuando falten datos.
- Datos del trabajador: nombre, NIF [___], categoría, antigüedad, salario mensual bruto.
- Cita expresa del artículo de Estatuto de los Trabajadores aplicable (52, 54, 55 según el motivo).
- Hechos: enumerados, factuales, sin adjetivos cargados.
- Indemnización: monto exacto, cálculo (días × años × salario diario), con la fórmula visible.
- Fecha de efectos del despido.
- Plazo y modo de impugnación (20 días hábiles, juzgado de lo social).
- Pie de firma: representante de la empresa + acuse de recibo del trabajador.
- NO uses emojis. NO inventes datos.`
    : `You are the HR Manager of The Namkhan (Luang Prabang, Laos). You draft formal termination letters compliant with the Lao Labour Law 2014, written in clear, professional English for the employee, ready for signature by the company representative.

STYLE AND FORMAT:
- Letterhead: "TERMINATION LETTER" centred, all caps.
- Company block: The Namkhan, Luang Prabang, Lao PDR.
- Employee block: name, position, hire date, last day worked.
- Cite the applicable Article of the Lao Labour Law 2014 (Art. 82 for notice termination, Art. 84 for disciplinary).
- Facts: enumerated, factual, no inflammatory language.
- Notice period: state the contractual or statutory notice given (default 30/45 days).
- Final settlement: itemise last salary, accrued unused leave, end-of-service gratuity if contractual.
- Effective date.
- Right to appeal: brief paragraph on Labour Inspection contact.
- Signature block: company representative + employee acknowledgment.
- NO emojis. NO fabrication. Use [bracketed placeholders] for missing data.`;

  const userPrompt = isES
    ? `Redacta la carta de despido formal. Motivo: ${reasonLabel}.

DATOS DEL TRABAJADOR:
- Nombre: ${body.employee_name}
- Departamento: ${body.department ?? '[___]'}
- Puesto / Categoría: ${body.position ?? '[___]'}
- Fecha de alta: ${body.hire_date ?? '[___]'}
- Antigüedad: ${body.seniority_label} (${body.seniority_years.toFixed(2)} años)
- Tipo de contrato: ${body.contract_type ?? '[___]'}
- Salario mensual bruto: €${Math.round(body.monthly_eur).toLocaleString('es-ES')}

INDEMNIZACIÓN APLICABLE:
${indem !== null && indem > 0
  ? `- Importe calculado: €${Math.round(indem).toLocaleString('es-ES')}
- Fórmula: ${body.reason === 'unfair' ? '33 días/año (tope 24 mensualidades)' : body.reason === 'objective' ? '20 días/año (tope 12 mensualidades)' : body.reason === 'fixed_term_end' ? '12 días/año (eventual/obra-servicio)' : 'sin indemnización'}
- Salario diario base: €${((body.monthly_eur * 12) / 365).toFixed(2)}`
  : '- Sin indemnización aplicable (despido disciplinario procedente / baja voluntaria).'}

FECHA DE EFECTOS: ${body.effective_date}

OUTPUT: solo la carta en markdown — sin preámbulo, sin notas para mí.`
    : `Draft the formal termination letter. Reason: ${reasonLabel}.

EMPLOYEE DATA:
- Name: ${body.employee_name}
- Department: ${body.department ?? '[___]'}
- Position: ${body.position ?? '[___]'}
- Hire date: ${body.hire_date ?? '[___]'}
- Seniority: ${body.seniority_label} (${body.seniority_years.toFixed(2)} years)
- Contract type: ${body.contract_type ?? '[___]'}

EFFECTIVE DATE: ${body.effective_date}

LAO CONTEXT:
- Cite Lao Labour Law 2014 Art. 82 for notice termination, Art. 84 for disciplinary.
- No statutory seniority/indemnización entitlement — only contractual end-of-service gratuity if granted.
- Default notice period: 30 days for monthly-paid, 45 days for managerial.

OUTPUT: only the letter in markdown — no preamble, no notes to me.`;

  const llm = await callAnthropic({
    systemPrompt,
    userPrompt,
    maxTokens: 3000,
  });

  if (!isLlmOk(llm)) {
    return NextResponse.json({ ok: false, error: `LLM failed: ${llm.error}` }, { status: 502 });
  }

  const letterMd = llm.text;
  const ticketSubject = `[Termination Letter] ${body.employee_name} · ${reasonLabel} · ${body.effective_date}`;
  const summary = [
    `**Termination letter draft** for ${body.employee_name}`,
    `**Reason:** ${reasonLabel} · **Effective:** ${body.effective_date}`,
    `**Jurisdiction:** ${isES ? 'Spain (CCT Baleares · ET)' : 'Laos (Labour Law 2014)'}`,
    `**Seniority:** ${body.seniority_label}${indem ? ` · **Indemnización:** €${Math.round(indem).toLocaleString('en-US')}` : ''}`,
    '',
    '---',
    '',
    letterMd,
    '',
    '---',
    `_AI-drafted · review by legal/HR before delivery to employee · ticket logs in audit trail._`,
  ].join('\n');

  const { data, error } = await SUPABASE
    .from('cockpit_tickets')
    .insert({
      source: 'agent_delivery',
      arm: 'agent_work',
      intent: 'termination_letter',
      status: 'awaits_user',
      email_subject: ticketSubject,
      parsed_summary: summary,
      metadata: {
        property_id: body.property_id,
        employee_id: body.employee_id,
        employee_name: body.employee_name,
        reason: body.reason,
        reason_label: reasonLabel,
        effective_date: body.effective_date,
        jurisdiction: body.jurisdiction,
        seniority_years: body.seniority_years,
        indem_amount_eur: indem,
        assigned_role: isES ? 'finance_hod_donna' : 'finance_hod',
        delivered_by_agent: isES ? 'Vera' : 'HR Namkhan',
        delivery_channel: 'hod_inbox',
        priority: 'normal',
        category: 'hr_termination',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'failed to file ticket' }, { status: 500 });
  }

  await SUPABASE.from('cockpit_audit_log').insert({
    agent: 'hr_termination_wizard',
    action: 'termination_letter_generated',
    target: `hr.employees:${body.employee_id}`,
    success: true,
    metadata: { property_id: body.property_id, ticket_id: data.id, reason: body.reason },
    reasoning: `Termination letter drafted for ${body.employee_name} (${reasonLabel}, effective ${body.effective_date}).`,
  }).then(() => null, () => null);

  return NextResponse.json({ ok: true, ticket_id: data.id, letter_chars: letterMd.length });
}
