// app/holding/finance/invoices/[id]/preview/page.tsx
// PBS 2026-07-09: Preview a stored invoice by id — renders the html_snapshot in an iframe.
// Sent invoices ledger opens this in a new tab via the Preview link.
// 2026-07-09 fix: read from public.v_holding_invoices bridge (not sb.schema('holding'))
// — PostgREST exposes only public, so the schema-scoped read returned null → notFound() 404.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ id: string }>;

interface InvoiceRow {
  id: number;
  invoice_number: string;
  recipient_name: string;
  subject: string | null;
  total: string;
  currency: string;
  status: string;
  sent_at: string | null;
  html_snapshot: string | null;
}

export default async function InvoicePreviewPage({ params }: { params: Params }) {
  const p = await params;
  const id = Number(p.id);
  if (!Number.isFinite(id)) notFound();

  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_holding_invoices')
    .select('id, invoice_number, recipient_name, subject, total, currency, status, sent_at, html_snapshot')
    .eq('id', id).maybeSingle();
  const row = data as InvoiceRow | null;
  if (!row) notFound();

  const money = Number(row.total).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const sym = row.currency === 'EUR' ? '€' : (row.currency === 'USD' ? '$' : row.currency + ' ');

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
        {row.html_snapshot ? (
          <div style={{ border: '1px solid #E6DFCC', borderRadius: 8, overflow: 'hidden', background: '#F4F4EE' }}>
            <iframe title={`Invoice ${row.invoice_number}`} srcDoc={row.html_snapshot} style={{ width: '100%', minHeight: '80vh', border: 'none', background: '#FFFFFF' }} />
          </div>
        ) : (
          <div style={{ padding: 20, background: '#FFFAF7', border: '1px solid #E6C9BF', borderRadius: 6, fontSize: 12, color: '#B04A2F' }}>
            No stored html_snapshot for this invoice. It was likely created as a draft only.
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
