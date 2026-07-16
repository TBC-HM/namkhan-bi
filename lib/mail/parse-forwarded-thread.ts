// lib/mail/parse-forwarded-thread.ts
// Pure parser: splits a forwarded/quoted email body into its constituent
// message parts. Handles common patterns:
//   1. Gmail-style "---------- Forwarded message ----------" markers
//   2. Nested reply markers "On <date>, <name> wrote:"
//   3. "> "-prefixed line quotes (strip and treat as previous message)
//   4. Outlook forward header blocks ("From: ... Sent: ... To: ... Subject: ...")
//
// Return shape is graceful: if nothing parses, returns [{ body, depth: 0 }].
// Callers should render whatever they get and (if length === 1 AND
// `parseFallback` is true) show a subtle "could not parse chain" note.
//
// PBS 2026-07-15 — level up /mail forwarded expansion.

export interface ParsedMessage {
  from: string;
  date: string;
  subject: string;
  to: string;
  body: string;
  is_forward: boolean;
  depth: number;
}

export interface ParseResult {
  messages: ParsedMessage[];
  parseFallback: boolean; // true = original body only, no split occurred
}

// -------------------- helpers --------------------

const RE_GMAIL_FWD = /-{3,}\s*Forwarded message\s*-{3,}/gi;
const RE_ON_WROTE  = /^On\s+.{5,80}?\s+wrote:\s*$/gim;
// Outlook block: at least 3 of From/Sent/To/Subject in successive lines.
const RE_OUTLOOK_BLOCK = /(^From:\s*.+\n)(^Sent:\s*.+\n)(^To:\s*.+\n)(^Subject:\s*.+\n)/gim;

function stripQuoteMarks(s: string): string {
  return s.split('\n').map((l) => l.replace(/^>\s?/, '')).join('\n');
}

function parseHeaderBlock(block: string): Partial<ParsedMessage> {
  const out: Partial<ParsedMessage> = {};
  const lines = block.split(/\r?\n/);
  for (const l of lines) {
    const m = l.match(/^\s*(From|Sent|Date|To|Subject|Cc)\s*:\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'from') out.from = val;
    else if (key === 'sent' || key === 'date') out.date = val;
    else if (key === 'to') out.to = val;
    else if (key === 'subject') out.subject = val;
  }
  return out;
}

// Extract a rough "On <date>, <name> wrote:" as a header-ish record.
function parseOnWroteLine(line: string): Partial<ParsedMessage> {
  const m = line.match(/^On\s+(.+?),\s+(.+?)\s+wrote:\s*$/i);
  if (!m) return {};
  return { date: m[1].trim(), from: m[2].trim() };
}

// -------------------- main --------------------

export function parseForwardedThread(rawBody: string, topSubject: string): ParseResult {
  const body = (rawBody || '').trim();
  if (!body) {
    return { messages: [{ from: '', date: '', subject: topSubject, to: '', body: '', is_forward: false, depth: 0 }], parseFallback: true };
  }

  // Try Gmail-style forward marker first (most common).
  if (RE_GMAIL_FWD.test(body)) {
    RE_GMAIL_FWD.lastIndex = 0;
    return parseGmailForward(body, topSubject);
  }

  // Try Outlook forward header block.
  RE_OUTLOOK_BLOCK.lastIndex = 0;
  if (RE_OUTLOOK_BLOCK.test(body)) {
    RE_OUTLOOK_BLOCK.lastIndex = 0;
    return parseOutlookForward(body, topSubject);
  }

  // Try "On ... wrote:" nested replies.
  RE_ON_WROTE.lastIndex = 0;
  if (RE_ON_WROTE.test(body)) {
    RE_ON_WROTE.lastIndex = 0;
    return parseOnWroteChain(body, topSubject);
  }

  // Try line-quote (>) if body starts with any quoted lines.
  if (/^>/.test(body) || /\n>/.test(body)) {
    return parseQuoteChain(body, topSubject);
  }

  // Nothing matched — fallback.
  return {
    messages: [{ from: '', date: '', subject: topSubject, to: '', body, is_forward: false, depth: 0 }],
    parseFallback: true,
  };
}

// Gmail forward splitting.
function parseGmailForward(body: string, topSubject: string): ParseResult {
  const segments = body.split(RE_GMAIL_FWD);
  // segments[0] is the leading commentary (top author's note above the fwd),
  // segments[1..] are forwarded blocks.
  const messages: ParsedMessage[] = [];
  const lead = segments[0].trim();
  if (lead) {
    messages.push({ from: '', date: '', subject: topSubject, to: '', body: lead, is_forward: false, depth: 0 });
  }
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i].trim();
    // First 8 lines usually contain the header block.
    const headBlock = seg.split(/\r?\n/).slice(0, 8).join('\n');
    const rest = seg.split(/\r?\n/).slice(8).join('\n').trim();
    const hdr = parseHeaderBlock(headBlock);
    messages.push({
      from: hdr.from ?? '',
      date: hdr.date ?? '',
      subject: hdr.subject ?? topSubject,
      to: hdr.to ?? '',
      body: rest || seg,
      is_forward: true,
      depth: i,
    });
  }
  return { messages, parseFallback: false };
}

// Outlook-style: "From: ... Sent: ... To: ... Subject: ..." delimiters.
function parseOutlookForward(body: string, topSubject: string): ParseResult {
  const matches: Array<{ index: number; block: string }> = [];
  const re = new RegExp(RE_OUTLOOK_BLOCK.source, 'gim');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    matches.push({ index: m.index, block: m[0] });
  }
  if (matches.length === 0) {
    return { messages: [{ from: '', date: '', subject: topSubject, to: '', body, is_forward: false, depth: 0 }], parseFallback: true };
  }
  const messages: ParsedMessage[] = [];
  const lead = body.slice(0, matches[0].index).trim();
  if (lead) {
    messages.push({ from: '', date: '', subject: topSubject, to: '', body: lead, is_forward: false, depth: 0 });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].block.length;
    const end   = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const rest  = body.slice(start, end).trim();
    const hdr   = parseHeaderBlock(matches[i].block);
    messages.push({
      from: hdr.from ?? '',
      date: hdr.date ?? '',
      subject: hdr.subject ?? topSubject,
      to: hdr.to ?? '',
      body: rest,
      is_forward: true,
      depth: i + 1,
    });
  }
  return { messages, parseFallback: false };
}

// "On <date>, <name> wrote:" nested replies (each becomes a message).
function parseOnWroteChain(body: string, topSubject: string): ParseResult {
  const re = /^On\s+(.+?),\s+(.+?)\s+wrote:\s*$/gim;
  const matches: Array<{ index: number; line: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    matches.push({ index: m.index, line: m[0] });
  }
  if (matches.length === 0) {
    return { messages: [{ from: '', date: '', subject: topSubject, to: '', body, is_forward: false, depth: 0 }], parseFallback: true };
  }
  const messages: ParsedMessage[] = [];
  const lead = body.slice(0, matches[0].index).trim();
  if (lead) {
    messages.push({ from: '', date: '', subject: topSubject, to: '', body: lead, is_forward: false, depth: 0 });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].line.length;
    const end   = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const rest  = stripQuoteMarks(body.slice(start, end).trim());
    const meta  = parseOnWroteLine(matches[i].line);
    messages.push({
      from: meta.from ?? '',
      date: meta.date ?? '',
      subject: topSubject,
      to: '',
      body: rest,
      is_forward: true,
      depth: i + 1,
    });
  }
  return { messages, parseFallback: false };
}

// Body opens with `> ` quoted content — treat the quoted section as parent
// and any unquoted trailing lines as the current author's addition.
function parseQuoteChain(body: string, topSubject: string): ParseResult {
  const lines = body.split(/\r?\n/);
  const quoted: string[] = [];
  const unquoted: string[] = [];
  let inQuote = true;
  for (const l of lines) {
    if (/^>/.test(l)) {
      quoted.push(l.replace(/^>\s?/, ''));
    } else if (l.trim() === '') {
      (inQuote ? quoted : unquoted).push('');
    } else {
      inQuote = false;
      unquoted.push(l);
    }
  }
  const messages: ParsedMessage[] = [];
  const un = unquoted.join('\n').trim();
  if (un) messages.push({ from: '', date: '', subject: topSubject, to: '', body: un, is_forward: false, depth: 0 });
  const qu = quoted.join('\n').trim();
  if (qu) messages.push({ from: '', date: '', subject: topSubject, to: '', body: qu, is_forward: true, depth: 1 });
  if (messages.length <= 1) {
    return { messages: [{ from: '', date: '', subject: topSubject, to: '', body, is_forward: false, depth: 0 }], parseFallback: true };
  }
  return { messages, parseFallback: false };
}

// Helper: detect Fwd:/FW: subject prefix so caller can skip parsing when
// there's no obvious forward.
export function isForwardedSubject(subject: string): boolean {
  return /^\s*(fwd?|fw)\s*:/i.test(subject || '');
}
