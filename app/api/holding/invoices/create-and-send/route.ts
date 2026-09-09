// app/api/holding/invoices/create-and-send/route.ts
// PBS 2026-07-08 v2: also saves recipient profile + records recurring schedule.
// Creates invoice → renders HTML → optionally saves profile → optionally schedules recurring → sends email.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
// PBS 2026-09-09: the renderer moved to lib/holding/invoice-html.ts so the
// preview page renders the same document. Behaviour here is unchanged.
import { renderInvoiceHtml, loadInvoiceTemplate } from '@/lib/holding/invoice-html';

export const dynamic = 'force-dynamic';

interface Body {
  recipient_name: string;
  recipient_email: string | null;
  recipient_address: string | null;
  tax_id: string | null;
  subject: string | null;
  line_items: Array<{ description: string; qty: number; unit_price: number }>;
  tax_pct: number;
  currency: string;
  notes: string | null;
  due_at: string | null;
  save_profile?: boolean;
  recurring_cadence?: 'monthly' | 'quarterly' | 'yearly' | null;
  send: boolean;
}

function addToDate(iso: string, cadence: 'monthly' | 'quarterly' | 'yearly'): string {
  const d = new Date(iso + 'T00:00:00Z');
  if (cadence === 'monthly')   d.setUTCMonth(d.getUTCMonth() + 1);
  if (cadence === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
  if (cadence === 'yearly')    d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body.recipient_name?.trim()) return NextResponse.json({ error: 'recipient_name required' }, { status: 400 });
    if (!Array.isArray(body.line_items) || body.line_items.length === 0) return NextResponse.json({ error: 'at least one line item required' }, { status: 400 });

    const sb = getSupabaseAdmin();

    // 1. Save as client (in holding.clients CRM) if requested.
    // PBS 2026-07-09: was writing to holding.invoice_recipients (legacy). Now
    // consolidates into the proper Clients CRM so the picker + Clients tab agree.
    let recipient_id: number | null = null;
    if (body.save_profile) {
      const { data: rid } = await sb.rpc('fn_holding_client_upsert', {
        p_id: null,
        p_name: body.recipient_name.trim(),
        p_email: body.recipient_email,
        p_address: body.recipient_address,
        p_tax_id: body.tax_id,
        p_currency: body.currency ?? 'EUR',
      });
      if (rid) recipient_id = Number(rid);
    }

    // 2. Create invoice
    const { data, error } = await sb.rpc('fn_holding_invoice_create', {
      p_recipient_name: body.recipient_name.trim(),
      p_line_items: body.line_items,
      p_recipient_email: body.recipient_email,
      p_recipient_address: body.recipient_address,
      p_subject: body.subject,
      p_tax_pct: body.tax_pct ?? 0,
      p_currency: body.currency ?? 'EUR',
      p_notes: body.notes,
      p_due_at: body.due_at,
      p_created_by: 'pbsbase@gmail.com',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const r = data as { id: number; invoice_number: string; subtotal: number; tax_amount: number; total: number };

    // 3. Record recurring cadence + recipient_id via SECURITY DEFINER RPC.
    // PBS 2026-07-08: was `sb.schema('holding').from('invoices').update(patch)` — PostgREST
    // does not expose the `holding` schema, so the update silently no-op'd. Use RPC now.
    if (recipient_id || body.recurring_cadence) {
      await sb.rpc('fn_holding_invoice_apply_meta', {
        p_id: r.id,
        p_recipient_id: recipient_id,
        p_recurring_cadence: body.recurring_cadence ?? null,
      });
    }

    // PBS 2026-07-09: fetch the active template so the invoice picks up brand +
    // sender identity (Beyond Circle Dubai) + IBAN. Falls back to defaults if row missing.
    const template = await loadInvoiceTemplate(sb);
    const html = renderInvoiceHtml(body, r.invoice_number, Number(r.subtotal), Number(r.tax_amount), Number(r.total), template);

    // 4. Send email (if requested + email present)
    if (body.send && body.recipient_email) {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-report-email`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: body.recipient_email,
          subject: `Invoice ${r.invoice_number} · ${body.subject ?? 'The Beyond Circle'}`,
          html,
        }),
      });
      // Persist HTML snapshot regardless of send outcome
      await sb.rpc('fn_holding_invoice_mark_sent', { p_id: r.id, p_html: html });
      if (!res.ok) return NextResponse.json({ id: r.id, invoice_number: r.invoice_number, warning: `emailer HTTP ${res.status}` });
    } else {
      await sb.rpc('fn_holding_invoice_mark_sent', { p_id: r.id, p_html: html });
    }

    return NextResponse.json({ id: r.id, invoice_number: r.invoice_number, recipient_id, recurring: body.recurring_cadence ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
