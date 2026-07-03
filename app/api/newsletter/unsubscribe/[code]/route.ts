// app/api/newsletter/unsubscribe/[code]/route.ts
// One-click unsubscribe. GET renders a simple confirmation HTML page; the
// action is idempotent — fn_unsubscribe inserts into guest.unsubscribes with
// ON CONFLICT DO NOTHING and stamps unsubscribed_at on the recipient row.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  let ok = false;
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.schema('guest').rpc('fn_unsubscribe', { p_track_code: code, p_reason: null });
    ok = !error;
  } catch { ok = false; }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body{margin:0;background:#FAF7EE;font-family:Georgia,serif;color:#1B1B1B;}
    .card{max-width:520px;margin:80px auto;background:#FFF;border:1px solid #E6DFCC;border-radius:6px;padding:32px;text-align:center;}
    h1{font-size:22px;margin:0 0 12px 0;}
    p{font-size:15px;line-height:1.6;margin:8px 0;color:#3A3A3A;}
    .small{font-size:12px;color:#5A5A5A;margin-top:24px;}
  </style></head><body>
  <div class="card">
    <h1>${ok ? 'You have been unsubscribed' : 'Something went wrong'}</h1>
    <p>${ok
      ? 'We will not send you any more newsletters. If this was a mistake, reply to our last email and we will put you back on the list.'
      : 'We could not process this unsubscribe request. Please reply to any of our emails and we will remove you manually.'}</p>
    <div class="small">The Namkhan · Luang Prabang, Laos</div>
  </div>
  </body></html>`;

  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export const dynamic = 'force-dynamic';
