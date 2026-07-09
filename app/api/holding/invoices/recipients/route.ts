// app/api/holding/invoices/recipients/route.ts
// PBS 2026-07-09: source-of-truth is holding.clients (proper CRM) — was
// holding.invoice_recipients (older save-on-send profiles). The invoice
// generator's "Pick client" dropdown reads this route.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface ClientRow {
  id: number;
  name: string;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  currency: string;
  notes: string | null;
  updated_at: string;
  last_invoice_at: string | null;
}

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('v_holding_clients')
      .select('id, name, email, address, tax_id, currency, notes, updated_at, last_invoice_at')
      .eq('active', true)
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as ClientRow[];
    // Shape into the Recipient interface the InvoiceGenerator picker expects
    // (last_used_at is the client's most recent invoice sent_at OR its updated_at as fallback).
    const shaped = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      address: r.address,
      tax_id: r.tax_id,
      currency: r.currency,
      notes: r.notes,
      last_used_at: r.last_invoice_at ?? r.updated_at,
    }));
    return NextResponse.json({ rows: shaped });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
