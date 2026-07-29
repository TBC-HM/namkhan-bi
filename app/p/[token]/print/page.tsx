// app/p/[token]/print/page.tsx
// Proposals brief A5/D4 (2026-07-29) — print-optimized proposal view.
// Zero-dependency PDF path: clean print CSS over the same public bundle
// (fn_public_proposal_bundle) + a "Download PDF" button that calls
// window.print() — browser print-to-PDF is the delivery mechanism.
// Server component; the one interactive element is wired via an inline script.

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FX_FALLBACK = 21800;

interface Bundle {
  expired: boolean;
  proposal: {
    id: string;
    status: string;
    guest_name: string | null;
    date_in: string | null;
    date_out: string | null;
    total_lak: number | null;
    fx_lak_per_usd: number | null;
    expires_at?: string | null;
  };
  blocks: Array<{
    id: string;
    block_type: string;
    label: string;
    note: string | null;
    qty: number;
    nights: number;
    unit_price_lak: number;
    total_lak: number;
    sort_order: number;
    additional_discount_pct: number | null;
  }>;
  rate_offers: Array<{
    id: string;
    label: string | null;
    payment_terms: string | null;
    cancellation_terms: string | null;
    unit_price_lak: number | null;
    total_lak: number | null;
    position: number;
  }>;
}

function lak(n: number | null | undefined): string {
  return n != null ? '₭ ' + Math.round(Number(n)).toLocaleString('en-US') : '—';
}
function usd(nLak: number | null | undefined, fx: number): string {
  return nLak != null ? '$ ' + Math.round(Number(nLak) / (fx || FX_FALLBACK)).toLocaleString('en-US') : '—';
}

export default async function ProposalPrintPage({ params }: { params: { token: string } }) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_public_proposal_bundle', { p_token: params.token });
  if (error || !data) return notFound();
  const bundle = data as Bundle;
  if (bundle.expired) return notFound();

  const p = bundle.proposal;
  const fx = Number(p.fx_lak_per_usd ?? FX_FALLBACK);
  const blocks = [...(bundle.blocks ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const offers = [...(bundle.rate_offers ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const totalLak = blocks.reduce((s, b) => {
    const disc = Number(b.additional_discount_pct ?? 0);
    const unitEff = Number(b.unit_price_lak ?? 0) * (1 - Math.max(0, Math.min(100, disc)) / 100);
    return s + Number(b.qty ?? 1) * Number(b.nights ?? 1) * unitEff;
  }, 0);

  return (
    <div style={{ background: '#FFFFFF', color: '#1B1B1B', fontFamily: 'Georgia, "Times New Roman", serif', maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <style
        // Print CSS — hide the toolbar, force clean page breaks, exact colors.
        dangerouslySetInnerHTML={{ __html: `
          @media print {
            .no-print { display: none !important; }
            body { background: #fff !important; }
            @page { margin: 18mm; }
            table, tr { page-break-inside: avoid; }
          }
          .prp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .prp-table th { text-align: left; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #5A5A5A; border-bottom: 1px solid #1F3A2E; padding: 6px 8px; font-family: Helvetica, Arial, sans-serif; }
          .prp-table td { padding: 8px; border-bottom: 1px solid #E6DFCC; vertical-align: top; }
          .prp-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        ` }}
      />

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 20 }}>
        <a href={`/p/${params.token}`} style={{ padding: '8px 14px', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', border: '1px solid #E6DFCC', borderRadius: 4, color: '#5A5A5A', textDecoration: 'none' }}>← Back to proposal</a>
        <button id="prp-print-btn" style={{ padding: '8px 14px', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', border: '1px solid #1F3A2E', borderRadius: 4, color: '#FFFFFF', background: '#1F3A2E', cursor: 'pointer', fontWeight: 600 }}>
          Download PDF
        </button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `document.getElementById('prp-print-btn').addEventListener('click',function(){window.print();});` }} />

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#5A5A5A', fontFamily: 'Helvetica, Arial, sans-serif' }}>The Namkhan · Luang Prabang</div>
        <h1 style={{ fontSize: 26, fontWeight: 400, margin: '10px 0 4px' }}>Proposal for {p.guest_name ?? 'our guest'}</h1>
        <div style={{ fontSize: 13, color: '#5A5A5A' }}>
          {[p.date_in, p.date_out].filter(Boolean).join(' → ')}
          {p.expires_at ? ` · valid until ${new Date(p.expires_at).toLocaleDateString('en-GB')}` : ''}
        </div>
      </div>

      <table className="prp-table">
        <thead>
          <tr><th>Item</th><th className="prp-num">Qty</th><th className="prp-num">Nights</th><th className="prp-num">LAK</th><th className="prp-num">USD</th></tr>
        </thead>
        <tbody>
          {blocks.map((b) => {
            const disc = Number(b.additional_discount_pct ?? 0);
            const unitEff = Number(b.unit_price_lak ?? 0) * (1 - Math.max(0, Math.min(100, disc)) / 100);
            const rowTotal = Number(b.qty ?? 1) * Number(b.nights ?? 1) * unitEff;
            return (
              <tr key={b.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{b.label}</div>
                  {b.note ? <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 2 }}>{b.note}</div> : null}
                  {disc > 0 ? <div style={{ fontSize: 11, color: '#B8542A', marginTop: 2 }}>includes {disc}% discount</div> : null}
                </td>
                <td className="prp-num">{b.qty}</td>
                <td className="prp-num">{b.nights}</td>
                <td className="prp-num">{lak(rowTotal)}</td>
                <td className="prp-num">{usd(rowTotal, fx)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ fontWeight: 600, borderTop: '2px solid #1F3A2E' }}>Total</td>
            <td className="prp-num" style={{ fontWeight: 600, borderTop: '2px solid #1F3A2E' }}>{lak(totalLak)}</td>
            <td className="prp-num" style={{ fontWeight: 600, borderTop: '2px solid #1F3A2E' }}>{usd(totalLak, fx)}</td>
          </tr>
        </tfoot>
      </table>

      {offers.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Rate options</h2>
          <table className="prp-table">
            <thead>
              <tr><th>Option</th><th>Payment</th><th>Cancellation</th><th className="prp-num">Total LAK</th><th className="prp-num">USD</th></tr>
            </thead>
            <tbody>
              {offers.map((o, i) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600 }}>{o.label ?? `Option ${i + 1}`}</td>
                  <td style={{ fontSize: 12 }}>{o.payment_terms ?? '—'}</td>
                  <td style={{ fontSize: 12 }}>{o.cancellation_terms ?? '—'}</td>
                  <td className="prp-num">{lak(o.total_lak)}</td>
                  <td className="prp-num">{usd(o.total_lak, fx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 32, fontSize: 12, color: '#5A5A5A', textAlign: 'center' }}>
        USD figures are indicative, converted at ₭{Math.round(fx).toLocaleString('en-US')} per USD. Billing is in LAK.
        <br />The Namkhan · Ban Don Kang, Luang Prabang, Laos · book@thenamkhan.com
      </div>
    </div>
  );
}
