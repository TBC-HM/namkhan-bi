// lib/youtube/skills-common.ts
// PBS 2026-07-11 · shared helpers for the 8 YouTube skill routes under
// app/api/cockpit/skills/youtube_*.
//
// Responsibilities:
//   • callAnthropic()      — thin wrapper on api.anthropic.com/v1/messages, tries
//                             process.env.ANTHROPIC_API_KEY first, falls back to
//                             SECURITY DEFINER RPC public.fn_get_secret('ANTHROPIC_API_KEY').
//   • getVaultSecret()     — pulls any named secret via fn_get_secret; returns null on miss.
//   • loadVocabRules()     — reads marketing.yt_vocabulary_matrix through the public bridge.
//   • buildVocabRegex()    — compiles the matrix rows into a single scanner. Never throws
//                             on a malformed regex — it just drops that row.
//   • scanTextForViolations() — runs the scanner against arbitrary text and returns
//                                a violation list.
//   • extractTextFromEdl() — pulls every voiceover / caption / title-card string out of
//                             a Shotstack-shaped EDL for guardrail scanning.
//   • ok() / err()         — tiny NextResponse.json shortcuts so every route ends
//                             in the same shape.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

// ---- generic response shortcuts -------------------------------------------

export function ok<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json({ ok: true, ...payload }, { status });
}
export function err(error: string, status = 500, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

// ---- vault -----------------------------------------------------------------

export async function getVaultSecret(name: string): Promise<string | null> {
  // 1) prefer env var (fast path — set locally / in Vercel for dev routes)
  const fromEnv = (process.env as Record<string, string | undefined>)[name];
  if (fromEnv && fromEnv.trim().length > 20) return fromEnv.trim();

  // 2) fall back to SECURITY DEFINER RPC (canonical vault fetch per claude_md v3.21 §0.53)
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_get_secret', { p_name: name });
    if (error) return null;
    const s = (data as string | null) ?? null;
    return s && s.trim().length > 0 ? s.trim() : null;
  } catch {
    return null;
  }
}

// ---- Anthropic -------------------------------------------------------------

export type LlmOk  = { ok: true;  text: string; usage: { in: number; out: number } };
export type LlmErr = { ok: false; error: string; detail?: string };
export type LlmResult = LlmOk | LlmErr;

export function isLlmOk(r: LlmResult): r is LlmOk { return r.ok === true; }

interface AnthropicResp {
  content?: Array<{ type: string; text?: string }>;
  usage?:   { input_tokens?: number; output_tokens?: number };
  error?:   { type?: string; message?: string };
}

export async function callAnthropic(args: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<LlmResult> {
  const apiKey = await getVaultSecret('ANTHROPIC_API_KEY');
  if (!apiKey) return { ok: false, error: 'vault_key_missing_ANTHROPIC_API_KEY' };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':          apiKey,
      'anthropic-version':  '2023-06-01',
      'content-type':       'application/json',
    },
    body: JSON.stringify({
      model:      args.model ?? ANTHROPIC_MODEL,
      max_tokens: args.maxTokens ?? 4096,
      system:     args.systemPrompt,
      messages:   [{ role: 'user', content: args.userPrompt }],
    }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 240);
    return { ok: false, error: `anthropic_${res.status}`, detail };
  }
  const j = (await res.json().catch(() => null)) as AnthropicResp | null;
  if (!j || !j.content) return { ok: false, error: 'anthropic_bad_json' };
  const text = (j.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n')
    .trim();
  if (!text) return { ok: false, error: 'anthropic_empty' };
  return {
    ok:    true,
    text,
    usage: {
      in:  j.usage?.input_tokens  ?? 0,
      out: j.usage?.output_tokens ?? 0,
    },
  };
}

// Robust JSON block extractor — Anthropic sometimes wraps JSON in ```json fences.
export function extractJsonBlock<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // second try — find first { ... last }
    const s = candidate.indexOf('{');
    const e = candidate.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try { return JSON.parse(candidate.slice(s, e + 1)) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

// ---- vocab scanner ---------------------------------------------------------

export interface VocabRule {
  banned_term_lower:    string;
  banned_pattern_regex: string | null;
  luxury_alternative:   string;
  severity:             string;  // 'block' | 'require_approval' | 'warn'
  rationale:            string | null;
}

export interface VocabViolation {
  term:         string;
  severity:     string;
  replacement:  string;
  location:     string;  // free-text — where in the input it matched
  snippet:      string;  // context, ~80 chars
}

export async function loadVocabRules(): Promise<VocabRule[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_yt_vocabulary_matrix')
    .select('banned_term_lower,banned_pattern_regex,luxury_alternative,severity,rationale');
  if (error || !data) return [];
  return data as VocabRule[];
}

interface CompiledRule { re: RegExp; rule: VocabRule }

export function buildVocabRegex(rules: VocabRule[]): CompiledRule[] {
  const out: CompiledRule[] = [];
  for (const rule of rules) {
    // Prefer explicit regex if present, else word-boundary the literal term.
    const source = rule.banned_pattern_regex && rule.banned_pattern_regex.trim().length > 0
      ? rule.banned_pattern_regex.trim()
      : `\\b${rule.banned_term_lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
    try {
      out.push({ re: new RegExp(source, 'gi'), rule });
    } catch {
      // malformed regex row — skip silently
    }
  }
  return out;
}

export function scanTextForViolations(
  text: string,
  compiled: CompiledRule[],
  locationLabel = 'text',
): VocabViolation[] {
  const violations: VocabViolation[] = [];
  if (!text) return violations;
  for (const c of compiled) {
    c.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = c.re.exec(text)) !== null) {
      const start = Math.max(0, m.index - 30);
      const end   = Math.min(text.length, m.index + m[0].length + 30);
      violations.push({
        term:        m[0],
        severity:    c.rule.severity,
        replacement: c.rule.luxury_alternative,
        location:    locationLabel,
        snippet:     text.slice(start, end).replace(/\s+/g, ' ').trim(),
      });
      if (m.index === c.re.lastIndex) c.re.lastIndex++;   // guard zero-width
    }
  }
  return violations;
}

// ---- EDL text extractor ----------------------------------------------------

// Walk the EDL JSON pulling every string field that looks like human-visible text.
// We're deliberately conservative — better to over-scan than to under-scan.
export function extractTextFromEdl(edl: unknown): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];

  const walk = (node: unknown, path: string) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      // heuristic — skip URL / hex / short IDs
      if (node.length >= 4 && !/^https?:\/\//i.test(node) && !/^#?[0-9a-fA-F]{3,8}$/.test(node)) {
        out.push({ label: path, text: node });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`));
      return;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      // Only follow keys likely to hold display text — keeps scan tight.
      for (const [k, v] of Object.entries(obj)) {
        const lowerKey = k.toLowerCase();
        if (['src','url','id','type','fit','effect','transition','filter','color','position'].includes(lowerKey)) continue;
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };

  try { walk(edl, ''); } catch { /* isolate malformed EDL */ }
  return out;
}

// ---- misc ------------------------------------------------------------------

export function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

export function nGrams(s: string, n = 3): Set<string> {
  const clean = s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  const g = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) g.add(words.slice(i, i + n).join(' '));
  return g;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
