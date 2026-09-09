// app/holding/finance/invoices/[id]/preview/page.tsx
// PBS 2026-07-09: Preview a stored invoice by id.
// 2026-07-09 fix: read from public.v_holding_invoices bridge (not sb.schema('holding'))
// — PostgREST exposes only public, so the schema-scoped read returned null → notFound() 404.
//
// PBS 2026-09-09 fix 1: the page used to render ONLY html_snapshot, which is written
// in exactly one place (create-and-send → fn_holding_invoice_mark_sent). 23 of 24
// invoices were bulk-loaded by the P&L reconstruction and had none, so the page
// dead-ended on all of them. Document resolution now lives in
// lib/holding/invoice-document.ts and falls back to a live render.
//
// PBS 2026-09-09 fix 2: Download + Send email.
//   · Download hits /api/holding/invoices/[id]/document?download=1 — the same
//     document, as a file. It carries @page{size:A4}, so Print → Save as PDF in
//     the browser gives a correct A4 invoice. No PDF library is installed.
//   · Send reuses the existing send-report-email edge function (the emailer
//     create-and-send already uses). Nothing new was built for email.
//
// Sending is an external action (L28), so it is behind an explicit confirm and
// only appears when the invoice actually has a recipient email.

import { revalidatePath } from 'next/cache';
import { redirect, notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { loadInvoiceDocument } from '@/lib/holding/invoice-document';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ id: string }>;
type Search = Promise<{ sent?: string; msg?: string }>;

const FOREST = '#084838';
const HAIR = '#E6DFCC';
const INK_M = '#5A5A5A';
const RUST = '#B04A2F';

async function sendInvoiceAction(formData: FormData): Promise<void> {
  'use server';
  const id = Number(formData.get('id'));
  const back = `/holding/finance/invoices/${id}/preview`;
  if (!Number.isFinite(id)) redirect(`${back}?sent=err&msg=${encodeURIComponent('invalid id')}`);
  if (formData.get('confirm') !== 'yes') {
    redirect(`${back}?sent=err&msg=${encodeURIComponent('Tick the confirm box before sending.')}`);
  }

  let outcome = 'ok';
  let message = '';
  try {
    const sb = getSupabaseAdmin();
    const doc = await loadInvoiceDocument(sb, id);
    if (!doc || !doc.html) throw new Error('invoice could not be rendered — nothing was sent');
    const to = doc.row.recipient_email;
    if (!to) throw new Error('this invoice has no recipient email');

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set on this deployment');

    // Existing emailer — same edge function create-and-send uses.
    const res = await fetch(`${base}/functions/v1/send-report-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject: `Invoice ${doc.row.invoice_number}${doc.row.subject ? ` · ${doc.row.subject}` : ''}`,
        html: doc.html,
        from_label: 'The Beyond Circle',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`emailer HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ''}`);
    }

    // It has now genuinely been issued, so this render BECOMES the issued record.
    await sb.rpc('fn_holding_invoice_mark_sent', { p_id: id, p_html: doc.html });
    message = `sent to ${to}`;
  } catch (e) {
    outcome = 'err';
    message = e instanceof Error ? e.message : String(e);
  }

  revalidatePath(back);
  redirect(`${back}?sent=${outcome}&msg=${encodeURIComponent(message)}`);
}

export default async function InvoicePreviewPage(
  { params, searchParams }: { params: Params; searchParams?: Search },
) {
  const p = await params;
  const sp = (await searchParams) ?? {};
  const id = Number(p.id);
  if (!Number.isFinite(id)) notFound();

  const doc = await loadInvoiceDocument(getSupabaseAdmin(), id);
  if (!doc) notFound();
  const row = doc.row;

  const money = Number(row.total).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const sym = row.currency === 'EUR' ? '€' : (row.currency === 'USD' ? '$' : row.currency + ' ');
  const wasIssued = row.status === 'sent' || row.status === 'paid';
  const docHref = `/api/holding/invoices/${id}/document`;

  const btn: React.CSSProperties = {
    display: 'inline-block', padding: '6px 12px', fontSize: 12, fontWeight: 600,
    borderRadius: 4, textDecoration: 'none', cursor: 'pointer',
    fontFamily: 'inherit', border: `1px solid ${FOREST}`,
  };

  return (
    <div style={{ padding: 20, background: '#FFFFFF', color: '#1B1B1B', fontFamily: '-apple-system, Helvetica, Arial, sans-serif', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ borderBottom: `1px solid ${HAIR}`, paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_M }}>Invoice preview</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: FOREST, letterSpacing: '-0.01em' }}>{row.invoice_number}</div>
            <div style={{ fontSize: 12, color: INK_M }}>To: <strong style={{ color: '#1B1B1B' }}>{row.recipient_name}</strong>{row.subject ? ` · ${row.subject}` : ''}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: INK_M }}>
            <div>Total: <strong style={{ color: '#1B1B1B' }}>{sym}{money}</strong></div>
            <div>Status: <StatusPill status={row.status} /></div>
            {row.sent_at && <div>Sent: {new Date(row.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
          </div>
        </div>

        {sp.sent && (
          <div style={{
            padding: '10px 14px', marginBottom: 12, borderRadius: 6, fontSize: 12,
            border: `1px solid ${sp.sent === 'ok' ? '#B7D3BD' : '#E6C9BF'}`,
            borderLeft: `3px solid ${sp.sent === 'ok' ? '#1F5C2C' : RUST}`,
            background: sp.sent === 'ok' ? '#F2F8F3' : '#FFFAF7',
            color: sp.sent === 'ok' ? '#1F5C2C' : RUST,
          }}>
            <strong>{sp.sent === 'ok' ? 'Sent.' : 'Not sent.'}</strong>{sp.msg ? ` ${sp.msg}` : ''}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
          <a href={`${docHref}?download=1`} style={{ ...btn, background: FOREST, color: '#fff' }}>Download</a>
          <a href={docHref} target="_blank" rel="noreferrer" style={{ ...btn, background: '#fff', color: FOREST }}>
            Open / Print to PDF
          </a>

          {row.recipient_email ? (
            <form action={sendInvoiceAction} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
              <input type="hidden" name="id" value={id} />
              <label style={{ fontSize: 11, color: INK_M, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                <input type="checkbox" name="confirm" value="yes" />
                Confirm send to <strong style={{ color: '#1B1B1B' }}>{row.recipient_email}</strong>
              </label>
              <button type="submit" style={{ ...btn, background: '#fff', color: FOREST }}>
                {wasIssued ? 'Re-send email' : 'Send email'}
              </button>
            </form>
          ) : (
            <div style={{ marginLeft: 'auto', fontSize: 11, color: INK_M, alignSelf: 'center' }}>
              No recipient email on this invoice — nothing to send to.
            </div>
          )}
        </div>

        {doc.live && (
          <div style={{ padding: '10px 14px', marginBottom: 12, background: '#FFFAF7', border: '1px solid #E6C9BF', borderLeft: `3px solid ${RUST}`, borderRadius: 6, fontSize: 12, color: RUST, lineHeight: 1.55 }}>
            <strong>Reconstructed view — not the document that was issued.</strong>{' '}
            {wasIssued
              ? `This invoice is marked ${row.status}, but no copy of what the client actually received is stored against it. What follows is rendered live from the current ledger record and may differ from the original.`
              : 'This invoice has not been sent, so no issued document exists yet. What follows is rendered live from the current ledger record.'}
          </div>
        )}

        {doc.html ? (
          <div style={{ border: `1px solid ${HAIR}`, borderRadius: 8, overflow: 'hidden', background: '#F4F4EE' }}>
            <iframe title={`Invoice ${row.invoice_number}`} srcDoc={doc.html} style={{ width: '100%', minHeight: '80vh', border: 'none', background: '#FFFFFF' }} />
          </div>
        ) : (
          <div style={{ padding: 20, background: '#FFFAF7', border: '1px solid #E6C9BF', borderRadius: 6, fontSize: 12, color: RUST }}>
            This invoice could not be rendered{doc.renderError ? `: ${doc.renderError}` : '.'}
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 11, color: INK_M }}>
          <a href="/holding/finance/invoices" style={{ color: FOREST }}>← back to Invoices</a>
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
