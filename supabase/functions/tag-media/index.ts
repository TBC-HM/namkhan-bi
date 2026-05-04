// supabase/functions/tag-media/index.ts v2
// Auto-Tagger — Claude Sonnet 4.6 vision call per photo. Reads thumbnail render,
// classifies against marketing.media_taxonomy (198 tags, 12 categories),
// writes media_tags + alt_text + caption + qc_score + ai_confidence + primary_tier.
// Logo override → tier_archive. Cron job 45 every 1 min via pg_net.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_OUT = 800;
const COST_CAP_EUR = 0.05;

interface AssetRow {
  asset_id: string;
  original_filename: string | null;
  width_px: number | null;
  height_px: number | null;
  master_path: string | null;
}

interface Tag {
  tag_id: number;
  tag_slug: string;
  category: string;
}

Deno.serve(async (_req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!url || !key) return json({ error: 'env_missing' }, 500);
  if (!apiKey) return json({ error: 'anthropic_key_missing' }, 500);

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: assets, error: pullErr } = await sb
    .schema('marketing')
    .from('media_assets')
    .select('asset_id, original_filename, width_px, height_px, master_path')
    .eq('status', 'ready')
    .eq('asset_type', 'photo')
    .is('qc_score', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (pullErr) return json({ error: 'pull_failed', detail: pullErr.message }, 500);
  if (!assets || assets.length === 0) return json({ processed: 0, message: 'queue empty' });

  const a = assets[0] as AssetRow;
  try {
    const result = await tagOne(sb, a, apiKey);
    return json({ processed: 1, results: [result] });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    return json({ processed: 1, results: [{ asset_id: a.asset_id, error: msg }] });
  }
});

async function tagOne(sb: any, a: AssetRow, apiKey: string) {
  const t0 = Date.now();

  const { data: taxonomy } = await sb
    .schema('marketing').from('media_taxonomy')
    .select('tag_id, tag_slug, category')
    .eq('is_active', true);
  const tags = (taxonomy ?? []) as Tag[];
  const tagBySlug = new Map(tags.map(t => [t.tag_slug, t]));

  const url = Deno.env.get('SUPABASE_URL')!;
  const thumbUrl = `${url}/storage/v1/object/public/media-renders/${a.asset_id}/thumbnail.jpg`;

  const byCat = new Map<string, string[]>();
  for (const t of tags) {
    const arr = byCat.get(t.category) ?? [];
    arr.push(t.tag_slug);
    byCat.set(t.category, arr);
  }
  const vocabText = Array.from(byCat.entries())
    .map(([cat, slugs]) => `${cat}: ${slugs.join(', ')}`)
    .join('\n');

  const systemPrompt = `You are the auto-tagger for The Namkhan, a riverside hotel in Luang Prabang, Laos. You classify photos against a fixed taxonomy and write Soho House-styled captions. Voice: quiet, observational, river-grounded, owner-led "we". Never use cliches, never use exclamation marks, never use "exquisite/unparalleled/breathtaking/nestled/haven".

Return JSON only. Schema:
{
  "tags": [{"slug": "river_namkhan", "confidence": 0.95}, ...],
  "caption": "...",
  "alt_text": "...",
  "qc_score": 0-100,
  "brand_fit": 0-100,
  "primary_tier": "tier_ota_profile|tier_website_hero|tier_social_pool|tier_internal|tier_archive",
  "orientation": "landscape|portrait|square",
  "is_logo": true/false,
  "reasoning": "..."
}

Tier rules:
- tier_ota_profile: clear, well-lit, no people in frame, shows a room / pool / dining / property feature, qc >= 70, landscape preferred
- tier_website_hero: editorial wide environmental shot, golden_hour or dramatic, qc >= 80, brand_fit >= 80, landscape
- tier_social_pool: anything brand_fit >= 60, story-worthy moments
- tier_internal: documentation, before/after, ops shots, anything qc < 60
- tier_archive: logos, vendor materials, decommissioned`;

  const userMessage = `Vocabulary (use these slugs only, never invent new ones):
${vocabText}

Filename for context: ${a.original_filename ?? 'unknown'}
Dimensions: ${a.width_px ?? '?'}x${a.height_px ?? '?'}

Classify this photo. Return JSON only.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS_OUT,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: thumbUrl } },
          { type: 'text', text: userMessage },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`anthropic_${resp.status}: ${errText.slice(0, 300)}`);
  }
  const json_resp = await resp.json();
  const tokensIn = json_resp.usage?.input_tokens ?? 0;
  const tokensOut = json_resp.usage?.output_tokens ?? 0;
  const costEur = (tokensIn * 3 + tokensOut * 15) / 1_000_000 * 0.92;

  if (costEur > COST_CAP_EUR) {
    throw new Error(`cost_cap_exceeded: €${costEur.toFixed(4)}`);
  }

  const text = (json_resp.content?.[0]?.text as string) ?? '';
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
  let parsed: any;
  try { parsed = JSON.parse(cleaned); }
  catch { throw new Error(`json_parse_failed: ${cleaned.slice(0, 200)}`); }

  const tagInserts: any[] = [];
  for (const t of (parsed.tags ?? [])) {
    const tagRow = tagBySlug.get(t.slug);
    if (!tagRow) continue;
    tagInserts.push({
      asset_id: a.asset_id,
      tag_id: tagRow.tag_id,
      confidence: Math.max(0, Math.min(1, Number(t.confidence ?? 0.7))),
      source: 'ai',
    });
  }

  await sb.schema('marketing').from('media_tags').delete().eq('asset_id', a.asset_id);
  if (tagInserts.length > 0) {
    const { error: tagErr } = await sb.schema('marketing').from('media_tags').insert(tagInserts);
    if (tagErr) throw new Error(`tag_insert_failed: ${tagErr.message}`);
  }

  const validTiers = new Set(['tier_ota_profile', 'tier_website_hero', 'tier_social_pool', 'tier_internal', 'tier_archive']);
  const tier = validTiers.has(parsed.primary_tier) ? parsed.primary_tier : 'tier_internal';
  const finalTier = parsed.is_logo === true ? 'tier_archive' : tier;

  const updatePatch: any = {
    caption: String(parsed.caption ?? '').slice(0, 500),
    alt_text: String(parsed.alt_text ?? '').slice(0, 300),
    qc_score: clamp01_100(parsed.qc_score),
    ai_confidence: clamp01(parsed.brand_fit ? parsed.brand_fit / 100 : 0.7),
    primary_tier: finalTier,
  };

  const { error: updErr } = await sb
    .schema('marketing').from('media_assets')
    .update(updatePatch).eq('asset_id', a.asset_id);
  if (updErr) throw new Error(`asset_update_failed: ${updErr.message}`);

  return {
    asset_id: a.asset_id,
    filename: a.original_filename,
    is_logo: parsed.is_logo,
    primary_tier: finalTier,
    qc_score: updatePatch.qc_score,
    brand_fit: parsed.brand_fit,
    caption: updatePatch.caption,
    alt_text: updatePatch.alt_text,
    tags_count: tagInserts.length,
    cost_eur: Number(costEur.toFixed(5)),
    duration_ms: Date.now() - t0,
  };
}

function clamp01(n: any): number {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
function clamp01_100(n: any): number {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
