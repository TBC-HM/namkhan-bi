// app/api/sales/proposals/create-from-lead/route.ts
// PBS 2026-07-15 — spawn a sales.proposals row pre-filled from a lead.
// Input: { lead_id: number, template_id: string, date_in?: 'YYYY-MM-DD', date_out?: 'YYYY-MM-DD' }
// Output: { id: string } → caller navigates to /sales/proposals/{id}/edit
//
// - Uses getSupabaseAdmin() (service role) + sb.schema('sales') insert,
//   mirroring the existing createProposalFromInquiry() pattern in lib/sales.ts.
// - Guest snapshot fields come from the lead's decision_maker_name / company_name.
// - inquiry_id stays NULL (leads are a distinct funnel entry point);
//   linkage back to the lead uses the new sales.proposals.lead_id column
//   (added 2026-07-15 migration).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  lead_id?: number;
  template_id?: string;
  date_in?: string | null;
  date_out?: string | null;
}

export async function POST(req: Request) {
  let body: Body = {};
  try { body = (await req.json()) as Body; } catch {}

  const leadId = Number(body.lead_id);
  const templateId = (body.template_id ?? '').trim();
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
  }
  if (!templateId) {
    return NextResponse.json({ error: 'template_id required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // 1) Fetch lead (service role sees sales.leads via sb.schema()).
  const { data: lead, error: leadErr } = await sb
    .schema('sales')
    .from('leads')
    .select('id, property_id, company_name, decision_maker_name, email')
    .eq('id', leadId)
    .maybeSingle();

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });

  // 2) Validate template belongs to same property (defence in depth).
  const { data: tpl, error: tplErr } = await sb
    .schema('sales')
    .from('proposal_templates')
    .select('id, property_id, name, kind, is_active')
    .eq('id', templateId)
    .maybeSingle();

  if (tplErr) return NextResponse.json({ error: tplErr.message }, { status: 500 });
  if (!tpl)  return NextResponse.json({ error: 'template_not_found' }, { status: 404 });
  if ((tpl as { property_id: number }).property_id !== (lead as { property_id: number }).property_id) {
    return NextResponse.json({ error: 'template_property_mismatch' }, { status: 400 });
  }
  if ((tpl as { is_active: boolean }).is_active === false) {
    return NextResponse.json({ error: 'template_inactive' }, { status: 400 });
  }

  // 3) Compose guest-name snapshot: prefer decision-maker name, fall back to company.
  const guestName = (
    (lead as { decision_maker_name: string | null }).decision_maker_name ??
    (lead as { company_name: string | null }).company_name ??
    'guest'
  );

  // 4) Insert proposal row. inquiry_id left NULL by design.
  const { data: created, error: insErr } = await sb
    .schema('sales')
    .from('proposals')
    .insert({
      property_id:         (lead as { property_id: number }).property_id,
      template_id:         templateId,
      lead_id:             leadId,
      status:              'draft',
      guest_name_snapshot: guestName,
      date_in_snapshot:    body.date_in  ?? null,
      date_out_snapshot:   body.date_out ?? null,
    })
    .select('id')
    .single();

  if (insErr || !created) {
    return NextResponse.json({ error: insErr?.message ?? 'insert_failed' }, { status: 500 });
  }

  const newId = (created as { id: string }).id;

  // 5) Seed a bare proposal_emails row so the composer has an initial email object.
  //    Mirrors the seed inside createProposalFromInquiry().
  try {
    await sb.schema('sales').from('proposal_emails').insert({
      proposal_id: newId,
      version:     1,
      subject:     'Your stay at The Namkhan',
      intro_md:    'Dear ' + guestName + ',\n\nWe drew up something quiet for you. Take what you like, leave what you don\'t — the page lets you adjust.',
      outro_md:    'If anything wants changing, write back. We sit on the river and we have time.',
      ps_md:       'P.S. The boat leaves at 06:30. The light is the reason.',
    });
  } catch (_) {
    // non-fatal: composer will create the email row on first save.
  }

  return NextResponse.json({ id: newId, lead_id: leadId, template_id: templateId });
}
