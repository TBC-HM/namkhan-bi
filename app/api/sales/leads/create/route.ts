// app/api/sales/leads/create/route.ts
// PBS 2026-07-11 pm (dir 1) — Sales CRM · manual lead create.
// POST { property_id, company_name, type, country, city, decision_maker_name,
//        decision_maker_role, email, phone_whatsapp, icp_score, intent_score,
//        origin, notes } → { ok:true, lead_id }
// Writes directly to sales.leads via getSupabaseAdmin() (bypasses PostgREST
// public-schema-only limit; service role can write to any schema).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  property_id?: number;
  company_name: string;
  type?: string;
  country?: string | null;
  city?: string | null;
  decision_maker_name?: string | null;
  decision_maker_role?: string | null;
  email?: string | null;
  phone_whatsapp?: string | null;
  icp_score?: number | null;
  intent_score?: number | null;
  origin?: 'inbound' | 'outbound';
  notes?: string | null;
}

const NAMKHAN = 260955;
const LEAD_TYPES = new Set(['wholesale','dmc','agent','corp','retreat','other']);

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    const company = String(b.company_name ?? '').trim();
    if (!company) return NextResponse.json({ error: 'company_name required' }, { status: 400 });

    const type = LEAD_TYPES.has(String(b.type ?? '')) ? String(b.type) : 'other';
    const origin = b.origin === 'inbound' ? 'inbound' : 'outbound';
    const pid = Number.isFinite(b.property_id) && Number(b.property_id) > 0 ? Number(b.property_id) : NAMKHAN;

    const icp = b.icp_score == null || b.icp_score === undefined ? null : Math.max(0, Math.min(100, Number(b.icp_score)));
    const intent = b.intent_score == null || b.intent_score === undefined ? null : Math.max(0, Math.min(100, Number(b.intent_score)));

    const row = {
      property_id: pid,
      company_name: company,
      category: type,             // sales.leads.category maps to the "type" input from the form
      country: b.country ?? null,
      city: b.city ?? null,
      decision_maker_name: b.decision_maker_name ?? null,
      decision_maker_role: b.decision_maker_role ?? null,
      email: b.email ?? null,
      phone_whatsapp: b.phone_whatsapp ?? null,
      icp_score: icp,
      intent_score: intent,
      status: 'new',
      stage: 'new',
      origin,
      notes: b.notes ?? null,
      source: 'manual',
      stage_changed_at: new Date().toISOString(),
    };

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .schema('sales')
      .from('leads')
      .insert(row)
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, lead_id: data?.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
