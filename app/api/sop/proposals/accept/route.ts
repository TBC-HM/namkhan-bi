// app/api/sop/proposals/accept/route.ts
// PBS 2026-07-11: Accept a proposal directly into the SOP registry as a stub
// SOP row (title + short_summary only, no body). Marks the proposal as accepted
// with linked_sop_code so the proposals list shows the connection.
//
// POST { id: number }
//   → { ok, sop_code, sop_id, registry_url }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { id?: number | string }

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    const id = Number(b.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();

    // 1. Load the proposal
    const { data: prop, error: propErr } = await sb
      .from('v_sop_proposals')
      .select('id, dept_code, title, purpose_short, priority, tags, property_scope, status, linked_sop_code')
      .eq('id', id)
      .maybeSingle();
    if (propErr) return NextResponse.json({ error: 'proposal lookup failed: ' + propErr.message }, { status: 500 });
    if (!prop)   return NextResponse.json({ error: 'proposal not found' }, { status: 404 });
    if (prop.status === 'accepted' && prop.linked_sop_code) {
      // Idempotent — return the existing link
      return NextResponse.json({
        ok: true,
        sop_code: prop.linked_sop_code,
        already_accepted: true,
        registry_url: '/operations/qa/registry',
      });
    }

    // 2. Determine property_id — proposals are dept-scoped; property_scope tells us tenant
    const property_id = prop.property_scope === 'donna' ? 1000001
                      : prop.property_scope === 'namkhan' ? 260955
                      : 260955;  // 'all' → default to Namkhan for stub

    // 3. Create the stub SOP via existing /api/sop/save contract (bullets empty)
    const saveRes = await fetch(new URL('/api/sop/save', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // pass through cookies for auth
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        property_id,
        dept_code: prop.dept_code,
        title: prop.title.trim(),
        short_summary: (prop.purpose_short || '').trim(),
        bullets: [],
        author: 'PBS (auto-accept from proposal)',
        sop_date: new Date().toISOString().slice(0, 10),
        primary_audience: 'staff',
        source: 'proposal_accepted',
      }),
    });
    const saveJson = await saveRes.json().catch(() => ({} as { row?: { sop_code?: string; id?: number }; error?: string }));
    if (!saveRes.ok || !saveJson.row?.sop_code) {
      return NextResponse.json({
        error: 'stub SOP save failed: ' + (saveJson.error ?? `HTTP ${saveRes.status}`),
      }, { status: 500 });
    }
    const sop_code = saveJson.row.sop_code;

    // 4. Mark the proposal accepted + link
    const markRes = await fetch(new URL('/api/sop/proposals/mark', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ id, status: 'accepted', linked_sop_code: sop_code }),
    });
    if (!markRes.ok) {
      // Not fatal — SOP was created, but proposal status update failed. Still return success.
      const markErr = await markRes.text().catch(() => '');
      return NextResponse.json({
        ok: true,
        sop_code,
        sop_id: saveJson.row.id,
        warning: 'stub SOP created but proposal status update failed: ' + markErr.slice(0, 200),
        registry_url: '/operations/qa/registry',
      });
    }

    return NextResponse.json({
      ok: true,
      sop_code,
      sop_id: saveJson.row.id,
      registry_url: '/operations/qa/registry',
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
