// POST /api/sales/email-ingest
// Receives inbound + outbound mail from Make.com Gmail watchers (book@, wm@,
// reservations@) for the three Namkhan mailboxes.
//
// Auth: X-Make-Token header must equal env MAKE_INGEST_TOKEN.
// Dedupe: by (property_id, message_id) unique index.
// Threading: every message inserted into sales.email_messages.
//   • inbound  → if no existing inquiry for this thread → create one; link.
//   • outbound → match by thread_id to existing inquiry; link (no inquiry created).
// Triage: keyword-based, applied only to inbound messages that create an inquiry.
//
// Request body (JSON):
// {
//   "direction": "inbound" | "outbound",     // required
//   "mailbox": "book@thenamkhan.com",         // required (which inbox saw it)
//   "from": "Jane <jane@example.com>",        // required
//   "to": "book@thenamkhan.com",              // string OR string[]
//   "cc": [],                                 // optional, string[]
//   "subject": "...",                         // required
//   "body_text": "...",
//   "body_html": "<p>...</p>",
//   "received_at": "2026-05-04T14:30:00Z",
//   "message_id": "<CABCDe...@mail.gmail.com>", // required (RFC 2822 Message-Id)
//   "thread_id":  "184a8...",                 // Gmail thread id, recommended
//   "in_reply_to": "<other-msg-id>",          // optional
//   "gmail_msg_id": "184ab..."                // optional, Gmail internal id
// }
//
// Response: { ok, message_id_db, inquiry_id, action: 'inserted'|'duplicate', linked: bool }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------- helpers ----------

function parseFromHeader(raw: string | undefined): { name: string | null; email: string | null } {
  if (!raw) return { name: null, email: null };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/) ?? raw.match(/^\s*([^<\s]+@[^>\s]+)\s*$/);
  if (!m) return { name: null, email: null };
  if (m.length === 3) return { name: (m[1] || '').trim() || null, email: (m[2] || '').trim().toLowerCase() };
  return { name: null, email: (m[1] || '').trim().toLowerCase() };
}

function normalizeToList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function sourceFromMailbox(mailbox: string | undefined): string {
  if (!mailbox) return 'Direct email';
  const t = mailbox.toLowerCase();
  if (t.includes('book@'))         return 'Direct email';
  if (t.includes('reservations@')) return 'Reservations';
  if (t.includes('wm@'))           return 'Wholesale/B2B';
  return 'Direct email';
}

// Match ANY namkhan.com address (and a few other monitored domains).
// No fixed list — adding a new alias on the Workspace just appears in the UI tabs.
const NAMKHAN_DOMAIN_RE = /@(thenamkhan|namkhan)\.com\s*$/i;
// Catch literal email anywhere in a string (handles "Name <addr>" forms)
const ANY_EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

function extractEmailsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  return (text.match(ANY_EMAIL_RE) ?? []).map(s => s.toLowerCase());
}

function detectIntendedMailbox(opts: {
  toEmails: string[];
  ccEmails: string[];
  bodyText: string | null;
  fallbackMailbox: string;
}): string {
  // 1) Look in To/Cc lists for any @thenamkhan.com address
  const headerAddrs = [...opts.toEmails, ...opts.ccEmails]
    .map(s => s.toLowerCase().trim())
    .flatMap(s => s.match(ANY_EMAIL_RE) ?? [s]);
  const headerHit = headerAddrs.find(a => NAMKHAN_DOMAIN_RE.test(a));
  if (headerHit) return headerHit;

  // 2) If still nothing (rare — auto-forwarder may strip original To), scan the body
  //    for "To: x@thenamkhan.com" or "Delivered-To: x@thenamkhan.com" patterns left
  //    by Gmail's forwarder.
  if (opts.bodyText) {
    const bodyLower = opts.bodyText.toLowerCase();
    const m = bodyLower.match(/(?:^|\n)(?:to|delivered-to|original-recipient|x-original-to):\s*[^\n]*?([\w.+-]+@(?:thenamkhan|namkhan)\.com)/i);
    if (m && m[1]) return m[1].toLowerCase();
    // Or any namkhan address in the body's first 2k chars (forward header block)
    const bodyHit = (opts.bodyText.slice(0, 2000).match(ANY_EMAIL_RE) ?? [])
      .map(s => s.toLowerCase())
      .find(a => NAMKHAN_DOMAIN_RE.test(a));
    if (bodyHit) return bodyHit;
  }

  // 3) Fall back to the forwarder mailbox (so it's not lost)
  return opts.fallbackMailbox;
}

function detectDirection(fromEmail: string | null, declared: 'inbound' | 'outbound'): 'inbound' | 'outbound' {
  // If sender domain matches our monitored domains → it's outbound regardless of declaration.
  if (fromEmail && NAMKHAN_DOMAIN_RE.test(fromEmail)) return 'outbound';
  return declared;
}

function detectLanguage(text: string): string {
  const t = (text || '').slice(0, 500).toLowerCase();
  if (/\b(bonjour|merci|nous sommes|j'aimerais|réservation)\b/.test(t)) return 'FR';
  if (/\b(guten tag|wir sind|grüße|hallo|reservierung)\b/.test(t))      return 'DE';
  if (/\b(hola|nosotros|gracias|reserva|saludos)\b/.test(t))            return 'ES';
  if (/[一-鿿]/.test(t))    return 'ZH';
  if (/[぀-ヿ]/.test(t))    return 'JA';
  if (/[຀-໿]/.test(t))    return 'LO';
  if (/[฀-๿]/.test(t))    return 'TH';
  return 'EN';
}

function extractParty(text: string): { adults: number | null; children: number | null } {
  const t = (text || '').toLowerCase();
  const adults = t.match(/(\d+)\s*(?:adults?|pax|persons?|guests?|people)/);
  const kids   = t.match(/(\d+)\s*(?:kids?|child(?:ren)?|infant)/);
  return {
    adults: adults ? Math.min(50, parseInt(adults[1], 10)) : null,
    children: kids ? Math.min(20, parseInt(kids[1], 10)) : null,
  };
}

function extractDates(text: string): { date_in: string | null; date_out: string | null } {
  const iso = (text || '').match(/(\d{4}-\d{2}-\d{2})\s*(?:to|→|-|–|—|until)\s*(\d{4}-\d{2}-\d{2})/);
  if (iso) return { date_in: iso[1], date_out: iso[2] };
  return { date_in: null, date_out: null };
}

function triage(subject: string, body: string): { kind: string; conf: number } {
  const t = `${subject} ${body}`.toLowerCase();
  const score = (re: RegExp) => (t.match(re) ?? []).length;
  const tally: Array<[string, number]> = [
    ['group',   score(/\b(group|groups|conference|delegation|company|corporate|team)\b/g) +
                (score(/\b(\d{2,})\s*(rooms?|guests?|pax|adults)\b/g) > 0 ? 2 : 0)],
    ['wedding', score(/\b(wedding|nuptial|bride|groom|ceremony|reception)\b/g) * 2],
    ['retreat', score(/\b(retreat|yoga|meditation|wellness|silent|workshop|mindfulness)\b/g) * 2],
    ['package', score(/\b(package|bundle|all[- ]?inclusive|honeymoon|romantic)\b/g)],
    ['b2b',     score(/\b(agent|wholesaler|operator|tour|allotment|rate sheet|net rate|contract|dmc)\b/g) * 2],
    ['ota',     score(/\b(booking\.com|expedia|agoda|trip\.com|airbnb)\b/g) * 3],
    ['fit',     score(/\b(family|couple|honeymoon|us 2|just the two|me and|our trip)\b/g)],
  ];
  tally.sort((a, b) => b[1] - a[1]);
  const top = tally[0];
  if (top[1] === 0) return { kind: 'fit', conf: 0.5 };
  const total = tally.reduce((s, [, n]) => s + n, 0);
  const conf = Math.min(0.95, 0.55 + (top[1] / Math.max(1, total)) * 0.4);
  return { kind: top[0], conf: Number(conf.toFixed(2)) };
}

// ---------- handler ----------

interface IngestBody {
  direction?: 'inbound' | 'outbound';
  mailbox?: string;
  from?: string | { address?: string; name?: string };
  to?: unknown;
  cc?: unknown;
  subject?: string;
  body_text?: string;
  text?: string;          // Gmail native field name
  body_html?: string;
  html?: string;          // Gmail native field name
  received_at?: string;
  date?: string;          // Gmail native field name
  message_id?: string;
  messageId?: string;     // Gmail native field name
  thread_id?: string;
  threadId?: string;      // Gmail native field name
  in_reply_to?: string;
  inReplyTo?: string;     // Gmail native field name
  gmail_msg_id?: string;
  id?: string;            // Gmail native field name
  ingest_source?: string;
}

/** Coerce a value (string OR Make/Gmail object {address,name}) to "Name <addr>" string. */
function fromHeaderToString(v: IngestBody['from']): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const addr = v.address ?? '';
  const name = v.name ?? '';
  return name ? `${name} <${addr}>` : addr;
}

/** Coerce Make's `to: [{address}]` array form into a comma-separated email string. */
function toArrayToString(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    return v.map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const addr = (item as { address?: string }).address;
        if (addr) return addr;
      }
      return '';
    }).filter(Boolean).join(',');
  }
  return '';
}

export async function POST(req: Request) {
  // 1) Auth
  const expected = process.env.MAKE_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'server_not_configured', detail: 'MAKE_INGEST_TOKEN not set' }, { status: 500 });
  }
  const got = req.headers.get('x-make-token');
  if (got !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2) Parse body
  let payload: IngestBody;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  // Accept BOTH our canonical field names AND Make/Gmail-native field names.
  // If Make posts the entire bundle ({{1}}), it'll have the Gmail-native shape.
  const direction = payload.direction ?? 'inbound';
  const mailbox = payload.mailbox ?? 'pb@thenamkhan.com';
  const from = fromHeaderToString(payload.from);
  const subject = payload.subject ?? '';
  const body_text = payload.body_text ?? payload.text ?? '';
  const body_html = payload.body_html ?? payload.html ?? '';
  const received_at = payload.received_at ?? payload.date ?? new Date().toISOString();
  const message_id = payload.message_id ?? payload.messageId ?? '';
  const thread_id = payload.thread_id ?? payload.threadId ?? '';
  const in_reply_to = payload.in_reply_to ?? payload.inReplyTo ?? '';
  const gmail_msg_id = payload.gmail_msg_id ?? payload.id ?? '';
  const ingest_source = payload.ingest_source ?? 'make.gmail';

  if (!['inbound','outbound'].includes(direction)) {
    return NextResponse.json({ error: 'invalid_direction', allowed: ['inbound','outbound'] }, { status: 400 });
  }
  if (!from || !subject || !message_id) {
    return NextResponse.json({
      error: 'missing_fields',
      required: ['from','subject','message_id'],
      received: { from: !!from, subject: !!subject, message_id: !!message_id },
    }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const sender = parseFromHeader(from);
  // Accept both string CSV and array-of-{address} forms (Gmail-native is array of objects)
  const toList = Array.isArray(payload.to)
    ? toArrayToString(payload.to).split(',').filter(Boolean)
    : normalizeToList(payload.to);
  const ccList = Array.isArray(payload.cc)
    ? toArrayToString(payload.cc).split(',').filter(Boolean)
    : normalizeToList(payload.cc);
  const bodyText = body_text || (body_html ? body_html.replace(/<[^>]+>/g, ' ').slice(0, 50000) : '');
  const recAt = received_at;

  // Auto-route: original recipient (book@/wm@/...) before forwarding to pb@.
  const intendedMailbox = detectIntendedMailbox({
    toEmails: toList,
    ccEmails: ccList,
    bodyText,
    fallbackMailbox: mailbox.toLowerCase(),
  });
  // Auto-detect outbound when sender domain is @thenamkhan.com.
  const finalDirection = detectDirection(sender.email, direction);

  // 3) Dedupe — same property_id + message_id already inserted?
  const { data: existing } = await sb
    .schema('sales')
    .from('email_messages')
    .select('id, inquiry_id')
    .eq('property_id', PROPERTY_ID)
    .eq('message_id', message_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      ok: true,
      message_id_db: (existing as { id: string }).id,
      inquiry_id: (existing as { inquiry_id: string | null }).inquiry_id,
      action: 'duplicate',
    });
  }

  // 4) Find inquiry to link.
  //    inbound  → match by thread_id; if none, create new inquiry.
  //    outbound → match by thread_id only; if none, leave inquiry_id null (orphan reply).
  let inquiryId: string | null = null;
  if (thread_id) {
    const { data: linked } = await sb
      .schema('sales')
      .from('email_messages')
      .select('inquiry_id')
      .eq('property_id', PROPERTY_ID)
      .eq('thread_id', thread_id)
      .not('inquiry_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (linked?.inquiry_id) inquiryId = (linked as { inquiry_id: string }).inquiry_id;
  }

  // 5) For inbound with no existing inquiry → create one
  let createdInquiry = false;
  let triageResult: { kind: string; conf: number } | null = null;
  if (finalDirection === 'inbound' && !inquiryId) {
    const lang = detectLanguage(`${subject} ${bodyText}`);
    const party = extractParty(bodyText);
    const dates = extractDates(`${subject} ${bodyText}`);
    triageResult = triage(subject, bodyText);
    // Source comes from the INTENDED recipient, not the forwarder mailbox.
    const source = sourceFromMailbox(intendedMailbox);

    const { data: inserted, error: inqErr } = await sb
      .schema('sales')
      .from('inquiries')
      .insert({
        property_id: PROPERTY_ID,
        source,
        channel_ref: message_id,           // pointer to the originating email
        guest_name: sender.name,
        guest_email: sender.email,
        guest_phone: null,
        country: null,
        language: lang,
        party_adults: party.adults,
        party_children: party.children,
        date_in: dates.date_in,
        date_out: dates.date_out,
        status: 'new',
        raw_payload: {
          from, to: toList, cc: ccList, subject,
          body: bodyText.slice(0, 50000),
          received_at: recAt,
          message_id, thread_id,
          ingest_source: ingest_source ?? 'make.gmail',
        },
        triage_kind: triageResult.kind,
        triage_conf: triageResult.conf,
      })
      .select('id')
      .single();
    if (inqErr) {
      console.error('[email-ingest] inquiry insert failed', inqErr);
      return NextResponse.json({ error: 'inquiry_insert_failed', detail: inqErr.message }, { status: 500 });
    }
    inquiryId = (inserted as { id: string }).id;
    createdInquiry = true;
  }

  // 6) Insert the email_messages row
  const { data: msgInserted, error: msgErr } = await sb
    .schema('sales')
    .from('email_messages')
    .insert({
      property_id: PROPERTY_ID,
      message_id,
      thread_id: thread_id ?? null,
      in_reply_to: in_reply_to ?? null,
      direction: finalDirection,
      mailbox: mailbox.toLowerCase(),
      intended_mailbox: intendedMailbox,
      from_email: sender.email,
      from_name: sender.name,
      to_emails: toList,
      cc_emails: ccList,
      subject,
      body_text: bodyText.slice(0, 200000),
      body_html: body_html?.slice(0, 200000) ?? null,
      received_at: recAt,
      gmail_msg_id: gmail_msg_id ?? null,
      inquiry_id: inquiryId,
      raw_payload: { from, original: payload },
      ingest_source: ingest_source ?? 'make.gmail',
    })
    .select('id')
    .single();
  if (msgErr) {
    console.error('[email-ingest] email insert failed', msgErr);
    return NextResponse.json({ error: 'message_insert_failed', detail: msgErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message_id_db: (msgInserted as { id: string }).id,
    inquiry_id: inquiryId,
    action: 'inserted',
    direction,
    inquiry_created: createdInquiry,
    triage: triageResult,
    linked: !!inquiryId,
  });
}

// Healthcheck
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/sales/email-ingest',
    accepts: ['POST'],
    auth: 'X-Make-Token header required',
    schema_version: 2,
    ts: new Date().toISOString(),
  });
}
