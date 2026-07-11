// app/api/sop/proposals/generate-one/route.ts
// PBS 2026-07-11 pm (dir 3): headless single-proposal generator so the bulk
// "Generate all" button in the proposals cockpit can loop server-side. Runs
// the same 3-step pipeline the interactive Generate page does, but without a
// UI: load proposal → call /api/sop/generate → call /api/sop/save → call
// /api/sop/proposals/mark(status=generated, linked_sop_code=<new>).
//
// POST { id, dept, purpose }  →  { ok, sop_code } | { ok:false, error }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface Body { id?: number | string; dept?: string; purpose?: string }

interface Draft {
  title: string;
  short_summary: string;
  author: string;
  sop_date: string;
  bullets: string[];
  primary_audience: string;
}

interface SaveResult { row?: { sop_code?: string; id?: number }; error?: string }

const SCOPE_TO_PID: Record<string, number> = {
  namkhan: 260955,
  donna:   1000001,
  all:     260955,
};

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    const id = Number(b.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // 1) Load the proposal
    const { data: prop, error: propErr } = await sb
      .from('v_sop_proposals')
      .select('id, dept_code, title, purpose_short, property_scope, status, linked_sop_code')
      .eq('id', id)
      .maybeSingle();
    if (propErr) return NextResponse.json({ ok: false, error: 'proposal lookup failed: ' + propErr.message }, { status: 500 });
    if (!prop)   return NextResponse.json({ ok: false, error: 'proposal not found' }, { status: 404 });
    if (prop.status === 'accepted') {
      return NextResponse.json({ ok: true, already: 'accepted', sop_code: prop.linked_sop_code });
    }

    const dept = (b.dept ?? prop.dept_code ?? '').trim().toLowerCase();
    const purpose = (b.purpose ?? prop.purpose_short ?? prop.title ?? '').trim();
    const property_id = SCOPE_TO_PID[prop.property_scope ?? 'all'] ?? 260955;

    // 2) Draft the body via /api/sop/generate
    const genRes = await fetch(new URL('/api/sop/generate', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
      body: JSON.stringify({ property_id, dept_code: dept, purpose }),
    });
    const genJson = await genRes.json().catch(() => ({} as { draft?: Draft; error?: string }));
    if (!genRes.ok || !genJson.draft) {
      return NextResponse.json({
        ok: false,
        error: 'generate failed: ' + (genJson.error ?? ('HTTP ' + genRes.status)),
      }, { status: 500 });
    }
    const draft: Draft = genJson.draft;

    // 3) Save the SOP row
    const saveRes = await fetch(new URL('/api/sop/save', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
      body: JSON.stringify({
        property_id,
        dept_code: dept,
        title: (draft.title || prop.title).trim(),
        short_summary: (draft.short_summary || purpose).trim(),
        bullets: Array.isArray(draft.bullets) ? draft.bullets : [],
        author: draft.author || 'PBS (bulk generate)',
        sop_date: draft.sop_date || new Date().toISOString().slice(0, 10),
        primary_audience: draft.primary_audience || 'staff',
        source: 'proposal_bulk_generate',
      }),
    });
    const saveJson = await saveRes.json().catch(() => ({} as SaveResult));
    if (!saveRes.ok || !saveJson.row?.sop_code) {
      return NextResponse.json({
        ok: false,
        error: 'save failed: ' + (saveJson.error ?? ('HTTP ' + saveRes.status)),
      }, { status: 500 });
    }
    const sop_code = saveJson.row.sop_code;

    // 4) Mark proposal generated + link
    const markRes = await fetch(new URL('/api/sop/proposals/mark', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
      body: JSON.stringify({ id, status: 'generated', linked_sop_code: sop_code }),
    });
    const markJson = await markRes.json().catch(() => ({} as { error?: string }));
    if (!markRes.ok) {
      // The SOP was saved fine, but linkage failed — surface but don't block.
      return NextResponse.json({
        ok: true,
        sop_code,
        warning: 'saved SOP but mark-linked failed: ' + (markJson.error ?? ('HTTP ' + markRes.status)),
      });
    }

    return NextResponse.json({ ok: true, sop_code });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
