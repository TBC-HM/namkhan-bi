// lib/mail/anthropic.ts
// Shared Anthropic caller — no SDK dep, direct fetch to /v1/messages.
// PBS 2026-07-15 · powers /api/mail/ai/* routes.
// PBS 2026-07-17 · polish `mode` param (5 tones) + translate helper.

export const VECTOR_SYSTEM = 'You are Vector, a warm-professional B2B hospitality voice for The Namkhan boutique retreat. Concise, no fluff, always end with a clear next step.';

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// PBS 2026-07-17 · 5 polish modes. Each shapes the system prompt so the same
// draft gets a materially different rewrite.
export type PolishMode = 'polish' | 'shorten' | 'lengthen' | 'warm' | 'formalize';

export const POLISH_MODES: PolishMode[] = ['polish', 'shorten', 'lengthen', 'warm', 'formalize'];

export const POLISH_MODE_LABEL: Record<PolishMode, string> = {
  polish:    'Polish',
  shorten:   'Shorten',
  lengthen:  'Expand',
  warm:      'Warmer',
  formalize: 'Formal',
};

export function polishSystemFor(mode: PolishMode): string {
  const base = VECTOR_SYSTEM;
  switch (mode) {
    case 'shorten':
      return base + ' Cut the draft by at least 30%. Keep every fact and every ask. Remove hedges, adverbs, throat-clearing.';
    case 'lengthen':
      return base + ' Expand the draft with 1-2 short paragraphs of useful context (never filler). Add specifics that help the reader act.';
    case 'warm':
      return base + ' Rewrite with more warmth — acknowledge the reader, use their name if in the thread, soften opens/closes. Never sacrifice clarity.';
    case 'formalize':
      return base + ' Rewrite in a formal register suitable for a first exchange with a corporate client or embassy. Full sentences, no contractions, no exclamation marks.';
    case 'polish':
    default:
      return base + ' Tighten sentences, fix grammar, remove filler, keep the voice.';
  }
}

export interface CallOpts {
  system: string;
  prompt: string;
  maxTokens?: number;
}

interface AnthropicResp {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string; type?: string };
}

export async function callAnthropic({ system, prompt, maxTokens = 800 }: CallOpts): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const r = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const j = (await r.json().catch(() => ({}))) as AnthropicResp;
  if (!r.ok) {
    throw new Error(j.error?.message || ('anthropic_' + r.status));
  }
  const text = (j.content || []).map((b) => b.text || '').join('').trim();
  if (!text) throw new Error('anthropic_empty_response');
  return text;
}

// PBS 2026-07-15 · Convert-to-Lead + Create-Proposal from mail thread.
// Extract structured lead info from a raw inbound email body — used by
// /api/mail/convert-to-lead and /api/mail/create-proposal-from-mail routes.
export interface ExtractedLeadInfo {
  company_name: string | null;
  decision_maker_name: string | null;
  decision_maker_role: string | null;
  email: string | null;
  phone_whatsapp: string | null;
  website: string | null;
  instagram_url: string | null;
  country: string | null;
  city: string | null;
  language: string | null;
  deal_type: 'fit' | 'group' | 'wedding' | 'retreat' | 'package' | 'b2b' | null;
  notes: string | null;
  retreat_history: boolean | null;
  audience_size_proxy: number | null;
}

const LEAD_EXTRACT_SYSTEM = [
  'You are a structured-extraction agent for The Namkhan boutique retreat sales pipeline.',
  'Read an inbound email and return ONLY a JSON object matching the given schema.',
  'Missing fields = null. Never invent data. Read the email body, signature block, subject line.',
  'deal_type must be one of: fit | group | wedding | retreat | package | b2b — pick the best fit; null if unclear.',
  'country and city refer to where the SENDER is based (not travel destination).',
  'notes = one or two short sentences summarising what the sender wants.',
  'Respond with a single JSON object, no prose, no code fence.',
].join(' ');

function safeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') { const s = v.trim(); return s ? s : null; }
  return null;
}

function safeBool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  return null;
}

function safeInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string' && v.trim()) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
  return null;
}

const DEAL_TYPES = ['fit','group','wedding','retreat','package','b2b'] as const;
type DealType = typeof DEAL_TYPES[number];

function safeDealType(v: unknown): DealType | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return (DEAL_TYPES as readonly string[]).includes(s) ? (s as DealType) : null;
}

export async function extractLeadInfo(
  body: string,
  from_name: string,
  from_email: string,
  subject: string,
): Promise<ExtractedLeadInfo> {
  const prompt = [
    'FROM_NAME: ' + (from_name || '(unknown)'),
    'FROM_EMAIL: ' + (from_email || '(unknown)'),
    'SUBJECT: ' + (subject || '(no subject)'),
    '',
    'EMAIL BODY (may include signature block):',
    '"""',
    (body || '').slice(0, 8000),
    '"""',
    '',
    'Return this JSON schema exactly (nulls allowed):',
    '{',
    '  "company_name": string|null,',
    '  "decision_maker_name": string|null,',
    '  "decision_maker_role": string|null,',
    '  "email": string|null,',
    '  "phone_whatsapp": string|null,',
    '  "website": string|null,',
    '  "instagram_url": string|null,',
    '  "country": string|null,',
    '  "city": string|null,',
    '  "language": string|null,',
    '  "deal_type": "fit"|"group"|"wedding"|"retreat"|"package"|"b2b"|null,',
    '  "notes": string|null,',
    '  "retreat_history": boolean|null,',
    '  "audience_size_proxy": number|null',
    '}',
  ].join('\n');

  const raw = await callAnthropic({ system: LEAD_EXTRACT_SYSTEM, prompt, maxTokens: 900 });
  // Strip any accidental code fence.
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean) as Record<string, unknown>;
  } catch {
    // Salvage: find the first {...} block in the response.
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('lead_extract_bad_json');
    parsed = JSON.parse(m[0]) as Record<string, unknown>;
  }

  return {
    company_name:         safeString(parsed.company_name),
    decision_maker_name:  safeString(parsed.decision_maker_name) ?? safeString(from_name),
    decision_maker_role:  safeString(parsed.decision_maker_role),
    email:                safeString(parsed.email) ?? safeString(from_email),
    phone_whatsapp:       safeString(parsed.phone_whatsapp),
    website:              safeString(parsed.website),
    instagram_url:        safeString(parsed.instagram_url),
    country:              safeString(parsed.country),
    city:                 safeString(parsed.city),
    language:             safeString(parsed.language),
    deal_type:            safeDealType(parsed.deal_type),
    notes:                safeString(parsed.notes),
    retreat_history:      safeBool(parsed.retreat_history),
    audience_size_proxy:  safeInt(parsed.audience_size_proxy),
  };
}
