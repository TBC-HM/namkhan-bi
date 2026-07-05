// app/api/newsletter/media-list/route.ts
// PBS 2026-07-05: list branding-bucket photos for the newsletter media picker.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_newsletter_media')
    .select('path, url, category, filename, updated_at')
    .order('category').order('filename')
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, media: data || [] });
}
