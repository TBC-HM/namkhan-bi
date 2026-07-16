// app/api/mail/convert-to-lead/route.ts
// PBS 2026-07-15 · Convert a mail thread to a sales lead in one click.
// POST { thread_id } → extract lead info via Anthropic → fn_lead_upsert → { ok, lead_id }
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentAuthUser, getThread } from '@/lib/userGmail';
import { extractLeadInfo } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN_PROPERTY_ID = 260955;

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

  // 1) Fetch full thread + first message body via existing Gmail helper.
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

  // 2) Call Anthropic to extract structured lead info.
  let info;
  try {
    info = await extractLeadInfo(rawBody, parsed.name, parsed.email, first.subject || '');
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'ai_extract_failed', detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  // 3) Upsert into sales.leads via SECURITY DEFINER RPC.
  const sb = getSupabaseAdmin();
  const payload = {
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

  const { data, error } = await sb.rpc('fn_lead_upsert', { p: payload });
  if (error) {
    return NextResponse.json({ ok: false, error: 'lead_upsert_failed', detail: error.message }, { status: 500 });
  }
  // fn_lead_upsert returns jsonb → {"lead_id": <bigint>}
  let lead_id: number | null = null;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const raw = d.lead_id ?? d.id;
    if (typeof raw === 'number') lead_id = raw;
    else if (typeof raw === 'string') { const n = parseInt(raw, 10); if (Number.isFinite(n)) lead_id = n; }
  }

  return NextResponse.json({ ok: true, lead_id, extracted: info });
}
