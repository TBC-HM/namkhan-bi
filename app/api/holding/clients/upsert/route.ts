// app/api/holding/clients/upsert/route.ts
// PBS 2026-07-09: create or update a holding client (simple CRM).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface Body {
  id?: number | null;
  name?: string;
  legal_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
  country?: string | null;
  currency?: string | null;
  category?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    if (!b.id && !b.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_holding_client_upsert', {
      p_id: b.id ?? null,
      p_name: b.name?.trim() ?? null,
      p_legal_name: b.legal_name ?? null,
      p_contact_person: b.contact_person ?? null,
      p_email: b.email ?? null,
      p_phone: b.phone ?? null,
      p_address: b.address ?? null,
      p_tax_id: b.tax_id ?? null,
      p_country: b.country ?? null,
      p_currency: b.currency ?? 'EUR',
      p_category: b.category ?? null,
      p_tags: b.tags ?? null,
      p_notes: b.notes ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: Number(data) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
