// app/api/cockpit/walkthrough/route.ts
// PBS 2026-07-25 — Walkthrough feedback engine (ADR-walkthrough-feedback-engine).
// Four actions: start / close / finding / summary — all write via SECURITY DEFINER RPCs.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, ...params } = body as { action: string; [k: string]: unknown };

  // Resolve caller email from session cookie if present
  let callerEmail: string | null = null;
  try {
    const { createServerClient } = await import('@supabase/ssr');
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { session } } = await supa.auth.getSession();
    callerEmail = session?.user?.email ?? null;
  } catch { /* anonymous ok */ }

  const sb = getSupabaseAdmin();

  if (action === 'start') {
    const dept_slug = String(params.dept_slug ?? '');
    if (!dept_slug) return NextResponse.json({ error: 'dept_slug required' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_walkthrough_start', {
      p_dept_slug: dept_slug,
      p_property_id: params.property_id ? String(params.property_id) : null,
      p_started_by: callerEmail,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ walkthrough_id: data });
  }

  if (action === 'close') {
    const id = Number(params.walkthrough_id);
    if (!id) return NextResponse.json({ error: 'walkthrough_id required' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_walkthrough_close', { p_walkthrough_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ finding_count: data });
  }

  if (action === 'finding') {
    const dept_slug = String(params.dept_slug ?? '');
    const bug_body = String(params.body ?? '');
    if (!dept_slug || !bug_body) return NextResponse.json({ error: 'dept_slug + body required' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_bug_insert_walkthrough', {
      p_dept_slug: dept_slug,
      p_body: bug_body,
      p_page_url: params.page_url ? String(params.page_url) : null,
      p_component: params.component ? String(params.component) : null,
      p_clicked_selector: params.clicked_selector ? String(params.clicked_selector) : null,
      p_screenshot_path: params.screenshot_path ? String(params.screenshot_path) : null,
      p_property_id: params.property_id ? String(params.property_id) : null,
      p_walkthrough_id: params.walkthrough_id ? Number(params.walkthrough_id) : null,
      p_created_by: callerEmail,
      p_viewport: params.viewport ? String(params.viewport) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bug_id: data });
  }

  if (action === 'summary') {
    const id = Number(params.walkthrough_id);
    if (!id) return NextResponse.json({ error: 'walkthrough_id required' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_walkthrough_build_summary', { p_walkthrough_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data as object);
  }

  return NextResponse.json({ error: 'unknown action: ' + action }, { status: 400 });
}
