// GET /api/cron/poll-gmail
// Vercel Cron entrypoint. For each row in marketing.user_gmail_connections (not paused):
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
  if (/\b(bonjour|merci|nous sommes|j'aimerais|éservation)\b/.test(t)) return 'FR';
  if (/\b(guten tag|wir sind|grüße|hallo|reservierung)\b/.test(t)) return 'DE';
  if (/\b(hola|nosotros|gracias|reserva|saludos)\b/.test(t)) return 'ES';
  if (/[一-鯿]/.test(t)) return 'ZH';
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
  const directio

