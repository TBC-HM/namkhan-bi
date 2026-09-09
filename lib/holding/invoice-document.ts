// lib/holding/invoice-document.ts
// Resolve ONE holding invoice into a renderable document.
//
// Preference order matters and is the whole point of this module:
//   1. html_snapshot — the document that was actually ISSUED to the client.
//   2. a live render of the current ledger row — a view, not the issued record.
// Callers are told which one they got via `live`, so the UI can say so.
// Nothing here writes html_snapshot; only an actual send does that.
//
// Kept separate from invoice-html.ts so that module stays a pure renderer with
// no runtime imports (it is unit-testable standalone).

import type { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  renderInvoiceHtml, loadInvoiceTemplate, type InvoiceLineItem,
} from './invoice-html';

export interface InvoiceDocRow {
  id: number;
  invoice_number: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_address: string | null;
  subject: string | null;
  line_items: InvoiceLineItem[] | null;
  subtotal: string | null;
  tax_pct: string | null;
  tax_amount: string | null;
  total: string;
  currency: string;
  issued_at: string | null;
  due_at: string | null;
  notes: string | null;
  status: string;
  sent_at: string | null;
  recurring_cadence: string | null;
  html_snapshot: string | null;
}

export interface InvoiceDocument {
  row: InvoiceDocRow;
  /** null when the row could not be rendered at all. */
  html: string | null;
  /** true = re-rendered from the ledger row, NOT the issued document. */
  live: boolean;
  renderError: string | null;
}

export async function loadInvoiceDocument(
  sb: ReturnType<typeof getSupabaseAdmin>,
  id: number,
): Promise<InvoiceDocument | null> {
  // Keep this a string LITERAL — supabase-js infers GenericStringError from a
  // computed select() argument and the row cast then fails to typecheck.
  const { data } = await sb.from('v_holding_invoices')
    .select('id, invoice_number, recipient_name, recipient_email, recipient_address, subject, line_items, subtotal, tax_pct, tax_amount, total, currency, issued_at, due_at, notes, status, sent_at, recurring_cadence, html_snapshot')
    .eq('id', id).maybeSingle();
  const row = data as InvoiceDocRow | null;
  if (!row) return null;

  if (row.html_snapshot) {
    return { row, html: row.html_snapshot, live: false, renderError: null };
  }

  try {
    const template = await loadInvoiceTemplate(sb);
    const html = renderInvoiceHtml(
      {
        recipient_name: row.recipient_name,
        recipient_email: row.recipient_email,
        recipient_address: row.recipient_address,
        tax_id: null,
        subject: row.subject,
        line_items: Array.isArray(row.line_items) ? row.line_items : [],
        tax_pct: Number(row.tax_pct ?? 0),
        currency: row.currency,
        notes: row.notes,
        due_at: row.due_at,
        recurring_cadence: row.recurring_cadence,
        issued_at: row.issued_at,
      },
      row.invoice_number,
      Number(row.subtotal ?? 0),
      Number(row.tax_amount ?? 0),
      Number(row.total ?? 0),
      template,
    );
    return { row, html, live: true, renderError: null };
  } catch (e) {
    return { row, html: null, live: true, renderError: e instanceof Error ? e.message : String(e) };
  }
}

/** Filename for a downloaded invoice. Safe on every OS. */
export function invoiceFilename(invoiceNumber: string): string {
  return `invoice-${invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, '-')}.html`;
}
