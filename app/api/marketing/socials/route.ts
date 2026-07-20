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

function tags(s: any): string[] {
  return String(s || '').split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith('#') ? t : '#' + t));
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { b = {}; }
  const sb = getSupabaseAdmin();
  const op = String(b.op || '');
  try {
    if (op === 'create') {
      const p: any = { property_id: PID, platform: b.platform || 'instagram', caption: b.caption || '', created_by: 'pbs' };
      if (b.title) p.title = String(b.title);
      if (b.hashtags) p.hashtags = tags(b.hashtags);
      if (b.media_url) p.media_urls = [String(b.media_url)];
      if (b.scheduled_at) p.scheduled_at = String(b.scheduled_at);
      if (b.event_id) p.event_id = String(b.event_id);
      await sb.rpc('fn_social_post_create', { p });
    } else if (op === 'update') {
      const p: any = { post_id: String(b.post_id) };
      if (b.caption !== undefined) p.caption = String(b.caption);
      if (b.title !== undefined) p.title = String(b.title);
      if (b.platform) p.platform = String(b.platform);
      if (b.hashtags !== undefined) p.hashtags = tags(b.hashtags);
      if (b.media_url !== undefined) p.media_urls = b.media_url ? [String(b.media_url)] : [];
      if (b.scheduled_at !== undefined) p.scheduled_at = String(b.scheduled_at || '');
      await sb.rpc('fn_social_post_update', { p });
    } else if (op === 'set_status') {
      await sb.rpc('fn_social_post_set_status', { p_post_id: String(b.post_id), p_status: String(b.status) });
    } else if (op === 'delete') {
      await sb.rpc('fn_social_post_delete', { p_post_id: String(b.post_id) });
    } else if (op === 'compose') {
      if (b.event_id) await callEdge('social-compose', { property_id: PID, event_id: String(b.event_id) });
    } else {
      return NextResponse.json({ ok: false, error: 'unknown op' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
