'use client';

// components/pl/FnbRawTransactions.tsx
// PBS 2026-06-09 #177 — B&W rebuild + guest_name + room_name + Laos local time (UTC+7).
// Searchable raw F&B transactions from Cloudbeds folio (v_fnb_raw_txn_enriched).

import { useMemo, useState, type CSSProperties } from 'react';
import type { FnbRawTxn } from '@/lib/data';

interface Props {
  data: FnbRawTxn[];
  pageSize?: number;
}

const INK = '#000';
const INK_MUTED = '#5A5A5A';
const HAIRLINE = '#E0E0E0';
const HAIRLINE_SOFT = '#F0F0F0';
const HOVER = '#FAFAFA';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export default function FnbRawTransactions({ data, pageSize = 50 }: Props) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((t) =>
      (t.description ?? '').toLowerCase().includes(q) ||
      (t.guest_name ?? '').toLowerCase().includes(q) ||
      (t.room_name ?? '').toLowerCase().includes(q) ||
      (t.item_category_name ?? '').toLowerCase().includes(q) ||
      (t.transaction_id ?? '').toLowerCase().includes(q) ||
      (t.user_name ?? '').toLowerCase().includes(q),
    );
  }, [data, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const totalAmount = filtered.reduce((s, t) => s + (t.amount ?? 0), 0);

  if (data.length === 0) {
    return (
      <div style={{ padding: 24, color: INK_MUTED, fontStyle: 'italic', textAlign: 'center', fontSize: 12 }}>
        No F&amp;B transactions in window.
      </div>
    );
  }

  const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
  const th: CSSProperties = {
    textAlign: 'right', padding: '8px 10px', borderBottom: `1px solid ${INK}`,
    fontFamily: MONO, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase',
    color: INK_MUTED, fontWeight: 500, whiteSpace: 'nowrap',
  };
  const thL: CSSProperties = { ...th, textAlign: 'left' };
  const td: CSSProperties = {
    padding: '8px 10px', borderBottom: `1px solid ${HAIRLINE_SOFT}`, textAlign: 'right',
    fontFamily: MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: INK, whiteSpace: 'nowrap',
  };
  const tdL: CSSProperties = { ...td, textAlign: 'left', fontFamily: 'inherit' };

  return (
    <div style={{ background: '#FFFFFF' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search guest, room, item, description…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          style={{
            flex: '1 1 240px', padding: '8px 12px',
            border: `1px solid ${HAIRLINE}`, borderRadius: 4,
            fontFamily: MONO, fontSize: 12, color: INK, outline: 'none', background: '#FFF',
          }}
        />
        <span style={{ fontSize: 11, color: INK_MUTED, fontFamily: MONO, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {filtered.length} txn · {fmtUsd(totalAmount)} · times in Laos (UTC+7)
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thL}>Local time (Laos)</th>
              <th style={thL}>Guest</th>
              <th style={thL}>Room</th>
              <th style={thL}>Item</th>
              <th style={thL}>Category</th>
              <th style={th}>Amount</th>
              <th style={thL}>Source</th>
              <th style={thL}>Staff</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, color: INK_MUTED, fontStyle: 'italic', textAlign: 'center', fontSize: 12 }}>No matches.</td></tr>
            ) : visible.map((t) => (
              <tr key={t.transaction_id}
                  style={{ transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...td, textAlign: 'left' }}>{t.local_laos_str ?? '—'}</td>
                <td style={tdL}>{t.guest_name ?? '—'}</td>
                <td style={tdL}>{t.room_name ?? '—'}</td>
                <td style={{ ...tdL, fontWeight: 600 }}>{t.description}</td>
                <td style={{ ...tdL, color: INK_MUTED }}>{t.item_category_name ?? '—'}</td>
                <td style={{ ...td, fontWeight: 600 }}>{fmtUsd(t.amount)}</td>
                <td style={{ ...tdL, color: INK_MUTED }}>{t.source_name ?? '—'}</td>
                <td style={{ ...tdL, color: INK_MUTED }}>{t.user_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '0 4px' }}>
          <span style={{ fontSize: 11, color: INK_MUTED, fontFamily: MONO, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Page {safePage + 1} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}
              style={{
                background: 'transparent', border: `1px solid ${HAIRLINE}`, padding: '6px 12px',
                cursor: safePage === 0 ? 'not-allowed' : 'pointer',
                fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
                color: safePage === 0 ? INK_MUTED : INK, borderRadius: 4,
              }}>◂ Prev</button>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}
              style={{
                background: 'transparent', border: `1px solid ${HAIRLINE}`, padding: '6px 12px',
                cursor: safePage === totalPages - 1 ? 'not-allowed' : 'pointer',
                fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
                color: safePage === totalPages - 1 ? INK_MUTED : INK, borderRadius: 4,
              }}>Next ▸</button>
          </div>
        </div>
      )}
    </div>
  );
}
