// app/holding/finance/invoices/_components/InvoiceGenerator.tsx
// PBS 2026-07-08 v2: recipient profile picker + recurring cadence option.
// Recipients saved to holding.invoice_recipients (unique on name) so re-invoicing
// the same DMC/partner takes 2 clicks. Recurring stamps holding.invoices.recurring_cadence
// + recurring_next_at so a cron can pick up and re-issue.

'use client';

import { useEffect, useState, useTransition, type CSSProperties } from 'react';

interface LineItem { description: string; qty: number; unit_price: number }
interface Recipient {
  id: number; name: string; email: string | null; address: string | null;
  tax_id: string | null; currency: string; notes: string | null; last_used_at: string | null;
}

const PRIMARY = '#084838';
const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const PAPER = '#FFFFFF';
const PAPER_SOFT = '#FAFAF7';

const emptyLine: LineItem = { description: '', qty: 1, unit_price: 0 };

export default function InvoiceGenerator({ initialNextNumber }: { initialNextNumber: string }) {
  const [recipientName, setRecipientName]       = useState('');
  const [recipientEmail, setRecipientEmail]     = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [taxId, setTaxId]                       = useState('');
  const [subject, setSubject]                   = useState('');
  const [notes, setNotes]                       = useState('');
  const [taxPct, setTaxPct]                     = useState(0);
  const [currency, setCurrency]                 = useState('EUR');
  const [dueAt, setDueAt]                       = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ ...emptyLine }]);
  const [showPreview, setShowPreview] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [nextNumber] = useState<string>(initialNextNumber);

  // Recipient profiles
  const [profiles, setProfiles] = useState<Recipient[]>([]);
  const [pickedProfileId, setPickedProfileId] = useState<string>('');
  const [saveProfile, setSaveProfile] = useState<boolean>(true);

  // Recurring
  const [recurringOn, setRecurringOn] = useState<boolean>(false);
  const [recurringCadence, setRecurringCadence] = useState<'monthly'|'quarterly'|'yearly'>('monthly');

  useEffect(() => {
    fetch('/api/holding/invoices/recipients')
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => setProfiles((d.rows as Recipient[]) ?? []))
      .catch(() => {});
  }, []);

  const applyProfile = (id: string) => {
    setPickedProfileId(id);
    if (!id) return;
    const p = profiles.find((x) => String(x.id) === id);
    if (!p) return;
    setRecipientName(p.name);
    setRecipientEmail(p.email ?? '');
    setRecipientAddress(p.address ?? '');
    setTaxId(p.tax_id ?? '');
    setCurrency(p.currency || 'EUR');
    if (p.notes) setNotes(p.notes);
  };

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const taxAmount = subtotal * (Number(taxPct) || 0) / 100;
  const total = subtotal + taxAmount;
  const money = (n: number) => `${currency === 'EUR' ? '€' : (currency === 'USD' ? '$' : currency + ' ')}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const updateLine = (i: number, patch: Partial<LineItem>) => setLines((arr) => arr.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine    = () => setLines((arr) => [...arr, { ...emptyLine }]);
  const removeLine = (i: number) => setLines((arr) => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);
  const canPreview = recipientName.trim().length > 0 && lines.some((l) => l.description.trim() && Number(l.qty) > 0 && Number(l.unit_price) > 0);

  const buildHtml = (invoiceNumber: string): string => {
    const rows = lines.filter((l) => l.description.trim()).map((l) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;color:${INK}">${escapeHtml(l.description)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${Number(l.qty).toLocaleString('en-US')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(Number(l.unit_price))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-size:12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${money(Number(l.qty) * Number(l.unit_price))}</td>
      </tr>`).join('');
    return `<!doctype html><html><body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,'SF Pro Text',Helvetica,Arial,sans-serif;color:${INK}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:${PAPER}">
        <tr><td style="padding:28px 32px 14px 32px;border-bottom:1px solid ${HAIRLINE}">
          <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:4px">Invoice</div>
          <div style="font-size:22px;font-weight:700;color:${PRIMARY};letter-spacing:-0.01em">The Beyond Circle</div>
          <div style="font-size:12px;color:${INK_SOFT};margin-top:2px">Invoice no.: <strong style="color:${INK}">${invoiceNumber}</strong> · Issued: <strong style="color:${INK}">${new Date().toISOString().slice(0,10)}</strong>${dueAt ? ` · Due: <strong style="color:${INK}">${dueAt}</strong>` : ''}${recurringOn ? ` · <strong style="color:${PRIMARY}">Recurring: ${recurringCadence}</strong>` : ''}</div>
        </td></tr>
        <tr><td style="padding:22px 32px 6px 32px">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:6px">Billed to</div>
          <div style="font-size:14px;font-weight:600;color:${INK}">${escapeHtml(recipientName)}</div>
          ${recipientEmail ? `<div style="font-size:12px;color:${INK_SOFT}">${escapeHtml(recipientEmail)}</div>` : ''}
          ${recipientAddress ? `<div style="font-size:12px;color:${INK_SOFT};white-space:pre-wrap">${escapeHtml(recipientAddress)}</div>` : ''}
          ${taxId ? `<div style="font-size:12px;color:${INK_SOFT}">Tax ID: ${escapeHtml(taxId)}</div>` : ''}
          ${subject ? `<div style="margin-top:10px;font-size:13px;color:${INK}"><strong>Subject:</strong> ${escapeHtml(subject)}</div>` : ''}
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
              ${taxPct > 0 ? `<tr><td style="padding:4px 10px;font-size:12px;color:${INK_SOFT}">Tax (${taxPct}%)</td><td style="padding:4px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${money(taxAmount)}</td></tr>` : ''}
              <tr><td style="padding:8px 10px;font-size:14px;font-weight:700;color:${INK};border-top:1px solid ${HAIRLINE}">Total</td><td style="padding:8px 10px;font-size:14px;text-align:right;font-weight:700;color:${PRIMARY};border-top:1px solid ${HAIRLINE};font-variant-numeric:tabular-nums">${money(total)}</td></tr>
            </table>
          </td></tr></table>
        </td></tr>
        ${notes ? `<tr><td style="padding:14px 32px;font-size:11px;color:${INK_SOFT};white-space:pre-wrap;border-top:1px solid ${HAIRLINE}"><strong style="color:${INK}">Notes:</strong> ${escapeHtml(notes)}</td></tr>` : ''}
        <tr><td style="padding:20px 32px 24px 32px;border-top:1px solid ${HAIRLINE};font-size:11px;color:${INK_SOFT}">The Beyond Circle · Holding · issued via Namkhan BI cockpit.</td></tr>
      </table>
    </body></html>`;
  };

  const submit = () => {
    if (!canPreview) return;
    startTransition(async () => {
      try {
        const r = await fetch('/api/holding/invoices/create-and-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_name: recipientName.trim(),
            recipient_email: recipientEmail.trim() || null,
            recipient_address: recipientAddress.trim() || null,
            tax_id: taxId.trim() || null,
            subject: subject.trim() || null,
            line_items: lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description.trim(), qty: Number(l.qty), unit_price: Number(l.unit_price) })),
            tax_pct: Number(taxPct) || 0,
            currency,
            notes: notes.trim() || null,
            due_at: dueAt || null,
            save_profile: saveProfile,
            recurring_cadence: recurringOn ? recurringCadence : null,
            send: !!recipientEmail.trim(),
          }),
        });
        if (!r.ok) throw new Error(`create failed (${r.status})`);
        const { invoice_number, warning } = await r.json();
        setMsg(`✓ Invoice ${invoice_number} created${recipientEmail.trim() ? ' and sent' : ' (draft)'}${warning ? ` — ${warning}` : ''}.`);
        setTimeout(() => window.location.reload(), 1500);
      } catch (e) { setMsg(`✗ ${(e as Error).message}`); }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {profiles.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: PAPER_SOFT, border: `1px dashed ${HAIRLINE}`, borderRadius: 6 }}>
          <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>Load saved recipient</label>
          <select value={pickedProfileId} onChange={(e) => applyProfile(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">— pick a recipient —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.email ? ` · ${p.email}` : ''}{p.last_used_at ? ` · used ${new Date(p.last_used_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ''}
              </option>
            ))}
          </select>
          {pickedProfileId && (
            <button type="button" onClick={() => { setPickedProfileId(''); }} style={secondaryBtn}>Clear</button>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>To (recipient name) *</label>
          <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} style={inputStyle} placeholder="Company or person" />
          <label style={labelStyle}>Recipient email</label>
          <input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} style={inputStyle} placeholder="billing@example.com" />
          <label style={labelStyle}>Recipient address</label>
          <textarea value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} style={{ ...inputStyle, minHeight: 60 }} placeholder="Street · city · country" />
          <label style={labelStyle}>Tax ID / VAT</label>
          <input value={taxId} onChange={(e) => setTaxId(e.target.value)} style={inputStyle} placeholder="ESB12345678" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: INK_SOFT, marginTop: 4 }}>
            <input type="checkbox" checked={saveProfile} onChange={(e) => setSaveProfile(e.target.checked)} />
            Save this recipient to profiles (re-usable for future invoices)
          </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} placeholder="e.g. Consulting · June 2026" />
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
                <option value="EUR">EUR</option><option value="USD">USD</option><option value="LAK">LAK</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Tax %</label>
              <input type="number" min={0} step={0.5} value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value))} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Due date</label>
              <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <label style={labelStyle}>Notes / footer</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 60 }} placeholder="Payment terms · IBAN · anything else" />
          <div style={{ padding: '8px 10px', background: recurringOn ? '#E7F1E9' : PAPER_SOFT, border: `1px solid ${recurringOn ? PRIMARY : HAIRLINE}`, borderRadius: 6, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: recurringOn ? PRIMARY : INK, fontWeight: 600 }}>
              <input type="checkbox" checked={recurringOn} onChange={(e) => setRecurringOn(e.target.checked)} />
              Recurring invoice
            </label>
            {recurringOn && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: INK_SOFT }}>Frequency:</span>
                <select value={recurringCadence} onChange={(e) => setRecurringCadence(e.target.value as 'monthly'|'quarterly'|'yearly')} style={{ ...inputStyle, minWidth: 120 }}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <span style={{ fontSize: 11, color: INK_SOFT }}>Next issue will fire on the same day-of-month.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, marginBottom: 6 }}>What (line items)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${HAIRLINE}` }}>
          <thead>
            <tr style={{ background: PAPER_SOFT }}>
              <th style={th}>Description</th>
              <th style={{ ...th, width: 80, textAlign: 'right' }}>Qty</th>
              <th style={{ ...th, width: 120, textAlign: 'right' }}>Unit price</th>
              <th style={{ ...th, width: 120, textAlign: 'right' }}>Amount</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td style={td}><input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} style={{ ...inputStyle, width: '100%' }} placeholder="Description" /></td>
                <td style={td}><input type="number" min={0} step={1} value={l.qty} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} style={{ ...inputStyle, width: '100%', textAlign: 'right' }} /></td>
                <td style={td}><input type="number" min={0} step={0.01} value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} style={{ ...inputStyle, width: '100%', textAlign: 'right' }} /></td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{money((Number(l.qty) || 0) * (Number(l.unit_price) || 0))}</td>
                <td style={td}><button type="button" onClick={() => removeLine(i)} style={{ background: 'transparent', border: 'none', color: INK_SOFT, cursor: 'pointer', fontSize: 14 }} aria-label="remove line">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addLine} style={{ ...secondaryBtn, marginTop: 6 }}>+ Add line</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: PAPER_SOFT, border: `1px solid ${HAIRLINE}`, borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: INK_SOFT }}>Next invoice number: <strong style={{ color: INK }}>{nextNumber}</strong>{recurringOn ? ` · this + auto ${recurringCadence}` : ''}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>Total: {money(total)}</div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setShowPreview(true)} disabled={!canPreview} style={{ ...secondaryBtn, opacity: canPreview ? 1 : 0.5 }}>Preview</button>
        <button type="button" onClick={submit} disabled={!canPreview || pending} style={{ ...primaryBtn, opacity: (canPreview && !pending) ? 1 : 0.5 }}>
          {pending ? 'Working…' : (recipientEmail.trim() ? 'Create + Send' : 'Create draft')}
        </button>
      </div>

      {msg && <div style={{ fontSize: 12, color: msg.startsWith('✓') ? '#1F5C2C' : '#B04A2F' }}>{msg}</div>}

      {showPreview && (
        <div onClick={() => setShowPreview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PAPER, borderRadius: 8, maxWidth: 800, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Invoice preview · {nextNumber} (pending)</div>
              <button type="button" onClick={() => setShowPreview(false)} style={secondaryBtn}>Close</button>
            </div>
            <iframe title="invoice preview" srcDoc={buildHtml(nextNumber)} style={{ flex: 1, width: '100%', minHeight: 500, border: 'none', background: PAPER }} />
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const labelStyle: CSSProperties = { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, fontWeight: 700 };
const inputStyle: CSSProperties = { padding: '5px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 4, fontSize: 12, background: PAPER, color: INK, fontFamily: 'inherit' };
const th: CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, fontWeight: 700, borderBottom: `1px solid ${HAIRLINE}` };
const td: CSSProperties = { padding: '4px 6px', borderBottom: `1px solid ${HAIRLINE}` };
const primaryBtn: CSSProperties = { padding: '7px 14px', border: `1px solid ${PRIMARY}`, background: PRIMARY, color: PAPER, borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const secondaryBtn: CSSProperties = { padding: '5px 10px', border: `1px solid ${HAIRLINE}`, background: PAPER, color: INK, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
