// app/api/cockpit/skills/guardrail_scan_yt/route.ts
// HoD-only. Scan a render_job's script + EDL for vocab / brand-safety issues.
// Input : { render_job_id }
// Output: { ok, passed, violations, blocked_count, warn_count }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  loadVocabRules, buildVocabRegex, scanTextForViolations, extractTextFromEdl,
  ok, err,
} from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RenderJobRow {
  render_job_id: string;
  property_id:   number;
  edl_json:      unknown;
  script_json:   { lines?: string[] } | null;
  status:        string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { render_job_id?: string };
    const render_job_id = body.render_job_id;
    if (!render_job_id) return err('render_job_id_required', 400);

    const sb = getSupabaseAdmin();

    // 1) Load render job (through bridge view)
    const { data: jobRaw, error: loadErr } = await sb
      .from('v_yt_render_jobs')
      .select('render_job_id,property_id,edl_json,script_json,status')
      .eq('render_job_id', render_job_id)
      .maybeSingle();

    if (loadErr) return err('render_job_load_failed', 500, { detail: loadErr.message });
    if (!jobRaw) return err('render_job_not_found', 404);
    const job = jobRaw as RenderJobRow;

    // 2) Extract text — script lines + EDL string fields
    const violations: ReturnType<typeof scanTextForViolations> = [];
    const rules    = await loadVocabRules();
    const compiled = buildVocabRegex(rules);

    if (job.script_json?.lines) {
      job.script_json.lines.forEach((line, i) => {
        violations.push(...scanTextForViolations(line, compiled, `script[${i}]`));
      });
    }
    const edlTexts = extractTextFromEdl(job.edl_json);
    for (const { label, text } of edlTexts) {
      violations.push(...scanTextForViolations(text, compiled, `edl.${label}`));
    }

    const blocked_count = violations.filter((v) => v.severity === 'block').length;
    const warn_count    = violations.filter((v) => v.severity !== 'block').length;
    const passed        = blocked_count === 0;

    // 3) Update render job — set guardrail_passed_at_utc when passed, always store violations
    const patch: Record<string, unknown> = { guardrail_violations: violations };
    if (passed) patch.guardrail_passed_at_utc = new Date().toISOString();
    else        patch.error_msg = `guardrail_failed: ${blocked_count} block violations`;

    const { error: updErr } = await sb
      .from('v_yt_render_jobs')
      .update(patch)
      .eq('render_job_id', render_job_id);

    if (updErr) return err('render_job_update_failed', 500, { detail: updErr.message });

    return ok({ passed, violations, blocked_count, warn_count });
  } catch (e) {
    return err('guardrail_scan_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
