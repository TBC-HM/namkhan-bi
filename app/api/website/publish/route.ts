// app/api/website/publish/route.ts
// website-module-v1 P3 — publish flow:
// 1. public.fn_website_record_publish(pid): regenerate siteData from rows,
//    snapshot as versioned website.build_artifacts row, audit-log.
// 2. Fire the host-agnostic deploy hook if configured: website.sites.deploy_hook_key
//    names an ENV VAR (e.g. WEBSITE_DEPLOY_HOOK_NAMKHAN) whose value is the hook URL.
//    Missing env var = recorded publish without deploy (site repo not live yet) — not an error.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let pid = PROPERTY_ID;
  try {
    const body = await req.json();
    if (body && body.property_id) pid = Number(body.property_id);
  } catch { /* empty body is fine */ }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_record_publish', {
    p_property_id: pid, p_actor: 'website-editor',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const res = (data ?? {}) as { ok?: boolean; error?: string; artifact_id?: number; version?: number; pages?: number };
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error || 'publish failed' }, { status: 500 });

  // Deploy hook (optional until the site repo/host exists).
  // website.sites.deploy_hook_key names an ENV VAR (host-agnostic); its value is the hook URL.
  let deployHookFired = false;
  let deployHookError: string | null = null;
  const { data: site } = await sb.from('v_website_sites')
    .select('deploy_hook_key').eq('property_id', pid).maybeSingle();
  const envKey = (site as { deploy_hook_key?: string | null } | null)?.deploy_hook_key ?? null;
  if (envKey) {
    const hookUrl = process.env[envKey];
    if (hookUrl) {
      try {
        const r = await fetch(hookUrl, { method: 'POST' });
        deployHookFired = r.ok;
        if (!r.ok) deployHookError = `deploy hook HTTP ${r.status}`;
      } catch (e) {
        deployHookError = e instanceof Error ? e.message : 'deploy hook fetch failed';
      }
    }
  }

  return NextResponse.json({
    ok: true,
    artifact_id: res.artifact_id ?? null,
    version: res.version ?? null,
    pages: res.pages ?? null,
    deploy_hook_fired: deployHookFired,
    deploy_hook_error: deployHookError,
  });
}
