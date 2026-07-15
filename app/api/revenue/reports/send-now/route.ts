import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Body {
  property_id?: number;
  template_key?: 'daily' | 'weekly' | 'monthly';
  // PBS 2026-07-16: optional ad-hoc recipient — bypasses the DB recipient list
  // so scheduler card can fire a one-off "Send once to <email>" without adding
  // the address as a permanent recipient.
  to?: string;
  to_name?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const propertyId  = Number(body.property_id);
    const templateKey = String(body.template_key ?? '');
    if (!Number.isFinite(propertyId)) return NextResponse.json({ error: 'invalid property_id' }, { status: 400 });
    if (!['daily','weekly','monthly'].includes(templateKey)) return NextResponse.json({ error: 'invalid template_key' }, { status: 400 });
    const adhocTo = typeof body.to === 'string' && body.to.includes('@') ? body.to.trim() : undefined;
    const adhocName = typeof body.to_name === 'string' && body.to_name.trim() ? body.to_name.trim() : undefined;

    const admin = getSupabaseAdmin();
    // Directly invoke the render-revenue-report edge fn with send=true so we get synchronous send + logging.
    const { data, error } = await admin.functions.invoke('render-revenue-report', {
      body: { property_id: propertyId, template_key: templateKey, send: true, to: adhocTo, to_name: adhocName },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? {});
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
