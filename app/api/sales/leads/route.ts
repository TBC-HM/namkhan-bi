// app/api/sales/leads/route.ts
// PBS 2026-07-14 (Sales CRM upgrade) — list + upsert endpoint.
//   GET  ?stage=&priority=&search=&status=&limit=100 → { leads: [...] }
//         reads public.v_leads_full (bridge view, PostgREST-safe)
//   POST body → public.fn_lead_upsert(p jsonb) → { lead_id }
// Property-scoped to 260955 (Namkhan) unless caller passes property_id in body.
// Uses getSupabaseAdmin() (service role) so we can call SECURITY DEFINER RPCs
// against the sales schema without exposing it to PostgREST.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const stage    = url.searchParams.get('stage');       // csv or single
    const priority = url.searchParams.get('priority');    // csv or single
    const status   = url.searchParams.get('status') || 'active,new';
    const search   = (url.searchParams.get('search') || '').trim();
    const limit    = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || '200')));
    const pid      = Number(url.searchParams.get('property_id') || NAMKHAN);

    const sb = getSupabaseAdmin();
    let q = sb
      .from('v_leads_full')
      .select('*')
      .eq('property_id', pid)
      .order('stage_changed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (stage) {
      const list = stage.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length === 1) q = q.eq('stage', list[0]);
      else if (list.length > 1) q = q.in('stage', list);
    }
    if (priority) {
      const list = priority.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length === 1) q = q.eq('final_priority', list[0]);
      else if (list.length > 1) q = q.in('final_priority', list);
    }
    if (status && status !== 'all') {
      const list = status.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length === 1) q = q.eq('status', list[0]);
      else if (list.length > 1) q = q.in('status', list);
    }
    if (search) {
      const like = '%' + search.replace(/[,%]/g, ' ') + '%';
      q = q.or(
        'company_name.ilike.' + like +
        ',email.ilike.' + like +
        ',decision_maker_name.ilike.' + like
      );
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ leads: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_lead_upsert', { p: body });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
