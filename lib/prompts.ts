// lib/prompts.ts
// Prompt loader with DB-override + filesystem fallback + 60s TTL cache.
// Edit prompts in 2 places:
//   1. prompts/*.md files (versioned in git, requires deploy)
//   2. /settings/agents UI → docs.agent_prompt_overrides table (hot-reload, 60s TTL)
//
// DB takes precedence over filesystem. If both missing, returns ''.

import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from './supabaseAdmin';

const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

/** key = relative path under prompts/, e.g. '_shared/output-style.md' */
type PromptKey = string;

const CACHE: Map<PromptKey, { value: string; loadedAt: number }> = new Map();
const TTL_MS = 60_000;

function readFs(key: PromptKey): string {
  try { return fs.readFileSync(path.join(PROMPTS_DIR, key), 'utf-8').trim(); }
  catch { return ''; }
}

async function readDb(key: PromptKey): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .schema('docs')
      .from('agent_prompt_overrides')
      .select('content')
      .eq('prompt_key', key)
      .eq('is_active', true)
      .maybeSingle();
    return data?.content ?? null;
  } catch { return null; }
}

/** Load a prompt by key. Async — uses DB override if present. */
export async function loadPrompt(key: PromptKey): Promise<string> {
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.value;

  const db = await readDb(key);
  const value = db !== null ? db : readFs(key);
  CACHE.set(key, { value, loadedAt: Date.now() });
  return value;
}

/** Sync version — fs only, no DB. Use when async isn't possible (module init). */
export function loadPromptSync(key: PromptKey): string {
  return readFs(key);
}

/** Bust the cache for a single key (called when /settings/agents saves). */
export function invalidatePrompt(key: PromptKey) {
  CACHE.delete(key);
}

/** Bust everything (e.g. after bulk import). */
export function invalidateAllPrompts() {
  CACHE.clear();
}

/** List of canonical prompt keys + their default category for UI grouping. */
export const PROMPT_REGISTRY = [
  { key: '_shared/output-style.md',           category: 'shared',         label: 'Output style (typography, structure)' },
  { key: '_shared/version-policy.md',         category: 'shared',         label: 'Version policy (current vs old)' },
  { key: '_shared/access-policy.md',          category: 'shared',         label: 'Access policy (role × sensitivity)' },
  { key: 'data-agent/sql-generation.md',      category: 'data-agent',     label: 'Data agent — SQL generation rules' },
  { key: 'data-agent/answer-formatting.md',   category: 'data-agent',     label: 'Data agent — answer formatting' },
  { key: 'data-agent/cross-schema-search.md', category: 'data-agent',     label: 'Data agent — cross-schema JOIN guide' },
  { key: 'doc-classifier/classification.md',  category: 'doc-classifier', label: 'Doc classifier (text)' },
  { key: 'doc-classifier/vision-ocr.md',      category: 'doc-classifier', label: 'Doc classifier (Vision OCR)' },
  { key: 'doc-qa/synthesis.md',               category: 'doc-qa',         label: 'Doc Q/A synthesis' },
] as const;

/* ----- Convenience exports for routes that load at module init ----- */
// These use sync fs read (no DB) — guaranteed to be available before any request.
// For DB-overridable behavior, switch the call site to `await loadPrompt(...)`.

export const OUTPUT_STYLE   = readFs('_shared/output-style.md');
export const VERSION_POLICY = readFs('_shared/version-policy.md');
export const ACCESS_POLICY  = readFs('_shared/access-policy.md');

/** Helper for callers that want DB-aware loading at request time. */
export async function loadShared() {
  const [output_style, version_policy, access_policy] = await Promise.all([
    loadPrompt('_shared/output-style.md'),
    loadPrompt('_shared/version-policy.md'),
    loadPrompt('_shared/access-policy.md'),
  ]);
  return { output_style, version_policy, access_policy };
}
