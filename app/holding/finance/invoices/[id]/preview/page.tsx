// app/holding/finance/invoices/[id]/preview/page.tsx
// PBS 2026-07-09: Preview a stored invoice by id — renders the html_snapshot in an iframe.
// Sent invoices ledger opens this in a new tab via the Preview link.
// 2026-07-09 fix: read from public.v_holding_invoices bridge (not sb.schema('holding'))
// — PostgREST exposes only public, so the schema-scoped read returned null → notFound() 404.
//
// PBS 2026-09-09 fix: this page used to render ONLY html_snapshot, and that column
// is written in exactly one place — the create-and-send route, via
// fn_holding_invoice_mark_sent. 23 of 24 invoices were bulk-loaded straight into
// holding.invoices by the P&L reconstruction and never went through that path, so
// they had no snapshot and the page dead-ended on all of them. It now falls back to
// rendering live from the ledger row using the shared renderer.
//
// The distinction is deliberate and must not be collapsed: html_snapshot is the
// record of what was actually ISSUED to the client. A live re-render is a view of
// the current record, which may differ. The banner says which one you are looking
// at, and nothing here writes a rendered document back into html_snapshot.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';
import {
  renderInvoiceHtml, loadInvoiceTemplate, type InvoiceLineItem,
} from '@/lib/holding/invoice-html';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ id: string }>;

interface InvoiceRow {
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

export default async function InvoicePreviewPage({ params }: { params: Params }) {
  const p = await params;
  const id = Number(p.id);
  if (!Number.isFinite(id)) notFound();

  const sb = getSupabaseAdmin();
  // NB: keep this a string LITERAL — supabase-js infers GenericStringError from a
  // computed select() argument and the row cast then fails to typecheck.
  const { data } = await sb.from('v_holding_invoices')
    .select('id, invoice_number, recipient_name, recipient_email, recipient_address, subject, line_items, subtotal, tax_pct, tax_amount, total, currency, issued_at, due_at, notes, status, sent_at, recurring_cadence, html_snapshot')
    .eq('id', id).maybeSingle();
  const row = data as InvoiceRow | null;
  if (!row) notFound();

  const money = Number(row.total).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const sym = row.currency === 'EUR' ? '€' : (row.currency === 'USD' ? '$' : row.currency + ' ');

  // Prefer the issued document. Fall back to a live render of the ledger row.
  let html = row.html_snapshot;
  let live = false;
  let renderError: string | null = null;
  if (!html) {
    try {
      const template = await loadInvoiceTemplate(sb);
      html = renderInvoiceHtml(
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
      live = true;
    } catch (e) {
      renderError = e instanceof Error ? e.message : String(e);
    }
  }

  const wasIssued = row.status === 'sent' || row.status === 'paid';

  return (
    <div style={{ padding: 20, background: '#FFFFFF', color: '#1B1B1B', fontFamily: '-apple-system, Helvetica, Arial, sans-serif', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ borderBottom: '1px solid #E6DFCC', paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5A5A' }}>Invoice preview</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#084838', letterSpacing: '-0.01em' }}>{row.invoice_number}</div>
            <div style={{ fontSize: 12, color: '#5A5A5A' }}>To: <strong style={{ color: '#1B1B1B' }}>{row.recipient_name}</strong>{row.subject ? ` · ${row.subject}` : ''}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#5A5A5A' }}>
            <div>Total: <strong style={{ color: '#1B1B1B' }}>{sym}{money}</strong></div>
            <div>Status: <StatusPill status={row.status} /></div>
            {row.sent_at && <div>Sent: {new Date(row.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
          </div>
        </div>

        {live && (
          <div style={{ padding: '10px 14px', marginBottom: 12, background: '#FFFAF7', border: '1px solid #E6C9BF', borderLeft: '3px solid #B04A2F', borderRadius: 6, fontSize: 12, color: '#B04A2F', lineHeight: 1.55 }}>
            <strong>Reconstructed view — not the document that was issued.</strong>{' '}
            {wasIssued
              ? 'This invoice is marked ' + row.status + ', but no copy of what the client actually received is stored against it. What follows is rendered live from the current ledger record and may differ from the original.'
              : 'This invoice has not been sent, so no issued document exists yet. What follows is rendered live from the current ledger record.'}
          </div>
        )}

        {html ? (
          <div style={{ border: '1px solid #E6DFCC', borderRadius: 8, overflow: 'hidden', background: '#F4F4EE' }}>
            <iframe title={`Invoice ${row.invoice_number}`} srcDoc={html} style={{ width: '100%', minHeight: '80vh', border: 'none', background: '#FFFFFF' }} />
          </div>
        ) : (
          <div style={{ padding: 20, background: '#FFFAF7', border: '1px solid #E6C9BF', borderRadius: 6, fontSize: 12, color: '#B04A2F' }}>
            This invoice could not be rendered{renderError ? `: ${renderError}` : '.'}
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 11, color: '#5A5A5A' }}>
          <a href="/holding/finance/invoices" style={{ color: '#084838' }}>← back to Invoices</a>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    draft:     { bg: '#FAFAF7', fg: '#5A5A5A' },
    sent:      { bg: '#E7F1E9', fg: '#1F5C2C' },
    paid:      { bg: '#DCE9DC', fg: '#0F3D18' },
    cancelled: { bg: '#F5EDEB', fg: '#B04A2F' },
  };
  const s = map[status] ?? map.draft;
  return <span style={{ display: 'inline-block', padding: '2px 8px', background: s.bg, color: s.fg, borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{status}</span>;
}
