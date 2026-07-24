// lib/brain/llm.ts
// BRAIN v1 · model callers. Anthropic (classification + ask) with vault
// fallback for the key (mirrors lib/mail/anthropic.ts), and OpenAI embeddings
// via the vault OPENAI_IMAGE_KEY (verified 2026-07-24 to work against
// /v1/embeddings — general-scope key despite the name). NEW file.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
export const BRAIN_MODEL = 'claude-sonnet-4-6';

let __anthropicKey: string | null = null;
export async function getAnthropicKey(): Promise<string> {
  if (__anthropicKey) return __anthropicKey;
  let key = process.env.ANTHROPIC_API_KEY || '';
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc('fn_get_secret', { p_name: 'ANTHROPIC_API_KEY' });
    if (!error && typeof data === 'string' && data.length > 20) key = data;
  } catch { /* env fallback */ }
  if (!key) throw new Error('ANTHROPIC_API_KEY missing in vault + env');
  __anthropicKey = key;
  return key;
}

let __openaiKey: string | null = null;
export async function getOpenAIKey(): Promise<string | null> {
  if (__openaiKey) return __openaiKey;
  let key = process.env.OPENAI_API_KEY || '';
  if (!key) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.rpc('fn_get_secret', { p_name: 'OPENAI_IMAGE_KEY' });
      if (!error && typeof data === 'string' && data.length > 20) key = data;
    } catch { /* none */ }
  }
  __openaiKey = key || null;
  return __openaiKey;
}

export async function callClaude(opts: {
  system: string; user: string; maxTokens?: number; temperature?: number;
}): Promise<string> {
  const key = await getAnthropicKey();
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: BRAIN_MODEL,
      max_tokens: opts.maxTokens ?? 1200,
      temperature: opts.temperature ?? 0,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`anthropic_${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json() as { content?: Array<{ type: string; text?: string }> };
  return (j.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('\n').trim();
}

/** Strip markdown fences and parse a strict-JSON model reply. */
export function parseModelJson<T>(raw: string): T | null {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(t.slice(start, end + 1)) as T; } catch { return null; }
}

/** Batch-embed texts with text-embedding-3-small (1536 dims). Returns null if no key. */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  const key = await getOpenAIKey();
  if (!key) return null;
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts.map(t => t.slice(0, 8000)) }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`openai_embeddings_${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json() as { data?: Array<{ index: number; embedding: number[] }> };
  const rows = (j.data ?? []).sort((a, b) => a.index - b.index).map(d => d.embedding);
  return rows.length === texts.length ? rows : null;
}
