// app/holding/finance/invoices/template/_components/TemplateEditor.tsx
// PBS 2026-07-08: side-by-side form + live preview for the Beyond Circle invoice template.

'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';

interface TemplateInitial {
  brand_name: string;
  brand_color: string;
  header_line: string;
  footer_line: string;
  default_notes: string;
  default_currency: string;
  default_tax_pct: number;
}

const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const PAPER = '#FFFFFF';
const PAPER_SOFT = '#FAFAF7';
const PRIMARY = '#084838';

const defaults: TemplateInitial = {
  brand_name: 'The Beyond Circle',
  brand_color: '#084838',
  header_line: 'Invoice',
  footer_line: 'The Beyond Circle · Holding · issued via Namkhan BI cockpit.',
  default_notes: 'Payable within 15 days · IBAN ES12 1234 5678 9012 3456 7890',
  default_currency: 'EUR',
  default_tax_pct: 0,
};

function esc(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function previewHtml(t: TemplateInitial): string {
  const sample = [
    { description: 'Consulting · half-day', qty: 1, unit_price: 250 },
    { description: 'Travel expenses',       qty: 1, unit_price: 85 },
  ];
  const money = (n: number) => `${t.default_currency === 'EUR' ? '€' : (t.default_currency === 'USD' ? '$' : t.default_currency + ' ')}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const subtotal = sample.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const tax = subtotal * (t.default_tax_pct || 0) / 100;
  const total = subtotal + tax;
  const rows = sample.map((l) => `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;color:${INK}">${esc(l.description)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${l.qty.toLocaleString('en-US')}</td>
    <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(l.unit_price)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${money(l.qty * l.unit_price)}</td>
  </tr>`).join('');
  const brandColor = t.brand_color || PRIMARY;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,'SF Pro Text',Helvetica,Arial,sans-serif;color:${INK}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:${PAPER}">
      <tr><td style="padding:28px 32px 14px 32px;border-bottom:1px solid ${HAIRLINE}">
        <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:4px">${esc(t.header_line || 'Invoice')}</div>
        <div style="font-size:22px;font-weight:700;color:${brandColor};letter-spacing:-0.01em">${esc(t.brand_name)}</div>
        <div style="font-size:12px;color:${INK_SOFT};margin-top:2px">Invoice no.: <strong style="color:${INK}">BC-2026-XXXXX</strong> · Issued: <strong style="color:${INK}">${new Date().toISOString().slice(0,10)}</strong></div>
      </td></tr>
      <tr><td style="padding:22px 32px 6px 32px">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:6px">Billed to</div>
        <div style="font-size:14px;font-weight:600;color:${INK}">Sample DMC S.L.</div>
        <div style="font-size:12px;color:${INK_SOFT}">billing@example.com</div>
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
            <tr><td style="padding:4px 10px;font-size:12px;color:${INK_SOFT}">Subtotal</td><td style="padding:4px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(subtotal)}</td></tr>
            ${t.default_tax_pct > 0 ? `<tr><td style="padding:4px 10px;font-size:12px;color:${INK_SOFT}">Tax (${t.default_tax_pct}%)</td><td style="padding:4px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(tax)}</td></tr>` : ''}
            <tr><td style="padding:8px 10px;font-size:14px;font-weight:700;color:${INK};border-top:1px solid ${HAIRLINE}">Total</td><td style="padding:8px 10px;font-size:14px;text-align:right;font-weight:700;color:${brandColor};border-top:1px solid ${HAIRLINE};font-variant-numeric:tabular-nums">${money(total)}</td></tr>
          </table>
        </td></tr></table>
      </td></tr>
      ${t.default_notes ? `<tr><td style="padding:14px 32px;font-size:11px;color:${INK_SOFT};white-space:pre-wrap;border-top:1px solid ${HAIRLINE}"><strong style="color:${INK}">Notes:</strong> ${esc(t.default_notes)}</td></tr>` : ''}
      <tr><td style="padding:20px 32px 24px 32px;border-top:1px solid ${HAIRLINE};font-size:11px;color:${INK_SOFT}">${esc(t.footer_line)}</td></tr>
    </table></body></html>`;
}

export default function TemplateEditor({ initial }: { initial: TemplateInitial | null }) {
  const seed = initial ?? defaults;
  const [brandName, setBrandName]           = useState(seed.brand_name);
  const [brandColor, setBrandColor]         = useState(seed.brand_color);
  const [headerLine, setHeaderLine]         = useState(seed.header_line);
  const [footerLine, setFooterLine]         = useState(seed.footer_line);
  const [defaultNotes, setDefaultNotes]     = useState(seed.default_notes);
  const [defaultCurrency, setDefaultCurrency] = useState(seed.default_currency);
  const [defaultTaxPct, setDefaultTaxPct]   = useState(seed.default_tax_pct);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const current: TemplateInitial = { brand_name: brandName, brand_color: brandColor, header_line: headerLine, footer_line: footerLine, default_notes: defaultNotes, default_currency: defaultCurrency, default_tax_pct: defaultTaxPct };
  const previewSrc = useMemo(() => previewHtml(current), [brandName, brandColor, headerLine, footerLine, defaultNotes, defaultCurrency, defaultTaxPct]);

  const save = () => {
    startTransition(async () => {
      try {
        const r = await fetch('/api/holding/invoices/template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(current),
        });
        if (!r.ok) throw new Error(`save failed (${r.status})`);
        setMsg('✓ Template saved · applies to every new invoice.');
        setTimeout(() => setMsg(null), 3000);
      } catch (e) { setMsg(`✗ ${(e as Error).message}`); }
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.4fr)', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={labelStyle}>Brand name</label>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Brand colour (hex)</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ width: 40, height: 30, padding: 0, border: `1px solid ${HAIRLINE}`, borderRadius: 4 }} />
            <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Header eyebrow (word above brand)</label>
          <input value={headerLine} onChange={(e) => setHeaderLine(e.target.value)} style={inputStyle} placeholder="Invoice" />
        </div>
        <div>
          <label style={labelStyle}>Footer line</label>
          <input value={footerLine} onChange={(e) => setFooterLine(e.target.value)} style={inputStyle} placeholder="The Beyond Circle · Holding · …" />
        </div>
        <div>
          <label style={labelStyle}>Default notes (IBAN / payment terms)</label>
          <textarea value={defaultNotes} onChange={(e) => setDefaultNotes(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Default currency</label>
            <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} style={inputStyle}>
              <option value="EUR">EUR</option><option value="USD">USD</option><option value="LAK">LAK</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Default tax %</label>
            <input type="number" min={0} step={0.5} value={defaultTaxPct} onChange={(e) => setDefaultTaxPct(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={save} disabled={pending} style={primaryBtn}>{pending ? 'Saving…' : 'Save template'}</button>
        </div>
        {msg && <div style={{ fontSize: 12, color: msg.startsWith('✓') ? '#1F5C2C' : '#B04A2F' }}>{msg}</div>}
      </div>
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, marginBottom: 6 }}>Live preview</div>
        <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 8, overflow: 'hidden' }}>
          <iframe title="template preview" srcDoc={previewSrc} style={{ width: '100%', minHeight: 640, border: 'none', background: PAPER }} />
        </div>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, fontWeight: 700, display: 'block', marginBottom: 4 };
const inputStyle: CSSProperties = { padding: '5px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 4, fontSize: 12, background: PAPER, color: INK, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const primaryBtn: CSSProperties = { padding: '7px 14px', border: `1px solid ${PRIMARY}`, background: PRIMARY, color: PAPER, borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
