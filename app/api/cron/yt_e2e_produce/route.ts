// app/api/cron/yt_e2e_produce/route.ts
// Production-pipeline driver (yt-completion brief 2026-07-28, verifier objection #1 / A7).
// Drives ONE marketing.yt_video_requests row through the full chain:
//   queued → script_edl_draft (LLM script + Shotstack EDL from real library assets)
//          → guardrail_scan_yt → render_shotstack (submit) → status 'rendering'
//   … job 138 (yt-shotstack-reconcile, 5-min) flips the render job to 'done' …
//   rendering + job done → youtube_write_metadata → yt_publication_drafts row
//          → request status 'review'.
// Idempotent two-phase: fire once to submit, fire again after the reconcile cron
// has seen Shotstack finish. Secret-gated like every /api/cron/yt_* shim; fired
// on demand (no pg_cron schedule — Shotstack spend is per-fire, pre-approved in
// the brief's §2 for the E2E dry run).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { POST as scriptDraftPOST } from '@/app/api/cockpit/skills/youtube_script_edl_draft/route';
import { POST as guardrailPOST } from '@/app/api/cockpit/skills/guardrail_scan_yt/route';
import { POST as renderPOST } from '@/app/api/cockpit/skills/youtube_render_shotstack/route';
import { POST as writeMetadataPOST } from '@/app/api/cockpit/skills/youtube_write_metadata/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NAMKHAN = 260955;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://namkhan-bi.vercel.app').replace(/\/$/, '');

interface VideoRequestRow {
  id: string;
  angle: string;
  style: string;
  duration_seconds: number | null;
  cta: string | null;
  notes: string | null;
  source_asset_urls: string[] | null;
  linked_brief_id: string | null;
  linked_render_job_id: string | null;
  status: string;
}

function authGate(req: Request): NextResponse | null {
  const required = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET;
  if (!required) return null;
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

/** Call an imported route handler with a synthetic JSON request and parse its JSON reply. */
async function callHandler(
  handler: (req: Request) => Promise<Response>,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const req = new Request('http://internal.local/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await handler(req);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

/** Pick real, public library assets for the EDL. Photos only — 'ready' JPEGs render
 *  reliably at Shotstack via the public preview route; phone-original MOVs do not
 *  (huge files, unknown duration, HEVC risk). Keyword-match the request angle
 *  against caption/visual_description, fall back to best-quality riverfront set. */
async function pickAssetUrls(angleText: string, limit = 5): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const words = Array.from(new Set(
    angleText.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
      .filter((w) => w.length >= 4 && !['namkhan', 'resort', 'pillar', 'video', 'season', 'their', 'through', 'viewers'].includes(w)),
  )).slice(0, 8);

  const { data } = await sb
    .from('v_marketing_media_page')
    .select('asset_id,caption,visual_description,quality_index')
    .eq('property_id', NAMKHAN)
    .eq('status', 'ready')
    .eq('asset_type', 'photo')
    .in('mime_type', ['image/jpeg', 'image/png', 'image/webp'])
    .gte('quality_index', 70)
    .order('quality_index', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Array<{ asset_id: string; caption: string | null; visual_description: string | null; quality_index: number | null }>;
  const scored = rows.map((r) => {
    const hay = `${r.caption ?? ''} ${r.visual_description ?? ''}`.toLowerCase();
    const hits = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    return { id: r.asset_id, score: hits * 100 + Number(r.quality_index ?? 0) };
  }).sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => `${SITE}/api/marketing/media/preview?asset_id=${s.id}`);
}

export async function POST(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;

  try {
    const body = (await req.json().catch(() => ({}))) as { video_request_id?: string };
    const sb = getSupabaseAdmin();

    // ── Phase 2 first: a request already mid-pipeline? ────────────────────────
    const { data: inFlightRaw } = await sb
      .from('v_yt_video_requests')
      .select('id,angle,style,duration_seconds,cta,notes,source_asset_urls,linked_brief_id,linked_render_job_id,status')
      .eq('property_id', NAMKHAN)
      .eq('status', 'rendering')
      .not('linked_render_job_id', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const inFlight = inFlightRaw as VideoRequestRow | null;

    if (inFlight && (!body.video_request_id || body.video_request_id === inFlight.id)) {
      const { data: jobRaw } = await sb
        .from('v_yt_render_jobs')
        .select('render_job_id,status,output_url,error_msg')
        .eq('render_job_id', inFlight.linked_render_job_id as string)
        .maybeSingle();
      const job = jobRaw as { render_job_id: string; status: string; output_url: string | null; error_msg: string | null } | null;
      if (!job) return NextResponse.json({ ok: false, error: 'linked_render_job_missing', video_request_id: inFlight.id }, { status: 500 });

      if (job.status === 'done') {
        // Draft already there? (idempotent re-fire)
        const { data: existingDraft } = await sb
          .from('v_yt_publication_drafts')
          .select('draft_id')
          .eq('render_job_id', job.render_job_id)
          .maybeSingle();
        let draft_id = (existingDraft as { draft_id: string } | null)?.draft_id ?? null;
        if (!draft_id) {
          const meta = await callHandler(writeMetadataPOST, { render_job_id: job.render_job_id });
          if (!meta.json.ok) {
            return NextResponse.json({ ok: false, phase: 'metadata_failed', detail: meta.json, video_request_id: inFlight.id }, { status: 502 });
          }
          draft_id = String(meta.json.draft_id ?? '');
        }
        await sb.from('v_yt_video_requests').update({ status: 'review', updated_at: new Date().toISOString() }).eq('id', inFlight.id);
        return NextResponse.json({
          ok: true, phase: 'completed', video_request_id: inFlight.id,
          render_job_id: job.render_job_id, output_url: job.output_url, draft_id,
        });
      }
      if (job.status === 'failed') {
        return NextResponse.json({ ok: false, phase: 'render_failed', video_request_id: inFlight.id, render_job_id: job.render_job_id, error_msg: job.error_msg }, { status: 502 });
      }
      return NextResponse.json({ ok: true, phase: 'waiting_render', video_request_id: inFlight.id, render_job_id: job.render_job_id, job_status: job.status });
    }

    // ── Phase 1: pick a request and submit it ────────────────────────────────
    let q = sb
      .from('v_yt_video_requests')
      .select('id,angle,style,duration_seconds,cta,notes,source_asset_urls,linked_brief_id,linked_render_job_id,status')
      .eq('property_id', NAMKHAN)
      .is('linked_render_job_id', null)
      .in('status', ['queued', 'scripting'])
      .order('created_at', { ascending: true })
      .limit(1);
    if (body.video_request_id) {
      q = sb
        .from('v_yt_video_requests')
        .select('id,angle,style,duration_seconds,cta,notes,source_asset_urls,linked_brief_id,linked_render_job_id,status')
        .eq('id', body.video_request_id)
        .limit(1);
    }
    const { data: reqRaw, error: reqErr } = await q.maybeSingle();
    if (reqErr) return NextResponse.json({ ok: false, error: 'request_load_failed', detail: reqErr.message }, { status: 500 });
    const vr = reqRaw as VideoRequestRow | null;
    if (!vr) return NextResponse.json({ ok: true, phase: 'nothing_to_do', detail: 'no queued video request without a render job' });

    const angleLines = vr.angle.split('\n').map((s) => s.trim()).filter(Boolean);
    const angle_title = (angleLines[0] ?? vr.angle).slice(0, 120);
    const angle_hook = angleLines.slice(1).join(' ').slice(0, 400);
    const target_channel = vr.style === 'short' ? 'short' : vr.style === 'reel' ? 'reel' : 'youtube';

    const asset_urls = (vr.source_asset_urls && vr.source_asset_urls.length > 0)
      ? vr.source_asset_urls.slice(0, 6)
      : await pickAssetUrls(vr.angle);
    if (asset_urls.length === 0) {
      return NextResponse.json({ ok: false, error: 'no_assets_available', video_request_id: vr.id }, { status: 500 });
    }

    // 1) Script + EDL
    const draft = await callHandler(scriptDraftPOST, {
      property_id: NAMKHAN,
      brief_id: vr.linked_brief_id ?? undefined,
      angle_title,
      angle_hook,
      duration_seconds: vr.duration_seconds ?? 25,
      target_channel,
      asset_urls,
    });
    if (!draft.json.ok) {
      return NextResponse.json({ ok: false, phase: 'script_failed', detail: draft.json, video_request_id: vr.id }, { status: 502 });
    }
    const render_job_id = String(draft.json.render_job_id);

    await sb.from('v_yt_video_requests')
      .update({ linked_render_job_id: render_job_id, status: 'scripting', updated_at: new Date().toISOString() })
      .eq('id', vr.id);

    // 2) Guardrail
    const guard = await callHandler(guardrailPOST, { render_job_id });
    if (!guard.json.ok || guard.json.passed !== true) {
      return NextResponse.json({ ok: false, phase: 'guardrail_blocked', detail: guard.json, video_request_id: vr.id, render_job_id }, { status: 422 });
    }

    // 3) Submit to Shotstack — job 138 reconciles from here.
    const render = await callHandler(renderPOST, { render_job_id });
    if (!render.json.ok) {
      return NextResponse.json({ ok: false, phase: 'render_submit_failed', detail: render.json, video_request_id: vr.id, render_job_id }, { status: 502 });
    }

    await sb.from('v_yt_video_requests')
      .update({ status: 'rendering', updated_at: new Date().toISOString() })
      .eq('id', vr.id);

    return NextResponse.json({
      ok: true, phase: 'submitted', video_request_id: vr.id, render_job_id,
      shotstack_render_id: render.json.shotstack_render_id, asset_urls_used: asset_urls.length,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'e2e_produce_crash', detail: String((e as Error).message ?? e).slice(0, 240) }, { status: 500 });
  }
}
export const GET = POST;
