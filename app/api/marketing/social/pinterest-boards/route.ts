// app/api/marketing/social/pinterest-boards/route.ts
// Returns Pinterest boards stored for a property (synced via social-push sync_profiles mode).
// Call GET ?property_id=260955 — used by the SocialInbox board picker.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rawId = Number(req.nextUrl.searchParams.get('property_id'));
  if (!rawId) return NextResponse.json({ ok: false, error: 'property_id required' }, { status: 400 });
  const property_id = await requirePropertyAccess(req, rawId);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_pinterest_boards_for_property', { p_property_id: property_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, boards: data ?? [] });
}
