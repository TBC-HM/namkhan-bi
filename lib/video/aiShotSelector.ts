// lib/video/aiShotSelector.ts
// PBS 2026-07-13 · Video AI Studio v1 — AI-driven shot selection.
// Uses Anthropic to parse the prompt into scene keywords, then queries
// media.media_assets via v_marketing_media_page bridge, ranks and orders.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret } from '@/lib/youtube/skills-common';
import type { MediaShot } from './shotstackBuilder';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export interface ShotSelectorInput {
  targetLength: number;   // sec
  style: 'cinematic'|'snappy'|'editorial'|'casual';
  guardrails?: string[];
  avgShotDurationSec?: number;
  areasIncluded?: string[]; // ['Rooms','F&B',…] filter
  propertyId?: number;
  includeVideoAssets?: boolean;
}

export interface ShotSelectorOutput {
  shots: (MediaShot & { asset_id: string; reason?: string; area?: string | null; tier?: string | null; })[];
  script: string;
  thumbnailAssetId: string | null;
  scenes: string[];
  keywords: string[];
}

interface CandidateRow {
  asset_id: string; public_url: string | null; mime_type: string | null;
  primary_tier: string | null; property_area: string | null;
  original_filename: string | null;
  quality_index: number | string | null; marketing_score: number | string | null;
  visual_description: string | null; brand_room_type_scope: string | null;
  created_at: string | null;
  duration_sec: number | null;
  asset_type: string | null;
}

async function askAnthropic(system: string, user: string, maxTokens = 800): Promise<string | null> {
  const key = await getVaultSecret('ANTHROPIC_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null) as any;
    const text = j?.content?.[0]?.text ?? null;
    return typeof text === 'string' ? text : null;
  } catch { return null; }
}

function tryParseJson<T=any>(s: string | null): T | null {
  if (!s) return null;
  const trimmed = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(trimmed) as T; } catch { return null; }
}

function scoreCandidate(row: CandidateRow, keywords: string[], scenes: string[]): number {
  const q = Number(row.quality_index ?? 0);
  const m = Number(row.marketing_score ?? 0);
  const desc = (row.visual_description ?? '').toLowerCase();
  const area = (row.property_area ?? '').toLowerCase();
  const scope = (row.brand_room_type_scope ?? '').toLowerCase();
  const filename = (row.original_filename ?? '').toLowerCase();
  const hay = [desc, area, scope, filename].join(' ');
  let match = 0;
  for (const k of keywords) if (k && hay.includes(k.toLowerCase())) match += 2;
  for (const s of scenes)   if (s && hay.includes(s.toLowerCase())) match += 1;

  // Recency bump (cheap): parse year from created_at.
  let recency = 0;
  try {
    const y = row.created_at ? new Date(row.created_at).getFullYear() : 0;
    if (y >= 2025) recency = 3;
    else if (y >= 2024) recency = 1.5;
  } catch { /* noop */ }

  // quality_index in 0-100 range on new rows, 0.0 on legacy → treat as neutral.
  const qNorm = q > 1 ? q / 10 : 0;    // 0-10 scale
  return match * 4 + qNorm + (m > 0 ? 3 : 0) + recency;
}

export async function selectShots(prompt: string, opts: ShotSelectorInput): Promise<ShotSelectorOutput> {
  const sb = getSupabaseAdmin();

  // 1) Parse prompt → scenes + keywords.
  const parseSys = 'You are a video producer. Extract a JSON plan from a hospitality video prompt. Return ONLY JSON with keys: scenes (array of 6-10 short scene descriptors, each 2-4 words), keywords (array of 8-14 single words for asset matching), mood, brand_terms (array of proper nouns).';
  const parsed = tryParseJson<{ scenes: string[]; keywords: string[]; mood?: string; brand_terms?: string[] }>(
    await askAnthropic(parseSys, prompt, 500),
  ) ?? {
    // Fallback: crude split
    scenes: prompt.split(/[,.;]/).map(s => s.trim()).filter(Boolean).slice(0, 8),
    keywords: prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 12),
  };

  // 2) Query candidate pool (quality relaxed if too narrow).
  const targetShotCount = Math.max(4, Math.ceil((opts.targetLength) / Math.max(2, opts.avgShotDurationSec ?? 4)));
  const q = sb.from('v_marketing_media_page').select('*').limit(300);
  const { data: raw } = await q;
  let candidates = ((raw ?? []) as CandidateRow[]);

  // Filter to photos + optional videos, drop removed / clarify-blocked.
  candidates = candidates.filter(r => {
    const type = (r.asset_type ?? '').toLowerCase();
    if (type === 'video' && !opts.includeVideoAssets) return false;
    return !!r.public_url;
  });

  // Optional areas filter.
  if (opts.areasIncluded && opts.areasIncluded.length > 0) {
    const set = new Set(opts.areasIncluded.map(s => s.toLowerCase()));
    const anyKept = candidates.some(r => set.has((r.property_area ?? '').toLowerCase()));
    if (anyKept) {
      candidates = candidates.filter(r => set.has((r.property_area ?? '').toLowerCase()));
    }
  }

  // 3) Score + rank.
  const scored = candidates
    .map(r => ({ row: r, score: scoreCandidate(r, parsed.keywords ?? [], parsed.scenes ?? []) }))
    .sort((a, b) => b.score - a.score);

  // Take top N unique by property_area if possible.
  const chosen: CandidateRow[] = [];
  const seenArea = new Set<string>();
  for (const { row } of scored) {
    if (chosen.length >= targetShotCount) break;
    const area = (row.property_area ?? '').toLowerCase();
    if (chosen.length < targetShotCount / 2 && seenArea.has(area)) continue;
    seenArea.add(area);
    chosen.push(row);
  }
  // If still under target, top-up.
  for (const { row } of scored) {
    if (chosen.length >= targetShotCount) break;
    if (!chosen.includes(row)) chosen.push(row);
  }

  // 4) Ask AI to arrange in narrative order.
  const narrPrompt = 'You will receive a JSON array of candidate shots. Reorder them into a narrative arc: establishing/wide → interior/mid → detail → hero. Return ONLY a JSON array of asset_id strings in the new order.\n\nSHOTS:\n' + JSON.stringify(
    chosen.map(r => ({ asset_id: r.asset_id, area: r.property_area, tier: r.primary_tier, desc: r.visual_description })),
  );
  const orderedIds = tryParseJson<string[]>(await askAnthropic('You are a video editor.', narrPrompt, 400));
  let finalOrder: CandidateRow[] = chosen;
  if (Array.isArray(orderedIds) && orderedIds.length > 0) {
    const byId = new Map(chosen.map(r => [r.asset_id, r]));
    const arranged: CandidateRow[] = [];
    for (const id of orderedIds) { const r = byId.get(id); if (r) arranged.push(r); }
    for (const r of chosen) if (!arranged.includes(r)) arranged.push(r);
    finalOrder = arranged;
  }

  // 5) Pick thumbnail (highest marketing_score, fallback: first shot).
  const thumbnail = [...chosen].sort((a, b) => Number(b.marketing_score ?? 0) - Number(a.marketing_score ?? 0))[0] ?? chosen[0] ?? null;

  // 6) Generate voiceover script.
  const wordCount = Math.max(20, Math.round(opts.targetLength * 2));
  const scriptSys = 'You are writing a voiceover for a luxury boutique hotel promo. Match the mood. Return ONLY the script text, no scene notes.';
  const scriptPrompt = 'Prompt: ' + prompt + '\nTarget length: ' + opts.targetLength + 's (~' + wordCount + ' words)\nStyle: ' + opts.style + '\nWrite an evocative script.';
  const script = (await askAnthropic(scriptSys, scriptPrompt, 300)) ?? '';

  return {
    shots: finalOrder.map(r => ({
      asset_id: r.asset_id,
      public_url: r.public_url ?? '',
      mime_type: r.mime_type,
      duration_sec: r.duration_sec ?? null,
      is_video: (r.asset_type ?? '').toLowerCase() === 'video',
      area: r.property_area, tier: r.primary_tier,
      reason: 'quality/match score selection',
    })),
    script: script.trim(),
    thumbnailAssetId: thumbnail?.asset_id ?? null,
    scenes: parsed.scenes ?? [],
    keywords: parsed.keywords ?? [],
  };
}
