// app/api/holding/invoices/create-and-send/route.ts
// PBS 2026-07-08 v2: also saves recipient profile + records recurring schedule.
// Creates invoice → renders HTML → optionally saves profile → optionally schedules recurring → sends email.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
function addToDate(iso: string, cadence: 'monthly' | 'quarterly' | 'yearly'): string {
  const d = new Date(iso + 'T00:00:00Z');
  if (cadence === 'monthly')   d.setUTCMonth(d.getUTCMonth() + 1);
  if (cadence === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
  if (cadence === 'yearly')    d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

interface Template {
  brand_name: string;
  brand_color: string;
  header_line: string | null;
  footer_line: string;
  sender_name: string | null;
  sender_address: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  sender_tax_id: string | null;
  sender_iban: string | null;
}

function renderInvoiceHtml(b: Body, invoiceNumber: string, subtotal: number, taxAmount: number, total: number, t: Template): string {
  const rows = b.line_items.map((l) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;color:${INK}">${escapeHtml(l.description)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${Number(l.qty).toLocaleString('en-US')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(Number(l.unit_price), b.currency)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${money(Number(l.qty) * Number(l.unit_price), b.currency)}</td>
    </tr>`).join('');
  const rec = b.recurring_cadence ? ` · <strong style="color:${t.brand_color}">Recurring: ${b.recurring_cadence}</strong>` : '';
  const brandColor = t.brand_color || PRIMARY;
  const brandName  = t.brand_name  || 'The Beyond Circle';
  const eyebrow    = t.header_line || 'Invoice';

  // Sender block (right-aligned in header)
  const senderHtml = (t.sender_name || t.sender_address) ? `
    ${t.sender_name    ? `<div style="font-weight:700;color:${INK};font-size:12px">${escapeHtml(t.sender_name)}</div>` : ''}
    ${t.sender_address ? `<div style="white-space:pre-wrap">${escapeHtml(t.sender_address)}</div>` : ''}
    ${t.sender_email   ? `<div>${escapeHtml(t.sender_email)}</div>` : ''}
    ${t.sender_phone   ? `<div>${escapeHtml(t.sender_phone)}</div>` : ''}
    ${t.sender_tax_id  ? `<div>Tax ID: ${escapeHtml(t.sender_tax_id)}</div>` : ''}` : '';

  // A4: max-width 210mm; @page rule for print/PDF.
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:15mm;}body{background:#f4f4ee}</style></head><body style="margin:0;padding:0;font-family:-apple-system,'SF Pro Text',Helvetica,Arial,sans-serif;color:${INK}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:210mm;margin:12px auto;background:${PAPER};box-shadow:0 2px 8px rgba(0,0,0,0.06)">
      <tr><td style="padding:28px 32px 14px 32px;border-bottom:1px solid ${HAIRLINE}">
        <table role="presentation" width="100%"><tr>
          <td style="vertical-align:top">
            <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:4px">${escapeHtml(eyebrow)}</div>
            <div style="font-size:22px;font-weight:700;color:${brandColor};letter-spacing:-0.01em">${escapeHtml(brandName)}</div>
            <div style="font-size:12px;color:${INK_SOFT};margin-top:2px">Invoice no.: <strong style="color:${INK}">${invoiceNumber}</strong> · Issued: <strong style="color:${INK}">${new Date().toISOString().slice(0,10)}</strong>${b.due_at ? ` · Due: <strong style="color:${INK}">${b.due_at}</strong>` : ''}${rec}</div>
          </td>
          <td style="vertical-align:top;text-align:right;font-size:11px;color:${INK_SOFT};line-height:1.55;min-width:200px">${senderHtml}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:22px 32px 6px 32px">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:6px">Billed to</div>
        <div style="font-size:14px;font-weight:600;color:${INK}">${escapeHtml(b.recipient_name)}</div>
        ${b.recipient_email ? `<div style="font-size:12px;color:${INK_SOFT}">${escapeHtml(b.recipient_email)}</div>` : ''}
        ${b.recipient_address ? `<div style="font-size:12px;color:${INK_SOFT};white-space:pre-wrap">${escapeHtml(b.recipient_address)}</div>` : ''}
        ${b.tax_id ? `<div style="font-size:12px;color:${INK_SOFT}">Tax ID: ${escapeHtml(b.tax_id)}</div>` : ''}
        ${b.subject ? `<div style="margin-top:10px;font-size:13px;color:${INK}"><strong>Subject:</strong> ${escapeHtml(b.subject)}</div>` : ''}
      </td></tr>
      <tr><td style="padding:14px 32px 0 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${HAIRLINE};background:${PAPER};border-radius:6px;overflow:hidden">
          <thead><tr style="background:${PAPER_SOFT}"><th style="padding:8px 10px;text-align:left;font-size:9px;color:${INK_SOFT};font-weight:700">Description</th><th style="padding:8px 10px;text-align:right;font-size:9px;color:${INK_SOFT};font-weight:700">Qty</th><th style="padding:8px 10px;text-align:right;font-size:9px;color:${INK_SOFT};font-weight:700">Unit</th><th style="padding:8px 10px;text-align:right;font-size:9px;color:${INK_SOFT};font-weight:700">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </td></tr>
      <tr><td style="padding:14px 32px">
        <table role="presentation" width="100%"><tr><td></td><td style="width:280px">
          <table role="presentation" width="100%">
            <tr><td style="padding:4px 10px;font-size:12px;color:${INK_SOFT}">Subtotal</td><td style="padding:4px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(subtotal, b.currency)}</td></tr>
            ${b.tax_pct > 0 ? `<tr><td style="padding:4px 10px;font-size:12px;color:${INK_SOFT}">Tax (${b.tax_pct}%)</td><td style="padding:4px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(taxAmount, b.currency)}</td></tr>` : ''}
            <tr><td style="padding:8px 10px;font-size:14px;font-weight:700;color:${INK};border-top:1px solid ${HAIRLINE}">Total</td><td style="padding:8px 10px;font-size:14px;text-align:right;font-weight:700;color:${brandColor};border-top:1px solid ${HAIRLINE};font-variant-numeric:tabular-nums">${money(total, b.currency)}</td></tr>
          </table>
        </td></tr></table>
      </td></tr>
      ${(b.notes || t.sender_iban) ? `<tr><td style="padding:14px 32px;font-size:11px;color:${INK_SOFT};white-space:pre-wrap;border-top:1px solid ${HAIRLINE}">${b.notes ? `<div><strong style="color:${INK}">Notes:</strong> ${escapeHtml(b.notes)}</div>` : ''}${t.sender_iban ? `<div style="margin-top:6px"><strong style="color:${INK}">IBAN:</strong> ${escapeHtml(t.sender_iban)}</div>` : ''}</td></tr>` : ''}
      <tr><td style="padding:20px 32px 24px 32px;border-top:1px solid ${HAIRLINE};font-size:11px;color:${INK_SOFT}">${escapeHtml(t.footer_line || 'The Beyond Circle · Holding · issued via Namkhan BI cockpit.')}</td></tr>
    </table></body></html>`;
}

async function loadTemplate(sb: ReturnType<typeof getSupabaseAdmin>): Promise<Template> {
  const { data } = await sb.from('v_holding_invoice_template').select('*').maybeSingle();
  const row = data as Partial<Template> | null;
  return {
    brand_name:     row?.brand_name     ?? 'The Beyond Circle',
    brand_color:    row?.brand_color    ?? '#084838',
    header_line:    row?.header_line    ?? 'Invoice',
    footer_line:    row?.footer_line    ?? 'The Beyond Circle · Holding · issued via Namkhan BI cockpit.',
    sender_name:    row?.sender_name    ?? null,
    sender_address: row?.sender_address ?? null,
    sender_email:   row?.sender_email   ?? null,
    sender_phone:   row?.sender_phone   ?? null,
    sender_tax_id:  row?.sender_tax_id  ?? null,
    sender_iban:    row?.sender_iban    ?? null,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body.recipient_name?.trim()) return NextResponse.json({ error: 'recipient_name required' }, { status: 400 });
    if (!Array.isArray(body.line_items) || body.line_items.length === 0) return NextResponse.json({ error: 'at least one line item required' }, { status: 400 });

    const sb = getSupabaseAdmin();

    // 1. Save recipient profile if requested
    let recipient_id: number | null = null;
    if (body.save_profile) {
      const { data: rid } = await sb.rpc('fn_holding_recipient_upsert', {
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
    const template = await loadTemplate(sb);
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
