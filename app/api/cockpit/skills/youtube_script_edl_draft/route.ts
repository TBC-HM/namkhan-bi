// app/api/cockpit/skills/youtube_script_edl_draft/route.ts
// Reel · script + Shotstack EDL drafter.
// Input : { property_id, brief_id?, angle_title, angle_hook?, duration_seconds, target_channel }
// Output: { ok, render_job_id, script_preview, cost_usd_milli }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk, extractJsonBlock, ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TargetChannel = 'youtube' | 'reel' | 'short';

const ASPECT_BY_CHANNEL: Record<TargetChannel, string> = {
  youtube: '16:9 (1920x1080)',
  reel:    '9:16 (1080x1920)',
  short:   '9:16 (1080x1920)',
};

interface DraftResp {
  script_lines: string[];
  edl:          Record<string, unknown>;
}

const REALITY_FALLBACK = `
NAMKHAN REALITY PROFILE (fallback)
==================================
• Small-boutique river lodge on the Nam Khan river, outside Luang Prabang, Laos.
• Capacity: 24 keys across 30 rooms; low-density by design.
• Sensory palette: teak + brass + linen + slow river + kingfisher + monk-bell dawn.
• Absolutely NOT: casino / party / rooftop / infinity-pool / megaresort language.
• Guest archetype: quiet-luxury, wellness-curious, culture-first.
`.trim();

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      property_id?:      number;
      brief_id?:         string;
      angle_title?:      string;
      angle_hook?:       string;
      duration_seconds?: number;
      target_channel?:   TargetChannel;
    };

    const property_id   = Number(body.property_id);
    const angle_title   = (body.angle_title ?? '').trim();
    const angle_hook    = (body.angle_hook  ?? '').trim();
    const duration      = Number(body.duration_seconds ?? 30);
    const target_channel: TargetChannel = (['youtube','reel','short'].includes(body.target_channel ?? '')
      ? body.target_channel
      : 'reel') as TargetChannel;

    if (!Number.isFinite(property_id) || property_id <= 0) return err('property_id_required', 400);
    if (!angle_title) return err('angle_title_required', 400);

    const sb = getSupabaseAdmin();

    // 1) Context — brief (optional) + vocab
    let briefContext = '';
    if (body.brief_id) {
      const { data: brief } = await sb
        .from('v_yt_trend_briefs')
        .select('candidate_angles,keyword_seeds,activation_score')
        .eq('brief_id', body.brief_id)
        .maybeSingle();
      if (brief) briefContext = `Trend brief context: keyword_seeds=${JSON.stringify((brief as { keyword_seeds: string[] }).keyword_seeds)} activation_score=${(brief as { activation_score: number }).activation_score}`;
    }

    const { data: vocabRows } = await sb
      .from('v_yt_vocabulary_matrix')
      .select('banned_term_lower,luxury_alternative,severity');
    const bannedList = (vocabRows ?? []) as Array<{ banned_term_lower: string; luxury_alternative: string; severity: string }>;
    const bannedSummary = bannedList
      .slice(0, 30)
      .map((r) => `  • "${r.banned_term_lower}" → "${r.luxury_alternative}" (${r.severity})`)
      .join('\n');

    // 2) Anthropic prompt
    const systemPrompt = [
      'You are Reel, a boutique-hospitality video script writer for the Namkhan lodge (a small river lodge in Luang Prabang, Laos).',
      'You output BOTH a spoken script AND a Shotstack Edit Decision List (EDL) JSON that a downstream renderer will consume.',
      'ALWAYS obey the vocabulary matrix. NEVER write banned words.',
      'ALWAYS output valid JSON — no markdown fences, no commentary. Structure: {"script_lines": ["…"], "edl": { … Shotstack EDL … }}.',
      'The EDL must include:',
      '  • "timeline": { "background": "#000000", "tracks": [ … ] }',
      '  • Track 0: video clips (asset.type="video", src, in, out, effect optional)',
      '  • Track 1: text overlays (asset.type="title" or "html", each clip has "text" and timing)',
      '  • "output": { "format":"mp4", "resolution": … }',
      'Keep it small enough to render — aim for 4-6 clips over the requested duration.',
      REALITY_FALLBACK,
      '',
      'VOCABULARY MATRIX (top 30 rows) — obey strictly:',
      bannedSummary,
    ].join('\n');

    const userPrompt = [
      `Angle title: ${angle_title}`,
      angle_hook ? `Hook: ${angle_hook}` : '',
      briefContext,
      `Target channel: ${target_channel} (aspect ratio ${ASPECT_BY_CHANNEL[target_channel]})`,
      `Duration: ${duration} seconds`,
      '',
      'Draft the script + EDL now. Return ONLY the JSON object.',
    ].filter(Boolean).join('\n');

    const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 3072 });
    if (!isLlmOk(llm)) return err(llm.error, 502, { detail: (llm as { detail?: string }).detail });

    const parsed = extractJsonBlock<DraftResp>(llm.text);
    if (!parsed || !Array.isArray(parsed.script_lines) || !parsed.edl) {
      return err('llm_bad_shape', 502, { raw_head: llm.text.slice(0, 240) });
    }

    // 3) Insert render job (status=queued)
    const cost_usd_milli = Math.round((llm.usage.in * 3 + llm.usage.out * 15) / 1000);
    const { data: job, error: insErr } = await sb
      .from('v_yt_render_jobs')
      .insert({
        property_id,
        brief_id:  body.brief_id ?? null,
        edl_json:  parsed.edl,
        script_json: { lines: parsed.script_lines, duration_seconds: duration, target_channel },
        status:    'queued',
        cost_usd:  cost_usd_milli / 1000,
      })
      .select('render_job_id')
      .single();

    if (insErr) return err('render_job_insert_failed', 500, { detail: insErr.message });

    return ok({
      render_job_id:   (job as { render_job_id: string }).render_job_id,
      script_preview:  parsed.script_lines.slice(0, 3),
      cost_usd_milli,
    });
  } catch (e) {
    return err('script_edl_draft_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
