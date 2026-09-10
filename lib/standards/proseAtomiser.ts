// lib/standards/proseAtomiser.ts
//
// Atomises a chunk of PROSE from an external hotel standard (GSTC, ASEAN Green
// Hotel, Travelife, ...) into individual normative requirements — one per
// hotel obligation, in the source's own words where possible. The SLH
// inspection is a numbered questionnaire and parses deterministically
// (slhParser.ts); these four other sources are prose, so an AI atomiser is
// the only practical way to pull requirements out of them.
//
// Never throws: this runs across ~350 chunks in a batch, and one bad model
// reply (rate limit, credit exhaustion, a non-JSON ramble) must not fail the
// whole run. Follows the same never-throw contract as
// lib/docs/classifier.ts's classifyWithFallback, and reuses its vault-first
// key resolution (getAnthropicKey) rather than re-implementing it.

import { getAnthropicKey } from '@/lib/docs/classifier';

export interface ProseRequirement {
  text: string;
  section: string | null;
  dept_hint: string | null;
  category: string | null;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const MAX_REQUIREMENTS_PER_CHUNK = 40;
const MAX_TEXT_CHARS = 600;

const PROMPT_INSTRUCTIONS = `You are extracting normative requirements from a hotel industry standard.
Extract ONLY normative requirements — things the hotel MUST do — one requirement per entry, in the
source's own words where possible. Do not summarise, do not invent, do not include informational or
background text that imposes no obligation.

Respond ONLY with valid JSON matching this shape — no commentary, no markdown fences:
{"requirements":[{"text":"...","section":"..."|null,"dept_hint":"..."|null,"category":"..."|null}]}`;

function buildPrompt(opts: { text: string; heading: string | null; authority: string }): string {
  return (
    `${PROMPT_INSTRUCTIONS}\n\n` +
    `AUTHORITY: ${opts.authority}\n` +
    `HEADING: ${opts.heading ?? '(none)'}\n` +
    `--- SOURCE TEXT ---\n${opts.text}`
  );
}

/** Parses a model reply into requirements. Never throws — unparseable or malformed
 *  input yields an empty array rather than propagating a JSON.parse exception. */
export function parseAtomiserReply(raw: string): ProseRequirement[] {
  if (!raw) return [];

  // Strip ```json fences the model adds despite instructions (same pattern as classifier.ts).
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  const list = (parsed as { requirements?: unknown[] } | null)?.requirements;
  if (!Array.isArray(list)) return [];

  const out: ProseRequirement[] = [];
  for (const entry of list) {
    const e = entry as Record<string, unknown>;
    const text = typeof e?.text === 'string' ? e.text.trim() : '';
    if (!text) continue; // drop entries with no text instead of emitting empty requirements

    out.push({
      text: text.slice(0, MAX_TEXT_CHARS),
      section: typeof e.section === 'string' && e.section.trim() ? e.section.trim() : null,
      dept_hint: typeof e.dept_hint === 'string' && e.dept_hint.trim() ? e.dept_hint.trim() : null,
      category: typeof e.category === 'string' && e.category.trim() ? e.category.trim() : null,
    });

    if (out.length >= MAX_REQUIREMENTS_PER_CHUNK) break; // cap runaway output
  }
  return out;
}

/** Default model call: posts to Anthropic using the same vault-first key resolution
 *  as lib/docs/classifier.ts, and meters via fn_meter_ai_call. Metering is best-effort
 *  — a metering failure must never fail atomisation itself. */
async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = await getAnthropicKey();

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${err}`);
  }

  const data = await resp.json() as {
    content: { type: string; text: string }[];
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
  };
  const raw = data.content.find(c => c.type === 'text')?.text ?? '';

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    await getSupabaseAdmin().rpc('fn_meter_ai_call', {
      p_property_id: null,
      p_agent_handle: 'standards_atomiser',
      p_model: MODEL,
      p_tokens_in: data.usage?.input_tokens ?? 0,
      p_tokens_cached: data.usage?.cache_read_input_tokens ?? 0,
      p_tokens_out: data.usage?.output_tokens ?? 0,
      p_source: 'standards-prose-atomiser',
      p_run_ref: `atomiser:${Date.now()}`,
    });
  } catch {
    // Metering must never break atomisation.
  }

  return raw;
}

/** Atomises one chunk of prose into requirements. Never throws — on any model
 *  failure it returns degraded:true with an empty requirements array, because a
 *  single bad chunk must not fail a 350-chunk run. */
export async function atomiseChunk(opts: {
  text: string;
  heading: string | null;
  authority: string;
  /** Test seam — takes the full prompt and returns the raw model reply. Defaults to a real Anthropic call. */
  _call?: (prompt: string) => Promise<string>;
}): Promise<{ requirements: ProseRequirement[]; degraded: boolean; error: string | null }> {
  const call = opts._call ?? callAnthropic;
  try {
    const raw = await call(buildPrompt(opts));
    const requirements = parseAtomiserReply(raw).map(r => ({
      ...r,
      // Fall back to the chunk heading when the model omits a section.
      section: r.section ?? opts.heading ?? null,
    }));
    return { requirements, degraded: false, error: null };
  } catch (e: any) {
    const error = e?.message ?? 'atomiser_failed';
    console.error('[standards/atomiser] degraded:', opts.authority, opts.heading, error);
    return { requirements: [], degraded: true, error };
  }
}
