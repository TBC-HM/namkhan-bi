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
