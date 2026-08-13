// app/api/marketing/seo/trigger/route.ts
// Trigger SEO pipeline actions via the governed d4s adapter
// Replaces direct edge-function calls with DB-side orchestration
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const ALLOWED_MODES = new Set(['post', 'fetch', 'rankings', 'gbp', 'competitors']);

export async function POST(req: NextRequest) {
  let body: { mode?: string; property_id?: number } = {};
  try { 
    body = await req.json(); 
  } catch { /**/ }

  const mode = body.mode ?? 'post';
  const propertyId = body.property_id ?? 260955; // Default to The Nam Khan

  if (!ALLOWED_MODES.has(mode)) {
    return NextResponse.json({ ok: false, error: `unknown mode: ${mode}` }, { status: 400 });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: 'service key not configured' }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (mode === 'post' || mode === 'rankings') {
      // Post SERP ranking tasks
      const { data, error } = await sb.rpc('fn_d4s_rank_weekly', { p_property_id: propertyId });
      if (error) throw error;
      return NextResponse.json({ 
        ok: true, 
        mode, 
        result: { posted: data?.keywords_queued ?? 0 } 
      });
    }

    if (mode === 'gbp') {
      // Post GBP daily tasks
      const { data, error } = await sb.rpc('fn_d4s_gbp_daily', { p_property_id: propertyId });
      if (error) throw error;
      return NextResponse.json({ 
        ok: true, 
        mode, 
        result: { posted: data?.tasks_posted ?? 0 } 
      });
    }

    if (mode === 'competitors') {
      // Post competitor analysis tasks
      const { data, error } = await sb.rpc('fn_d4s_competitors_weekly', { p_property_id: propertyId });
      if (error) throw error;
      return NextResponse.json({ 
        ok: true, 
        mode, 
        result: { posted: data?.competitors_queued ?? 0 } 
      });
    }

    if (mode === 'fetch') {
      // Poll tasks and ingest results
      const pollRes = await sb.rpc('fn_d4s_poll');
      if (pollRes.error) throw pollRes.error;
      
      const ingestRes = await sb.rpc('fn_d4s_ingest');
      if (ingestRes.error) throw ingestRes.error;

      const fetched = pollRes.data?.fetched ?? 0;
      const serp = ingestRes.data?.[0]?.serp_count ?? 0;
      
      return NextResponse.json({ 
        ok: true, 
        mode, 
        result: { 
          fetched, 
          with_position: serp,
          upserted: serp 
        } 
      });
    }

    return NextResponse.json({ ok: false, error: 'mode not implemented' }, { status: 400 });

  } catch (err: any) {
    console.error('SEO trigger error:', err);
    return NextResponse.json({ 
      ok: false, 
      result: { error: err.message ?? 'Internal error' } 
    }, { status: 500 });
  }
}