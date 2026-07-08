// app/api/holding/invoices/create-and-send/route.ts
// PBS 2026-07-08: Beyond Circle invoice · create + (optionally) send.
// Calls fn_holding_invoice_create to reserve the number + persist, renders
// HTML server-side, then hands off to send-report-email if send=true.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface Body {
  recipient_name: string;
  recipient_email: string | null;
  recipient_address: string | null;
  subject: string | null;
  line_items: Array<{ description: string; qty: number; unit_price: number }>;
  tax_pct: number;
  currency: string;
  notes: string | null;
  due_at: string | null;
  send: boolean;
}

const PRIMARY = '#084838';
const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const PAPER = '#FFFFFF';
const PAPER_SOFT = '#FAFAF7';

function money(n: number, ccy: string): string {
  if (!Number.isFinite(n)) return '—';
  const sym = ccy === 'EUR' ? '€' : (ccy === 'USD' ? '$' : `${ccy} `);
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInvoiceHtml(b: Body, invoiceNumber: string, subtotal: number, taxAmount: number, total: number): string {
  const rows = b.line_items.map((l) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;color:${INK}">${escapeHtml(l.description)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${Number(l.qty).toLocaleString('en-US')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(Number(l.unit_price), b.currency)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${money(Number(l.qty) * Number(l.unit_price), b.currency)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${invoiceNumber}</title></head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,'SF Pro Text',Helvetica,Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:${PAPER}">
    <tr><td style="padding:28px 32px 14px 32px;border-bottom:1px solid ${HAIRLINE}">
      <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:4px">Invoice</div>
      <div style="font-size:22px;font-weight:700;color:${PRIMARY};letter-spacing:-0.01em">The Beyond Circle</div>
      <div style="font-size:12px;color:${INK_SOFT};margin-top:2px">Invoice no.: <strong style="color:${INK}">${invoiceNumber}</strong> · Issued: <strong style="color:${INK}">${new Date().toISOString().slice(0,10)}</strong>${b.due_at ? ` · Due: <strong style=\"color:${INK}\">${b.due_at}</strong>` : ''}</div>
    </td></tr>
    <tr><td style="padding:22px 32px 6px 32px">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:6px">Billed to</div>
      <div style="font-size:14px;font-weight:600;color:${INK}">${escapeHtml(b.recipient_name)}</div>
      ${b.recipient_email ? `<div style="font-size:12px;color:${INK_SOFT}">${escapeHtml(b.recipient_email)}</div>` : ''}
      ${b.recipient_address ? `<div style="font-size:12px;color:${INK_SOFT};white-space:pre-wrap">${escapeHtml(b.recipient_address)}</div>` : ''}
      ${b.subject ? `<div style="margin-top:10px;font-size:13px;color:${INK}"><strong>Subject:</strong> ${escapeHtml(b.subject)}</div>` : ''}
    </td></tr>
    <tr><td style="padding:14px 32px 0 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${HAIRLINE};background:${PAPER};border-radius:6px;overflow:hidden">
        <thead>
          <tr style="background:${PAPER_SOFT}">
            <th style="padding:8px 10px;text-align:left;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};font-weight:700;border-bottom:1px solid ${HAIRLINE}">Description</th>
            <th style="padding:8px 10px;text-align:right;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};font-weight:700;border-bottom:1px solid ${HAIRLINE}">Qty</th>
            <th style="padding:8px 10px;text-align:right;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};font-weight:700;border-bottom:1px solid ${HAIRLINE}">Unit</th>
            <th style="padding:8px 10px;text-align:right;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};font-weight:700;border-bottom:1px solid ${HAIRLINE}">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </td></tr>
    <tr><td style="padding:14px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td></td>
          <td style="width:280px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <tr><td style="padding:4px 10px;font-size:12px;color:${INK_SOFT}">Subtotal</td><td style="padding:4px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(subtotal, b.currency)}</td></tr>
              ${b.tax_pct > 0 ? `<tr><td style="padding:4px 10px;font-size:12px;color:${INK_SOFT}">Tax (${b.tax_pct}%)</td><td style="padding:4px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(taxAmount, b.currency)}</td></tr>` : ''}
              <tr><td style="padding:8px 10px;font-size:14px;font-weight:700;color:${INK};border-top:1px solid ${HAIRLINE}">Total</td><td style="padding:8px 10px;font-size:14px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;border-top:1px solid ${HAIRLINE};color:${PRIMARY}">${money(total, b.currency)}</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
    ${b.notes ? `<tr><td style="padding:14px 32px;font-size:11px;color:${INK_SOFT};white-space:pre-wrap;border-top:1px solid ${HAIRLINE}"><strong style="color:${INK}">Notes:</strong> ${escapeHtml(b.notes)}</td></tr>` : ''}
    <tr><td style="padding:20px 32px 24px 32px;border-top:1px solid ${HAIRLINE};font-size:11px;color:${INK_SOFT}">The Beyond Circle · Holding · issued via Namkhan BI cockpit.</td></tr>
  </table>
</body></html>`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body.recipient_name?.trim()) return NextResponse.json({ error: 'recipient_name required' }, { status: 400 });
    if (!Array.isArray(body.line_items) || body.line_items.length === 0) return NextResponse.json({ error: 'at least one line item required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_holding_invoice_create', {
      p_recipient_name:    body.recipient_name.trim(),
      p_recipient_email:   body.recipient_email,
      p_recipient_address: body.recipient_address,
      p_subject:           body.subject,
      p_line_items:        body.line_items,
      p_tax_pct:           body.tax_pct ?? 0,
      p_currency:          body.currency ?? 'EUR',
      p_notes:             body.notes,
      p_due_at:            body.due_at,
      p_created_by:        'pbsbase@gmail.com',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const r = data as { id: number; invoice_number: string; subtotal: number; tax_amount: number; total: number };
    const html = renderInvoiceHtml(body, r.invoice_number, Number(r.subtotal), Number(r.tax_amount), Number(r.total));

    if (body.send && body.recipient_email) {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-report-email`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` },
        body: JSON.stringify({
          to: body.recipient_email,
          name: body.recipient_name,
          subject: `Invoice ${r.invoice_number} · ${body.subject ?? 'The Beyond Circle'}`,
          html,
          meta: { holding_invoice_id: r.id, invoice_number: r.invoice_number },
        }),
      });
      if (!res.ok) {
        // Persist HTML anyway so the row survives — status stays 'draft'
        await sb.rpc('fn_holding_invoice_mark_sent', { p_id: r.id, p_html: html });
        return NextResponse.json({ id: r.id, invoice_number: r.invoice_number, warning: `emailer HTTP ${res.status}` });
      }
    }

    // Mark sent (or persist HTML snapshot for drafts)
    await sb.rpc('fn_holding_invoice_mark_sent', { p_id: r.id, p_html: html });
    return NextResponse.json({ id: r.id, invoice_number: r.invoice_number });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
