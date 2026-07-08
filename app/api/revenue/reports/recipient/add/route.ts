import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  property_id?: number;
  template_key?: 'daily' | 'weekly' | 'monthly';
  email?: string;
  name?: string | null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const propertyId  = Number(body.property_id);
    const templateKey = String(body.template_key ?? '');
    const email       = String(body.email ?? '').trim();
    const name        = body.name ? String(body.name).trim() : null;

    if (!Number.isFinite(propertyId)) return NextResponse.json({ error: 'invalid property_id' }, { status: 400 });
    if (!['daily','weekly','monthly'].includes(templateKey)) return NextResponse.json({ error: 'invalid template_key' }, { status: 400 });
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email))       return NextResponse.json({ error: 'invalid email' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc('fn_report_recipient_add', {
      p_property_id: propertyId,
      p_template_key: templateKey,
      p_email: email,
      p_name: name,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data, email, template_key: templateKey, property_id: propertyId });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
