// app/api/website/pages/versions/restore/route.ts
// website-module-v1 CMS-2 — restore a page version.
// POST {version_id, restore_note} → fn_website_restore_version
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { version_id, restore_note } = body;
  if (!version_id) return NextResponse.json({ error: 'version_id required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_restore_version', {
    p_version_id: version_id,
    p_restore_note: restore_note ?? 'UI restore',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
