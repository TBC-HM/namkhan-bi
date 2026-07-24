// app/api/brain/rules/route.ts
// BRAIN v2 · classifier rules surface for /holding/it/brain.
//   GET  → { version, content_md, updated_at }  (active knowledge pack)
//   POST → { content_md } → fn_brain_rules_update (update-forward: new version
//           row, previous kept inactive; DB refuses packs < 500 chars).
// The live property-settings digest is appended automatically at classify time
// by fn_brain_knowledge() — it is NOT part of the editable pack.
// Session-gated by middleware like every /api/* route; DB via service role.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_brain_rules_get');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ ok: false, error: 'no active rules pack' }, { status: 500 });
  return NextResponse.json({ ok: true, ...row });
}

export async function POST(req: NextRequest) {
  let body: { content_md?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const content = (body.content_md ?? '').trim();
  if (content.length < 500) {
    return NextResponse.json({ ok: false, error: 'content_md too short (min 500 chars)' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_brain_rules_update', { p_content_md: content });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, version: data });
}
