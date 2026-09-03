// app/api/marketing/social/push/route.ts
// Delegates post publishing to the social-push Supabase edge function.
// Edge fn uses Upload Post SDK (esm.sh) which bypasses Cloudflare Bot Protection
// that blocks raw fetch() from data-centre IPs.
//
// Accepts BOTH JSON and form-encoded POST (Publish tab uses <form>, Quick Post
// uses form). Empty body returns invalid_json.
//
// POST { post_id, property_id? }  →  { ok, up_request_id, up_status } | { ok:false, error }
// Or form: post_id=<uuid>&property_id=<n> → 303 redirect back to /marketing/social?view=publish&pushed=1

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  let post_id = '';
  let property_id: number | null = null;
  let return_to = '';

  try {
    if (contentType.includes('application/json')) {
      const b = await req.json();
      post_id = String(b?.post_id || '');
      property_id = b?.property_id != null ? Number(b.property_id) : null;
    } else {
      const f = await req.formData();
      post_id = String(f.get('post_id') || '');
      const p = f.get('property_id');
      property_id = p != null && p !== '' ? Number(p) : null;
      return_to = String(f.get('return_to') || '/marketing/social?view=publish');
    }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 });
  if (property_id == null) return NextResponse.json({ error: 'property_id required' }, { status: 400 });

  // Verify caller has access to this property before invoking the edge fn
  const verifiedPropertyId = await requirePropertyAccess(req, property_id);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.functions.invoke('social-push', {
    body: { mode: 'push', post_id, property_id: verifiedPropertyId },
  });

  // Form submissions get redirected back with a status flag; JSON callers get JSON
  if (return_to) {
    const params = new URLSearchParams();
    params.set(error ? 'push_error' : 'pushed', error ? String(error.message || 'unknown') : String(data?.up_request_id || post_id.slice(0, 8)));
    const url = return_to.includes('?') ? `${return_to}&${params.toString()}` : `${return_to}?${params.toString()}`;
    return NextResponse.redirect(new URL(url, req.url), { status: 303 });
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json(data);
}
