// lib/mail/anthropic.ts
// Shared Anthropic caller — no SDK dep, direct fetch to /v1/messages.
// PBS 2026-07-15 · powers /api/mail/ai/* routes.

export const VECTOR_SYSTEM = 'You are Vector, a warm-professional B2B hospitality voice for The Namkhan boutique retreat. Concise, no fluff, always end with a clear next step.';

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

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
