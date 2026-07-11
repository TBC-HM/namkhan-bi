// app/api/cockpit/skills/youtube_write_metadata/route.ts
// Quill · draft title/description/tags/thumbnail choice from a rendered clip.
// Result lands in marketing.yt_publication_drafts (NOT yt_publications — that
// row is only created after actual upload gives us youtube_video_id).
// Input : { render_job_id }
// Output: { ok, draft_id, title, description_head, tags, chosen_thumbnail_index }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk, extractJsonBlock, ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QuillResp {
  title:                   string;
  description:             string;
  tags:                    string[];
  chosen_thumbnail_index:  number;
}

interface RenderJobRow {
  render_job_id:  string;
  property_id:    number;
  brief_id:       string | null;
  script_json:    { lines?: string[]; duration_seconds?: number; target_channel?: string } | null;
  thumbnail_urls: string[] | null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { render_job_id?: string };
    const render_job_id = body.render_job_id;
    if (!render_job_id) return err('render_job_id_required', 400);

    const sb = getSupabaseAdmin();

    // 1) Load render job + brief context + vocab
    const { data: jobRaw, error: loadErr } = await sb
      .from('v_yt_render_jobs')
      .select('render_job_id,property_id,brief_id,script_json,thumbnail_urls')
      .eq('render_job_id', render_job_id)
      .maybeSingle();
    if (loadErr) return err('render_job_load_failed', 500, { detail: loadErr.message });
    if (!jobRaw) return err('render_job_not_found', 404);
    const job = jobRaw as RenderJobRow;

    let briefLine = '';
    if (job.brief_id) {
      const { data: br } = await sb
        .from('v_yt_trend_briefs')
        .select('keyword_seeds,candidate_angles')
        .eq('brief_id', job.brief_id)
        .maybeSingle();
      if (br) briefLine = `Trend context: ${JSON.stringify((br as { keyword_seeds: string[] }).keyword_seeds ?? [])}`;
    }

    const { data: vocabRows } = await sb
      .from('v_yt_vocabulary_matrix')
      .select('banned_term_lower,luxury_alternative,severity');
    const bannedList = ((vocabRows ?? []) as Array<{ banned_term_lower: string; luxury_alternative: string; severity: string }>);
    const bannedSummary = bannedList
      .slice(0, 30)
      .map((r) => `  • "${r.banned_term_lower}" → "${r.luxury_alternative}" (${r.severity})`)
      .join('\n');

    const scriptText = (job.script_json?.lines ?? []).join('\n');
    const thumbCount = Math.max(1, (job.thumbnail_urls ?? []).length || 3);

    // 2) Anthropic prompt — must return strict JSON
    const systemPrompt = [
      'You are Quill, a YouTube metadata writer for a boutique river-lodge in Luang Prabang, Laos (Namkhan).',
      'Voice: quiet, sensory, culture-first. Never party-casino-megaresort language.',
      'You MUST obey the vocabulary matrix — never emit banned terms.',
      'Return ONLY a valid JSON object with keys:',
      '  title                  string, max 60 chars',
      '  description            string, max 5000 chars',
      '  tags                   string[] of exactly 10 lowercase tags, single-word or short-phrase',
      `  chosen_thumbnail_index integer 0..${thumbCount - 1}`,
      'No markdown fences, no commentary.',
      '',
      'VOCABULARY MATRIX (top 30 rows):',
      bannedSummary,
    ].join('\n');

    const userPrompt = [
      briefLine,
      job.script_json?.duration_seconds ? `Duration: ${job.script_json.duration_seconds}s` : '',
      job.script_json?.target_channel   ? `Target channel: ${job.script_json.target_channel}` : '',
      '',
      'SCRIPT:',
      '"""',
      scriptText || '(no script — draft generic metadata from the trend brief)',
      '"""',
      '',
      `Available thumbnails: ${thumbCount}. Pick one index.`,
      'Return the JSON object now.',
    ].filter(Boolean).join('\n');

    const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 2048 });
    if (!isLlmOk(llm)) return err(llm.error, 502, { detail: (llm as { detail?: string }).detail });

    const parsed = extractJsonBlock<QuillResp>(llm.text);
    if (!parsed || !parsed.title || !parsed.description || !Array.isArray(parsed.tags)) {
      return err('llm_bad_shape', 502, { raw_head: llm.text.slice(0, 240) });
    }

    // Clamp lengths — Anthropic sometimes forgets
    const title = parsed.title.slice(0, 60);
    const description = parsed.description.slice(0, 5000);
    const tags = parsed.tags.slice(0, 10).map((t) => t.toLowerCase().trim()).filter(Boolean);
    const chosen_thumbnail_index = Math.min(
      thumbCount - 1,
      Math.max(0, Number.isFinite(parsed.chosen_thumbnail_index) ? Number(parsed.chosen_thumbnail_index) : 0),
    );

    // 3) Insert draft
    const { data: draftRow, error: insErr } = await sb
      .from('v_yt_publication_drafts')
      .insert({
        property_id: job.property_id,
        render_job_id,
        title,
        description,
        tags,
        chosen_thumbnail_index,
        language: 'en',
        status:   'draft',
      })
      .select('draft_id')
      .single();

    if (insErr) return err('draft_insert_failed', 500, { detail: insErr.message });

    return ok({
      draft_id:                (draftRow as { draft_id: string }).draft_id,
      title,
      description_head:        description.slice(0, 200),
      tags,
      chosen_thumbnail_index,
    });
  } catch (e) {
    return err('write_metadata_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
