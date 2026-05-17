// app/api/hr/contract-letter/route.ts
//
// PBS 2026-05-15: Generate a personalised employment contract by loading
// one of Vera's HR templates from dms.documents (doc_subtype = hr_contract_*),
// asking Claude to substitute {{placeholders}} with the candidate data the
// onboarding wizard provides, then filing the result in the Reports inbox
// (cockpit_tickets) AND in dms.documents as a new contract draft.

import { NextResponse } from 'next/server';
import { callAnthropic, isLlmOk, SUPABASE } from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ContractType =
  | 'hr_contract_indefinido'
  | 'hr_contract_eventual'
  | 'hr_contract_fijo_discontinuo'
  | 'hr_contract_autonomo';

interface Body {
  property_id: number;
  contract_type: ContractType;
  candidate: Record<string, string | number | null>;
}

const CONTRACT_LABEL: Record<ContractType, string> = {
  hr_contract_indefinido:       'Contrato indefinido',
  hr_contract_eventual:         'Contrato eventual (circunstancias de producción)',
  hr_contract_fijo_discontinuo: 'Contrato fijo-discontinuo',
  hr_contract_autonomo:         'Contrato mercantil autónomo',
};

export async function POST(req: Request) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }); }

  if (!body?.property_id || !body?.contract_type || !body?.candidate?.trabajador_nombre) {
    return NextResponse.json({ ok: false, error: 'missing property_id, contract_type, or candidate.trabajador_nombre' }, { status: 400 });
  }

  // Load Vera's template
  const { data: templateRow, error: tErr } = await SUPABASE
    .schema('dms')
    .from('documents')
    .select('doc_id, title, body_markdown, language')
    .eq('property_id', body.property_id)
    .eq('doc_type', 'template')
    .eq('doc_subtype', body.contract_type)
    .eq('source', 'vera_draft')
    .limit(1)
    .maybeSingle();

  if (tErr || !templateRow?.body_markdown) {
    return NextResponse.json({ ok: false, error: `template ${body.contract_type} not found in dms` }, { status: 404 });
  }

  const systemPrompt = `Eres Vera, abogada laboralista local de Donna Portals (Mallorca, Illes Balears). Recibes una PLANTILLA de contrato laboral con placeholders en formato {{nombre_campo}} y los DATOS del candidato. Tu tarea: sustituir cada placeholder por el dato correspondiente, manteniendo el español jurídico exacto del original.

REGLAS:
- Sustituye CADA placeholder. Si un dato falta, deja "[___]" en su lugar para que HR lo complete manualmente.
- NO modifiques las cláusulas legales, citas a artículos del ET, ni la estructura.
- NO inventes datos del candidato.
- Mantén el banner inicial de "DRAFT TEMPLATE · pendiente revisión por Vera" si está presente, sustituyéndolo por "DRAFT · personalizado para {{trabajador_nombre}} · pendiente revisión legal".
- OUTPUT: solo el contrato personalizado en markdown, sin preámbulo, sin notas para mí.`;

  const userPrompt = `PLANTILLA (${CONTRACT_LABEL[body.contract_type]}):
\`\`\`
${templateRow.body_markdown}
\`\`\`

DATOS DEL CANDIDATO Y EMPRESA:
${Object.entries(body.candidate).map(([k, v]) => `- {{${k}}} = ${v ?? '[___]'}`).join('\n')}

Genera el contrato personalizado.`;

  const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 6000 });
  if (!isLlmOk(llm)) {
    return NextResponse.json({ ok: false, error: `LLM failed: ${llm.error}` }, { status: 502 });
  }

  const contractMd = llm.text;
  const candidateName = String(body.candidate.trabajador_nombre || '[Sin nombre]');
  const subject = `[Contract Draft] ${CONTRACT_LABEL[body.contract_type]} · ${candidateName}`;
  const summary = [
    `**Contract draft** · ${CONTRACT_LABEL[body.contract_type]}`,
    `**Candidate:** ${candidateName}`,
    `**Template source:** dms.documents \`${templateRow.doc_id}\` (Vera draft)`,
    '',
    '---',
    '',
    contractMd,
    '',
    '---',
    `_AI-personalised from Vera's template · review by legal before delivery to candidate._`,
  ].join('\n');

  // File in Reports inbox
  const { data: ticketRow, error: tickErr } = await SUPABASE
    .from('cockpit_tickets')
    .insert({
      source: 'agent_delivery',
      arm: 'agent_work',
      intent: 'contract_draft',
      status: 'awaits_user',
      email_subject: subject,
      parsed_summary: summary,
      metadata: {
        property_id: body.property_id,
        contract_type: body.contract_type,
        contract_label: CONTRACT_LABEL[body.contract_type],
        candidate_name: candidateName,
        template_doc_id: templateRow.doc_id,
        assigned_role: 'finance_hod_donna',
        delivered_by_agent: 'Vera',
        delivery_channel: 'hod_inbox',
        priority: 'normal',
        category: 'hr_contract',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (tickErr || !ticketRow) {
    return NextResponse.json({ ok: false, error: tickErr?.message ?? 'failed to file ticket' }, { status: 500 });
  }

  // File personalised contract as new dms.documents row (status=draft, source=ai_generated)
  let dmsRowId: string | null = null;
  try {
    const { data: dmsRow } = await SUPABASE.schema('dms').from('documents').insert({
      property_id: body.property_id,
      doc_type: 'hr_doc',
      doc_subtype: 'contract_personalised',
      title: subject,
      body_markdown: contractMd,
      language: 'es',
      status: 'draft',
      sensitivity: 'restricted',
      importance: 'critical',
      source: 'ai_generated',
      tags: ['hr_contract', body.contract_type, 'personalised'],
      summary: `Personalised ${CONTRACT_LABEL[body.contract_type]} for ${candidateName} · template ${templateRow.doc_id} · ticket ${ticketRow.id}`,
      last_sync_at: new Date().toISOString(),
      raw: { template_doc_id: templateRow.doc_id, source_ticket_id: ticketRow.id, candidate: body.candidate },
      parent_doc_id: templateRow.doc_id,
    }).select('doc_id').single();
    dmsRowId = dmsRow?.doc_id ?? null;
  } catch { /* dms best-effort */ }

  // Audit log
  await SUPABASE.from('cockpit_audit_log').insert({
    agent: 'hr_contract_generator',
    action: 'contract_draft_generated',
    target: dmsRowId ? `dms.documents:${dmsRowId}` : `cockpit_tickets:${ticketRow.id}`,
    success: true,
    metadata: { property_id: body.property_id, contract_type: body.contract_type, ticket_id: ticketRow.id, dms_id: dmsRowId },
    reasoning: `Contract draft (${CONTRACT_LABEL[body.contract_type]}) generated for ${candidateName} from template ${templateRow.doc_id}.`,
  }).then(() => null, () => null);

  return NextResponse.json({
    ok: true,
    ticket_id: ticketRow.id,
    dms_doc_id: dmsRowId,
    contract_chars: contractMd.length,
    contract_label: CONTRACT_LABEL[body.contract_type],
  });
}
