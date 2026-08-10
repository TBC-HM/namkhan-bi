// Constitution auto-injection (brief agent-prompt-conformance-v1, ADR-279).
//
// The v6 verification found the fleet toolless (empty skill registry), so
// agents commanded by their preamble to "call public.fn_claude_digest()"
// had no tool with which to call it. Fix: the runtime fetches the
// constitution server-side at prompt-load time and appends it to the
// system prompt. No skill-catalog dependency, no scope change.
//
// Module-level cache, TTL 10 min. Fails open: if the RPC errors, the
// prompt is returned un-amended (agents still carry their own doctrine).

import type { SupabaseClient } from "@supabase/supabase-js";

type DigestRow = { version: number; updated_at: string; constitution: string };

let cache: { version: number; text: string; fetchedAt: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

async function refresh(sb: SupabaseClient): Promise<void> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) return;
  try {
    const { data, error } = await sb.rpc("fn_claude_digest");
    if (error) return; // fail open, keep stale cache if any
    const row: DigestRow | undefined = Array.isArray(data) ? data[0] : data;
    if (row?.constitution) {
      cache = { version: row.version, text: row.constitution, fetchedAt: now };
    }
  } catch {
    // fail open
  }
}

/** Append the v5 constitution to a system prompt. Returns the prompt
 *  unchanged when the digest is unavailable. */
export async function withConstitution(
  sb: SupabaseClient,
  prompt: string,
): Promise<string> {
  await refresh(sb);
  if (!cache?.text) return prompt;
  return `${prompt}\n\n=== CONSTITUTION v5 (auto-injected, version ${cache.version}) ===\n${cache.text}`;
}

/** Version of the currently cached constitution, or null if none was
 *  ever fetched. Used for the constitution_injected audit metadata. */
export function constitutionVersion(): number | null {
  return cache?.version ?? null;
}
