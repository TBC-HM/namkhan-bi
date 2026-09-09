// app/api/holding/invoices/[id]/document/route.ts
// Serves one invoice as a standalone HTML document.
//   GET .../document            → inline (open in a tab)
//   GET .../document?download=1 → attachment (Save as…)
//
// The document carries @page{size:A4}, so the browser's own Print → Save as PDF
// produces a correct A4 invoice. No PDF library is installed and none is needed.
//
// Read-only: it never writes html_snapshot. An invoice with no stored snapshot
// is rendered live from the ledger row (see lib/holding/invoice-document.ts).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { loadInvoiceDocument, invoiceFilename } from '@/lib/holding/invoice-document';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    return new Response('invalid invoice id', { status: 400 });
  }

  const doc = await loadInvoiceDocument(getSupabaseAdmin(), id);
  if (!doc) return new Response('invoice not found', { status: 404 });
  if (!doc.html) {
    return new Response(`invoice could not be rendered: ${doc.renderError ?? 'unknown error'}`, { status: 500 });
  }

  const download = new URL(req.url).searchParams.get('download') === '1';
  return new Response(doc.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(download
        ? { 'Content-Disposition': `attachment; filename="${invoiceFilename(doc.row.invoice_number)}"` }
        : {}),
    },
  });
}
