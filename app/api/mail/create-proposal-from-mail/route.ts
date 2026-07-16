// app/api/mail/create-proposal-from-mail/route.ts
// PBS 2026-07-15 · One-click Convert-to-Lead + Draft-Proposal from a mail thread.
// POST { thread_id } → same lead-extract flow as convert-to-lead + creates a
// draft sales.proposals row via SECURITY DEFINER fn_proposal_create_from_lead.
// Returns { ok, lead_id, proposal_id } → client redirects to /sales/proposals/{proposal_id}/edit.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentAuthUser, getThread } from '@/lib/userGmail';
import { extractLeadInfo } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN_PROPERTY_ID = 260955;
// namkhan-fit-standard · sales.proposal_templates
const DEFAULT_TEMPLATE_ID = '7cdfb509-a031-4218-902a-9ceb7b2956bb';

const TEMPLATE_BY_DEAL: Record<string, string> = {
  fit:     '7cdfb509-a031-4218-902a-9ceb7b2956bb', // namkhan-fit-standard
  group:   'adb3f0cd-90e2-4bbf-a26a-fcb899857938', // namkhan-group-medium
  wedding: '84781396-a05b-4e10-98a2-763317ba17aa', // namkhan-wedding-buyout
  retreat: '553ebf8e-3fef-4b3b-9aa3-9b84d6f9fce5', // namkhan-retreat-themed
  package: '97b1ccce-354a-42c8-a378-d2b52e579f6c', // namkhan-package-honeymoon
  b2b:     'f2742634-ce3e-4675-9b22-a3b14d2d6d16', // namkhan-b2b-dmc
};

function parseFrom(raw: string): { name: string; email: string } {
  if (!raw) return { name: '', email: '' };
  const m = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || '').trim(), email: (m[2] || '').trim().toLowerCase() };
  return { name: '', email: raw.trim().toLowerCase() };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });

  let body: { thread_id?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const thread_id = (body.thread_id || '').trim();
  if (!thread_id) return NextResponse.json({ ok: false, error: 'missing_thread_id' }, { status: 400 });

  // 1) Full thread + first message.
  let messages;
  try {
    messages = await getThread(user.id, thread_id);
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'thread_fetch_failed', detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  if (!messages || messages.length === 0) {
    return NextResponse.json({ ok: false, error: 'empty_thread' }, { status: 404 });
  }
  const first = messages[0];
  const parsed = parseFrom(first.from || '');
  const rawBody = (first.textBody || first.htmlBody.replace(/<[^>]+>/g, '\n')).replace(/\n{3,}/g, '\n\n').trim();

  // 2) Extract lead info via Anthropic.
  let info;
  try {
    info = await extractLeadInfo(rawBody, parsed.name, parsed.email, first.subject || '');
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'ai_extract_failed', detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  const sb = getSupabaseAdmin();

  // 3) Upsert lead.
  const leadPayload = {
    property_id: NAMKHAN_PROPERTY_ID,
    status: 'active',
    stage: 'new',
    origin: 'inbound_email',
    source: 'mail_inbox',
    source_ref: thread_id,
    email_thread_id: thread_id,
    first_message_id: first.id,
    company_name:        info.company_name || parsed.name || parsed.email.split('@')[0],
    decision_maker_name: info.decision_maker_name,
    decision_maker_role: info.decision_maker_role,
    email:               info.email || parsed.email,
    phone_whatsapp:      info.phone_whatsapp,
    website:             info.website,
    instagram_url:       info.instagram_url,
    country:             info.country,
    city:                info.city,
    language:            info.language,
    deal_type:           info.deal_type,
    notes:               info.notes,
    retreat_history:     info.retreat_history === true ? 'yes' : info.retreat_history === false ? 'no' : null,
    audience_size_proxy: info.audience_size_proxy != null ? String(info.audience_size_proxy) : null,
  };

  const { data: leadData, error: leadErr } = await sb.rpc('fn_lead_upsert', { p: leadPayload });
  if (leadErr) {
    return NextResponse.json({ ok: false, error: 'lead_upsert_failed', detail: leadErr.message }, { status: 500 });
  }
  let lead_id: number | null = null;
  if (leadData && typeof leadData === 'object') {
    const d = leadData as Record<string, unknown>;
    const raw = d.lead_id ?? d.id;
    if (typeof raw === 'number') lead_id = raw;
    else if (typeof raw === 'string') { const n = parseInt(raw, 10); if (Number.isFinite(n)) lead_id = n; }
  }
  if (!lead_id) {
    return NextResponse.json({ ok: false, error: 'lead_id_missing' }, { status: 500 });
  }

  // 4) Create draft proposal.
  const template_id = (info.deal_type && TEMPLATE_BY_DEAL[info.deal_type]) || DEFAULT_TEMPLATE_ID;
  const guest = info.decision_maker_name || info.company_name || parsed.name || parsed.email;

  const { data: propData, error: propErr } = await sb.rpc('fn_proposal_create_from_lead', {
    p: {
      lead_id,
      property_id: NAMKHAN_PROPERTY_ID,
      template_id,
      guest_name_snapshot: guest,
    },
  });
  if (propErr) {
    return NextResponse.json({ ok: false, error: 'proposal_create_failed', detail: propErr.message, lead_id }, { status: 500 });
  }
  let proposal_id: string | null = null;
  if (propData && typeof propData === 'object') {
    const d = propData as Record<string, unknown>;
    if (typeof d.proposal_id === 'string') proposal_id = d.proposal_id;
  }
  if (!proposal_id) {
    return NextResponse.json({ ok: false, error: 'proposal_id_missing', lead_id }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead_id, proposal_id, extracted: info });
}
