// GET /api/cron/poll-gmail
// Vercel Cron entrypoint. For each row in sales.gmail_connections (not paused):
//  1. Mint a fresh access_token via refresh_token
//  2. List messages matching `q=after:YYYY/MM/DD` since last_synced_at (or 2026-01-01 first run)
//  3. Page through; for each message, fetch full content
//  4. Insert into sales.email_messages (dedupe by message_id) — re-uses the
//     same logic as /api/sales/email-ingest by sharing the parser/triager helpers
//
// Auth: query param ?key=<CRON_SECRET> OR Vercel's automatic Authorization
// header (Vercel cron sends Bearer <CRON_SECRET>).
//
// Manual trigger: hit the URL with ?key=... ?force_email=pb@thenamkhan.com&since=2026-01-01

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import {
  refreshAccessToken,
  listGmailMessages,
  getGmailMessage,
  getHeader,
  extractBodies,
  type GmailMessageFull,
} from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — backfill can take a while

const NAMKHAN_DOMAIN_RE = /@(thenamkhan|namkhan)\.com\s*$/i;
const ANY_EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// ---- helpers (small versions; bigger versions live in /api/sales/email-ingest) ----

function detectIntendedMailbox(toEmails: string[], ccEmails: string[], bodyText: string, fallback: string): string {
  const all = [...toEmails, ...ccEmails].map(s => s.toLowerCase().trim()).flatMap(s => s.match(ANY_EMAIL_RE) ?? [s]);
  const headerHit = all.find(a => NAMKHAN_DOMAIN_RE.test(a));
  if (headerHit) return headerHit;
  if (bodyText) {
    const m = bodyText.toLowerCase().match(/(?:^|\n)(?:to|delivered-to|original-recipient|x-original-to):\s*[^\n]*?([\w.+-]+@(?:thenamkhan|namkhan)\.com)/i);
    if (m && m[1]) return m[1].toLowerCase();
    const bodyHit = (bodyText.slice(0, 2000).match(ANY_EMAIL_RE) ?? []).map(s => s.toLowerCase()).find(a => NAMKHAN_DOMAIN_RE.test(a));
    if (bodyHit) return bodyHit;
  }
  return fallback;
}
function parseFromHeader(raw: string | null): { name: string | null; email: string | null } {
  if (!raw) return { name: null, email: null };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/) ?? raw.match(/^\s*([^<\s]+@[^>\s]+)\s*$/);
  if (!m) return { name: null, email: null };
  if (m.length === 3) return { name: (m[1] || '').trim() || null, email: (m[2] || '').trim().toLowerCase() };
  return { name: null, email: (m[1] || '').trim().toLowerCase() };
}
function parseAddressList(raw: string | null): string[] {
  if (!raw) return [];
  return (raw.match(ANY_EMAIL_RE) ?? []).map(s => s.toLowerCase());
}
function detectLanguage(text: string): string {
  const t = (text || '').slice(0, 500).toLowerCase();
  if (/\b(bonjour|merci|nous sommes|j'aimerais|réservation)\b/.test(t)) return 'FR';
  if (/\b(guten tag|wir sind|grüße|hallo|reservierung)\b/.test(t)) return 'DE';
  if (/\b(hola|nosotros|gracias|reserva|saludos)\b/.test(t)) return 'ES';
  if (/[一-鿿]/.test(t)) return 'ZH';
  if (/[぀-ヿ]/.test(t)) return 'JA';
  if (/[฀-๿]/.test(t)) return 'TH';
  return 'EN';
}
function triage(subject: string, body: string): { kind: string; conf: number } {
  const t = `${subject} ${body}`.toLowerCase();
  const score = (re: RegExp) => (t.match(re) ?? []).length;
  const tally: Array<[string, number]> = [
    ['group',   score(/\b(group|conference|delegation|company|corporate|team)\b/g) + (score(/\b(\d{2,})\s*(rooms?|guests?|pax)\b/g) > 0 ? 2 : 0)],
    ['wedding', score(/\b(wedding|nuptial|bride|groom|ceremony|reception)\b/g) * 2],
    ['retreat', score(/\b(retreat|yoga|meditation|wellness|silent|workshop)\b/g) * 2],
    ['package', score(/\b(package|bundle|all[- ]?inclusive|honeymoon)\b/g)],
    ['b2b',     score(/\b(agent|wholesaler|operator|tour|allotment|net rate|contract|dmc)\b/g) * 2],
    ['ota',     score(/\b(booking\.com|expedia|agoda|trip\.com|airbnb)\b/g) * 3],
    ['fit',     score(/\b(family|couple|honeymoon|us 2|just the two)\b/g)],
  ];
  tally.sort((a, b) => b[1] - a[1]);
  const top = tally[0];
  if (top[1] === 0) return { kind: 'fit', conf: 0.5 };
  const total = tally.reduce((s, [, n]) => s + n, 0);
  return { kind: top[0], conf: Number((Math.min(0.95, 0.55 + (top[1] / Math.max(1, total)) * 0.4)).toFixed(2)) };
}
function sourceFromMailbox(m: string): string {
  const t = m.toLowerCase();
  if (t.includes('book@')) return 'Direct email';
  if (t.includes('reservations@')) return 'Reservations';
  if (t.includes('wm@')) return 'Wholesale/B2B';
  return 'Direct email';
}

// ---- core ingest of one Gmail message ----

type IngestResult = { kind: 'inserted'|'duplicate'|'error'; error?: string };

async function ingestOne(msg: GmailMessageFull, fallbackMailbox: string): Promise<IngestResult> {
  const sb = getSupabaseAdmin();
  const headers = msg.payload?.headers ?? [];
  const messageIdHdr = getHeader(msg.payload, 'Message-ID') ?? `gmail:${msg.id}`;
  const fromHdr = getHeader(msg.payload, 'From');
  const toHdr = getHeader(msg.payload, 'To');
  const ccHdr = getHeader(msg.payload, 'Cc');
  const subject = getHeader(msg.payload, 'Subject') ?? '';
  const inReplyTo = getHeader(msg.payload, 'In-Reply-To');
  const dateHdr = getHeader(msg.payload, 'Date');
  const receivedAt = dateHdr ? new Date(dateHdr).toISOString() : (msg.internalDate ? new Date(parseInt(msg.internalDate, 10)).toISOString() : new Date().toISOString());

  // Dedupe
  const { data: existing } = await sb.schema('sales').from('email_messages')
    .select('id').eq('property_id', PROPERTY_ID).eq('message_id', messageIdHdr).maybeSingle();
  if (existing) return { kind: 'duplicate' };

  const { text, html } = extractBodies(msg.payload);
  const sender = parseFromHeader(fromHdr);
  const toList = parseAddressList(toHdr);
  const ccList = parseAddressList(ccHdr);
  const intendedMailbox = detectIntendedMailbox(toList, ccList, text, fallbackMailbox);
  const direction: 'inbound'|'outbound' = sender.email && NAMKHAN_DOMAIN_RE.test(sender.email) ? 'outbound' : 'inbound';

  // Match thread → existing inquiry
  let inquiryId: string | null = null;
  if (msg.threadId) {
    const { data: linked } = await sb.schema('sales').from('email_messages')
      .select('inquiry_id').eq('property_id', PROPERTY_ID).eq('thread_id', msg.threadId)
      .not('inquiry_id', 'is', null).limit(1).maybeSingle();
    if (linked?.inquiry_id) inquiryId = (linked as { inquiry_id: string }).inquiry_id;
  }

  // Inbound + no thread match → create inquiry
  if (direction === 'inbound' && !inquiryId) {
    const lang = detectLanguage(`${subject} ${text}`);
    const tri = triage(subject, text);
    const source = sourceFromMailbox(intendedMailbox);
    const { data: inq, error: e1 } = await sb.schema('sales').from('inquiries').insert({
      property_id: PROPERTY_ID,
      source,
      channel_ref: messageIdHdr,
      guest_name: sender.name,
      guest_email: sender.email,
      language: lang,
      status: 'new',
      raw_payload: { from: fromHdr, to: toList, subject, body: text.slice(0, 50000), received_at: receivedAt, message_id: messageIdHdr, thread_id: msg.threadId, ingest_source: 'gmail-poll' },
      triage_kind: tri.kind,
      triage_conf: tri.conf,
    }).select('id').single();
    if (e1) { console.error('[poll-gmail inquiry insert]', e1); return { kind: 'error', error: `inquiry: ${e1.message ?? JSON.stringify(e1)}` }; }
    inquiryId = (inq as { id: string }).id;
  }

  const { error: e2 } = await sb.schema('sales').from('email_messages').insert({
    property_id: PROPERTY_ID,
    message_id: messageIdHdr,
    thread_id: msg.threadId,
    in_reply_to: inReplyTo,
    direction,
    mailbox: fallbackMailbox.toLowerCase(),
    intended_mailbox: intendedMailbox,
    from_email: sender.email,
    from_name: sender.name,
    to_emails: toList,
    cc_emails: ccList,
    subject,
    body_text: text.slice(0, 200000),
    body_html: html.slice(0, 200000),
    received_at: receivedAt,
    gmail_msg_id: msg.id,
    inquiry_id: inquiryId,
    gmail_labels: msg.labelIds ?? [],   // capture SPAM / IMPORTANT / CATEGORY_* / etc.
    raw_payload: { headers: headers.slice(0, 30) },
    ingest_source: 'gmail-poll',
  });
  if (e2) { console.error('[poll-gmail msg insert]', e2); return { kind: 'error', error: `msg: ${e2.message ?? JSON.stringify(e2)}` }; }
  return { kind: 'inserted' };
}

// ---- main ----

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  if (key !== expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const forceEmail = url.searchParams.get('force_email');
  const sinceParam = url.searchParams.get('since');  // YYYY-MM-DD
  const limitPerInbox = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10), 2000);

  // Fetch connections — filter `paused` in JS (PostgREST .eq('paused', false) was returning 0 rows
  // even when the row exists with paused=false; bug captured 2026-05-05).
  let q = sb.schema('sales').from('gmail_connections').select('*');
  if (forceEmail) q = q.eq('email', forceEmail);
  const { data: rawConns, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const conns = (rawConns ?? []).filter((c: { paused: boolean | null }) => c.paused !== true);
  if (conns.length === 0) return NextResponse.json({ ok: true, message: 'no connections', total_rows: rawConns?.length ?? 0 });

  const results: Array<Record<string, unknown>> = [];

  for (const c of conns as Array<{ email: string; refresh_token: string; last_synced_at: string | null; total_synced: number }>) {
    const { data: run } = await sb.schema('sales').from('gmail_poll_runs').insert({
      email: c.email, status: 'running'
    }).select('id').single();
    const runId = (run as { id: number } | null)?.id;

    let access_token: string;
    try {
      ({ access_token } = await refreshAccessToken(c.refresh_token));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'token refresh failed';
      if (runId) await sb.schema('sales').from('gmail_poll_runs').update({ status: 'error', error_message: msg, finished_at: new Date().toISOString() }).eq('id', runId);
      results.push({ email: c.email, error: msg });
      continue;
    }

    // Build search query — first run defaults to 2026-01-01 backfill
    const since = sinceParam
      ? sinceParam.replace(/-/g, '/')
      : c.last_synced_at
        ? new Date(c.last_synced_at).toISOString().slice(0, 10).replace(/-/g, '/')
        : '2026/01/01';
    const query = `after:${since}`;

    let seen = 0, inserted = 0, skipped = 0, errored = 0;
    const errorSamples: string[] = [];
    let pageToken: string | undefined = undefined;
    let pages = 0;
    const MAX_PAGES = Math.ceil(limitPerInbox / 100);

    try {
      while (pages < MAX_PAGES && seen < limitPerInbox) {
        const list = await listGmailMessages(access_token, { q: query, pageToken, maxResults: 100 });
        const ids = list.messages ?? [];
        if (ids.length === 0) break;
        for (const m of ids) {
          if (seen >= limitPerInbox) break;
          seen++;
          try {
            const full = await getGmailMessage(access_token, m.id);
            const result = await ingestOne(full, c.email);
            if (result.kind === 'inserted') inserted++;
            else if (result.kind === 'duplicate') skipped++;
            else if (result.kind === 'error') {
              errored++;
              if (errorSamples.length < 3) errorSamples.push(`msg=${m.id} ${(result.error ?? 'unknown').slice(0, 220)}`);
            }
          } catch (e) {
            errored++;
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[poll-gmail message]', m.id, msg);
            if (errorSamples.length < 3) errorSamples.push(`msg=${m.id} ${msg.slice(0, 220)}`);
          }
        }
        if (!list.nextPageToken) break;
        pageToken = list.nextPageToken;
        pages++;
      }

      const nowIso = new Date().toISOString();
      await sb.schema('sales').from('gmail_connections').update({
        last_synced_at: nowIso,
        total_synced: c.total_synced + inserted,
        updated_at: nowIso,
      }).eq('email', c.email);

      const finalStatus = errored > 0 && inserted === 0 ? 'error' : 'success';
      const finalErrorMsg = errored > 0 ? `${errored} of ${seen} messages errored. samples: ${errorSamples.join(' | ')}` : null;

      if (runId) await sb.schema('sales').from('gmail_poll_runs').update({
        status: finalStatus,
        messages_seen: seen,
        messages_inserted: inserted,
        messages_skipped: skipped + errored, // surface errored as skipped+ until column added
        finished_at: nowIso,
        error_message: finalErrorMsg,
      }).eq('id', runId);

      results.push({ email: c.email, seen, inserted, skipped, errored, query, errorSamples });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'poll failed';
      if (runId) await sb.schema('sales').from('gmail_poll_runs').update({
        status: 'error',
        error_message: msg,
        messages_seen: seen,
        messages_inserted: inserted,
        finished_at: new Date().toISOString(),
      }).eq('id', runId);
      results.push({ email: c.email, error: msg, seen, inserted });
    }
  }

  return NextResponse.json({ ok: true, results });
}
