import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PID = 260955;

async function callEdge(slug: string, body: any) {
  const sb = getSupabaseAdmin();
  const { data: secret } = await sb.rpc('fn_read_vault_secret', { p_name: 'gh_bridge_caller_secret' });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  try {
    await fetch(base + '/functions/v1/' + slug, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bridge-secret': String(secret || '') }, body: JSON.stringify(body) });
  } catch (_) { /* edge fn completes server-side */ }
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { b = {}; }
  const sb = getSupabaseAdmin();
  const op = String(b.op || '');
  try {
    if (op === 'create') await sb.rpc('fn_menu_create', { p: { property_id: PID, kind: b.kind || 'food', title: b.title || 'New menu', created_by: 'pbs' } });
    else if (op === 'add_section') { const t = String(b.title || '').trim(); if (t) await sb.rpc('fn_menu_add_section', { p_menu_id: Number(b.menu_id), p_title: t, p_sort: 0 }); }
    else if (op === 'add_item') { const name = String(b.name || '').trim(); if (name) { const p: any = { menu_id: Number(b.menu_id), section_id: Number(b.section_id), name }; if (b.price_usd) p.price_usd = Number(b.price_usd); if (b.description) p.description = String(b.description); await sb.rpc('fn_menu_upsert_item', { p }); } }
    else if (op === 'dismiss_item') await sb.rpc('fn_menu_set_item_active', { p_item_id: Number(b.item_id), p_active: false });
    else if (op === 'decide') await sb.rpc('fn_menu_review_decide', { p_review_id: Number(b.review_id), p_decision: String(b.decision), p_by: 'pbs' });
    else if (op === 'publish') await sb.rpc('fn_menu_publish', { p_menu_id: Number(b.menu_id), p_by: 'pbs' });
    else if (op === 'run_review') await callEdge('menu-review', { menu_id: Number(b.menu_id) });
    else if (op === 'repair') await callEdge('menu-catalog-repair', { property_id: PID });
    else if (op === 'ingest') { if (String(b.text || '').trim().length > 4) await callEdge('menu-ingest', { property_id: PID, title: b.title || 'Imported menu', text: b.text }); }
    else return NextResponse.json({ ok: false, error: 'unknown op' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
