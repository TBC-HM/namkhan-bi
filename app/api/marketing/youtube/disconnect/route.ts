// app/api/marketing/youtube/disconnect/route.ts
// PBS 2026-07-11 pm — Deactivates the active connection + best-effort revokes the token at Google.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { property_id?: number }

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const propertyId = Number(body.property_id ?? 260955);
  if (!Number.isFinite(propertyId)) {
    return NextResponse.json({ ok: false, error: 'bad_property_id' }, { status: 400 });
  }

  // Best-effort: revoke the access token at Google before flipping the row
  try {
    const tok = await getFreshAccessToken(propertyId);
    if (tok.ok && tok.access_token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.access_token)}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(() => null);
    }
  } catch { /* swallow — revoke is best-effort */ }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_yt_disconnect_channel', { p_property_id: propertyId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const row = (data ?? {}) as { ok?: boolean; deactivated_rows?: number };
  return NextResponse.json({ ok: row.ok ?? true, deactivated: row.deactivated_rows ?? 0 });
}
