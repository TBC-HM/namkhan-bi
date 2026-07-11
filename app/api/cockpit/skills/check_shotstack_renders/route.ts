// app/api/cockpit/skills/check_shotstack_renders/route.ts
// Cron-invoked. Reconcile every yt_render_jobs row with status='rendering' —
// poll Shotstack /v1/render/{id}, and if done, patch output_url + status='done'.
// Input : {}  (no body)
// Output: { ok, checked, transitions }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret, ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RenderJobRow {
  render_job_id:        string;
  shotstack_render_id:  string;
  status:               string;
}

interface ShotstackStatusResp {
  success?: boolean;
  response?: {
    id?:     string;
    status?: string;   // 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed'
    url?:    string;
    error?:  string;
  };
}

export async function POST() {
  try {
    const sb = getSupabaseAdmin();
    const shotstackKey = await getVaultSecret('SHOTSTACK_API_KEY');
    if (!shotstackKey) return err('vault_key_missing_SHOTSTACK_API_KEY');
    const shotstackHost = (process.env.SHOTSTACK_HOST ?? 'https://api.shotstack.io/v1').replace(/\/$/, '');

    const { data: jobs, error: loadErr } = await sb
      .from('v_yt_render_jobs')
      .select('render_job_id,shotstack_render_id,status')
      .eq('status', 'rendering')
      .not('shotstack_render_id', 'is', null)
      .limit(50);
    if (loadErr) return err('render_jobs_load_failed', 500, { detail: loadErr.message });

    const transitions: Array<{ render_job_id: string; new_status: string; output_url?: string }> = [];
    let checked = 0;
    for (const job of ((jobs ?? []) as RenderJobRow[])) {
      checked++;
      const url = `${shotstackHost}/render/${encodeURIComponent(job.shotstack_render_id)}`;
      const r = await fetch(url, {
        headers: { 'x-api-key': shotstackKey },
        cache:   'no-store',
      });
      if (!r.ok) continue;
      const jr = (await r.json().catch(() => null)) as ShotstackStatusResp | null;
      if (!jr?.success) continue;
      const status = jr.response?.status;
      if (status === 'done' && jr.response?.url) {
        const { error: updErr } = await sb.from('v_yt_render_jobs').update({
          status:       'done',
          output_url:   jr.response.url,
          finished_at_utc: new Date().toISOString(),
        }).eq('render_job_id', job.render_job_id);
        if (!updErr) transitions.push({ render_job_id: job.render_job_id, new_status: 'done', output_url: jr.response.url });
      } else if (status === 'failed') {
        const { error: updErr } = await sb.from('v_yt_render_jobs').update({
          status:       'failed',
          error_msg:    (jr.response?.error ?? 'shotstack_failed').slice(0, 240),
          finished_at_utc: new Date().toISOString(),
        }).eq('render_job_id', job.render_job_id);
        if (!updErr) transitions.push({ render_job_id: job.render_job_id, new_status: 'failed' });
      }
    }

    return ok({ checked, transitions });
  } catch (e) {
    return err('check_renders_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
