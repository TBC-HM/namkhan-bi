// app/api/lead/capture/route.ts
// POST { email, firstName?, country?, sourcePageId? } -> calls web.capture_lead RPC
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, firstName, country, sourcePageId, consents } = await req.json().catch(() => ({}));
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.schema('web').rpc('capture_lead', {
      p_email: email,
      p_first_name: firstName ?? null,
      p_country: country ?? null,
      p_source_page_id: sourcePageId ?? null,
      p_consents: Array.isArray(consents) && consents.length > 0 ? consents : ['marketing'],
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, ...(data as any) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
