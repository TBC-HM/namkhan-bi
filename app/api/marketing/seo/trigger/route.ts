// app/api/marketing/seo/trigger/route.ts
// Trigger SEO pipeline actions from the UI buttons
// Calls the fetch-serp-rankings Supabase edge function with the right mode
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EDGE_URL = 'https://kpenyneooigsyuuomgct.supabase.co/functions/v1/fetch-serp-rankings';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const ALLOWED_MODES = new Set(['post', 'fetch', 'volume', 'suggestions', 'local', 'analytics', 'onpage']);

export async function POST(req: NextRequest) {
  let body: { mode?: string } = {};
  try { body = await req.json(); } catch { /**/ }

  const mode = body.mode ?? 'post';
  if (!ALLOWED_MODES.has(mode)) {
    return NextResponse.json({ ok: false, error: `unknown mode: ${mode}` }, { status: 400 });
  }

  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ mode }),
  });

  const result = await res.json().catch(() => ({ ok: false }));
  return NextResponse.json({ ok: true, mode, result });
}
