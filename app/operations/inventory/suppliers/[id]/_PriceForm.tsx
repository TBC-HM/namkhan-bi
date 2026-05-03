'use client';

// app/operations/inventory/suppliers/[id]/_PriceForm.tsx
//
// Inline form to add a row to suppliers.price_history.
// POSTs to /api/operations/suppliers/price-history.
// On success: router.refresh() so the table above reloads with the new row.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  supplierId: string;
  supplierName: string;
}

const monoCss: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' };
const labelCss: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  marginBottom: 4,
};
const inputCss: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: 'var(--paper)',
  border: '1px solid var(--paper-deep)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-sm)',
  color: 'var(--ink)',
  fontVariantNumeric: 'tabular-nums',
};

const today = () => new Date().toISOString().slice(0, 10);

export default function PriceForm({ supplierId, supplierName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const [effectiveDate, setEffectiveDate] = useState(today());
  const [invSku, setInvSku] = useState('');
  const [usd, setUsd] = useState('');
  const [lak, setLak] = useState('');
  const [moq, setMoq] = useState('');
  const [source, setSource] = useState('quote');
  const [sourceRef, setSourceRef] = useState('');
  const [notes, setNotes] = useState('');

  function reset() {
    setEffectiveDate(today());
    setInvSku('');
    setUsd('');
    setLak('');
    setMoq('');
    setSource('quote');
    setSourceRef('');
    setNotes('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    if (!usd && !lak) {
      setMsg({ tone: 'err', text: 'At least one of unit_price_usd / unit_price_lak is required.' });
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch('/api/operations/suppliers/price-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          effective_date: effectiveDate,
          inv_sku: invSku.trim() || null,
          unit_price_usd: usd ? Number(usd) : null,
          unit_price_lak: lak ? Number(lak) : null,
          min_order_qty: moq ? Number(moq) : null,
          source: source || null,
          source_ref: sourceRef.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json: any = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.ok === false) {
        setMsg({ tone: 'err', text: json?.error ?? `HTTP ${resp.status}` });
      } else {
        setMsg({ tone: 'ok', text: 'Price recorded.' });
        reset();
        router.refresh();
      }
    } catch (e: any) {
      setMsg({ tone: 'err', text: e?.message ?? 'Network error' });
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={submit}
      style={{
        marginTop: 14,
        padding: 14,
        background: 'var(--paper-warm)',
        borderLeft: '4px solid var(--brass)',
      }}
    >
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
        marginBottom: 10,
      }}>
        Add price · {supplierName}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10,
      }}>
        <div>
          <label style={labelCss} htmlFor="pf-date">Effective date *</label>
          <input id="pf-date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)}
            required style={inputCss} />
        </div>
        <div>
          <label style={labelCss} htmlFor="pf-sku">Item SKU</label>
          <input id="pf-sku" type="text" value={invSku} onChange={(e) => setInvSku(e.target.value)}
            placeholder="e.g. FB-COFFEE-001" style={inputCss} />
        </div>
        <div>
          <label style={labelCss} htmlFor="pf-usd">Unit $ USD</label>
          <input id="pf-usd" type="number" step="0.01" min="0" value={usd} onChange={(e) => setUsd(e.target.value)}
            placeholder="12.50" style={inputCss} />
        </div>
        <div>
          <label style={labelCss} htmlFor="pf-lak">Unit ₭ LAK</label>
          <input id="pf-lak" type="number" step="100" min="0" value={lak} onChange={(e) => setLak(e.target.value)}
            placeholder="272500" style={inputCss} />
        </div>
        <div>
          <label style={labelCss} htmlFor="pf-moq">MOQ</label>
          <input id="pf-moq" type="number" step="1" min="0" value={moq} onChange={(e) => setMoq(e.target.value)}
            placeholder="10" style={inputCss} />
        </div>
        <div>
          <label style={labelCss} htmlFor="pf-src">Source</label>
          <select id="pf-src" value={source} onChange={(e) => setSource(e.target.value)}
            style={{ ...inputCss, padding: '4px 8px' }}>
            <option value="quote">quote</option>
            <option value="invoice">invoice</option>
            <option value="price_list">price_list</option>
            <option value="contract">contract</option>
            <option value="market_check">market_check</option>
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelCss} htmlFor="pf-ref">Reference (invoice #, quote ID, etc.)</label>
          <input id="pf-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)}
            placeholder="INV-2026-0142" style={inputCss} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelCss} htmlFor="pf-notes">Notes</label>
          <input id="pf-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputCss} />
        </div>
      </div>

      {msg && (
        <div style={{
          marginTop: 10,
          padding: '6px 10px',
          background: msg.tone === 'ok' ? 'var(--st-good-bg, #dcebe0)' : 'var(--st-bad-bg, #f5d4d0)',
          color: msg.tone === 'ok' ? 'var(--st-good-tx, #2f6f3a)' : 'var(--st-bad-tx, #8a3026)',
          fontSize: 'var(--t-xs)',
          ...monoCss,
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          style={{
            padding: '5px 14px',
            background: 'transparent',
            border: '1px solid var(--paper-deep)',
            color: 'var(--ink-soft)',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '5px 16px',
            background: 'var(--moss)',
            border: '1px solid var(--moss)',
            color: 'var(--paper-warm)',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Saving…' : 'Add price'}
        </button>
      </div>
    </form>
  );
}
