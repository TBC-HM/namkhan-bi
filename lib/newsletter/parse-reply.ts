// lib/newsletter/parse-reply.ts
// Brief newsletter-owner-test-feedback-writer-v1 (goal 27, ADR-203 writer half).
//
// Pure helpers for the owner-test feedback writer:
//   1. extractPlainTextFromGmailPayload — walk a Gmail `format=full` payload
//      and pull the best plaintext body (text/plain preferred, text/html
//      stripped as fallback). Gmail body data is base64url.
//   2. stripQuotedHistory — cut quoted reply chains ("On ... wrote:",
//      "> " quote lines, Gmail forward markers, Outlook header blocks).
//   3. stripSignature — cut RFC-3676 "-- " signature blocks + common
//      mobile sign-offs.
//   4. parseOwnerReply — the composition used by the scan route.
//
// No I/O, no supabase, no fetch — unit-testable in isolation.

export interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPayloadPart[];
}

/** base64url → utf-8 string (Node runtime). */
function b64urlDecode(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/** Very small HTML → text: drop tags, decode the handful of common entities. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function collectParts(part: GmailPayloadPart, out: GmailPayloadPart[]): void {
  out.push(part);
  for (const p of part.parts ?? []) collectParts(p, out);
}

/**
 * Pull the best-effort plaintext body from a Gmail `format=full` payload.
 * Preference order: first text/plain part with data → first text/html part
 * (tag-stripped) → empty string.
 */
export function extractPlainTextFromGmailPayload(payload: GmailPayloadPart | undefined | null): string {
  if (!payload) return '';
  const flat: GmailPayloadPart[] = [];
  collectParts(payload, flat);
  const plain = flat.find((p) => (p.mimeType ?? '').toLowerCase().startsWith('text/plain') && p.body?.data);
  if (plain?.body?.data) return b64urlDecode(plain.body.data).trim();
  const html = flat.find((p) => (p.mimeType ?? '').toLowerCase().startsWith('text/html') && p.body?.data);
  if (html?.body?.data) return htmlToText(b64urlDecode(html.body.data));
  return '';
}

// Quoted-history markers, checked line by line. First hit truncates the body.
const RE_ON_WROTE = /^On\s+.{5,120}?\s+wrote:\s*$/i;                 // Gmail/Apple reply header
const RE_ON_WROTE_INLINE = /^On\s+.{5,120}?\s+wrote:/i;               // same, body follows on the line
const RE_GMAIL_FWD = /^-{3,}\s*Forwarded message\s*-{3,}/i;           // Gmail forward marker
const RE_OUTLOOK_FROM = /^From:\s*.+$/i;                              // Outlook header block start
const RE_ORIGINAL_MSG = /^-{2,}\s*Original Message\s*-{2,}/i;

/**
 * Cut everything from the first quoted-history marker down, and drop any
 * remaining "> "-prefixed quote lines.
 */
export function stripQuotedHistory(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      RE_ON_WROTE.test(line.trim()) ||
      RE_ON_WROTE_INLINE.test(line.trim()) ||
      RE_GMAIL_FWD.test(line.trim()) ||
      RE_ORIGINAL_MSG.test(line.trim())
    ) break;
    // Outlook block: From: line immediately followed (within 3 lines) by Sent:/Date: + To:
    if (RE_OUTLOOK_FROM.test(line.trim())) {
      const next3 = lines.slice(i + 1, i + 4).join('\n');
      if (/^(Sent|Date):/im.test(next3) && /^To:/im.test(next3)) break;
    }
    if (/^>\s?/.test(line)) continue; // stray quote line
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const SIGNOFF_LINES = [
  /^--\s*$/,                       // RFC 3676 signature delimiter
  /^Sent from my (iPhone|iPad|Samsung|Android)/i,
  /^Get Outlook for (iOS|Android)/i,
];

/** Cut a trailing signature block if a known delimiter line is found. */
export function stripSignature(text: string): string {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (SIGNOFF_LINES.some((re) => re.test(lines[i].trim()))) {
      return lines.slice(0, i).join('\n').trim();
    }
  }
  return text.trim();
}

/**
 * Full owner-reply cleanup: Gmail payload → plaintext → quoted history
 * stripped → signature stripped. Returns '' when nothing substantive remains.
 */
export function parseOwnerReply(payload: GmailPayloadPart | undefined | null): string {
  const raw = extractPlainTextFromGmailPayload(payload);
  if (!raw) return '';
  return stripSignature(stripQuotedHistory(raw));
}

/**
 * Split an RFC Message-Id token into match candidates for the dual matcher
 * (A2 / R1): the full token AND its local part. Stored send-side ids are
 * Resend API UUIDs, so `<uuid@domain>` replies can still match on the local
 * part; full-token match covers the case where the RFC id was stored whole.
 */
export function messageIdCandidates(refIds: string[]): string[] {
  const out = new Set<string>();
  for (const id of refIds) {
    const t = id.trim();
    if (!t) continue;
    out.add(t);
    const at = t.indexOf('@');
    if (at > 0) out.add(t.slice(0, at));
  }
  return Array.from(out);
}
