// app/holding/finance/clients/_components/ClientsTable.tsx
// PBS 2026-07-09: Sortable Clients table with inline edit.

'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';

export interface ClientRow {
  id: number;
  name: string;
  legal_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  country: string | null;
  currency: string;
  category: string | null;
  tags: string[] | null;
  notes: string | null;
  active: boolean;
  invoices_count: number | null;
  total_billed: string | number | null;
  last_invoice_at: string | null;
  updated_at: string;
}

const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const PAPER = '#FFFFFF';
const PAPER_SOFT = '#FAFAF7';
const PRIMARY = '#084838';
const RED = '#B04A2F';

type SortKey = 'name' | 'category' | 'country' | 'invoices_count' | 'total_billed' | 'updated_at';

export default function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      const an = typeof av === 'number' ? av : Number(av);
      const bn = typeof bv === 'number' ? bv : Number(bv);
      let cmp: number;
      if (!Number.isNaN(an) && !Number.isNaN(bn)) cmp = an - bn;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, dir]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setDir(k === 'updated_at' ? 'desc' : 'asc'); }
  };

  const save = () => {
    if (!editing) return;
    startTransition(async () => {
      try {
        const r = await fetch('/api/holding/clients/upsert', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editing.id, name: editing.name.trim(), legal_name: editing.legal_name,
            contact_person: editing.contact_person, email: editing.email, phone: editing.phone,
            address: editing.address, tax_id: editing.tax_id, country: editing.country,
            currency: editing.currency, category: editing.category, notes: editing.notes,
            tags: editing.tags,
          }),
        });
        if (!r.ok) throw new Error(`save failed (${r.status})`);
        setMsg(`✓ Saved ${editing.name}`);
        setEditing(null);
        setTimeout(() => window.location.reload(), 500);
      } catch (e) { setMsg(`✗ ${(e as Error).message}`); }
    });
  };

  const remove = (id: number, name: string) => {
    if (!confirm(`Deactivate client "${name}"? (Soft delete — invoices stay linked.)`)) return;
    startTransition(async () => {
      try {
        const r = await fetch('/api/holding/clients/delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
        });
        if (!r.ok) throw new Error(`delete failed (${r.status})`);
        setTimeout(() => window.location.reload(), 200);
      } catch (e) { setMsg(`✗ ${(e as Error).message}`); }
    });
  };

  const money = (v: string | number | null, ccy = 'EUR') => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n === 0) return '—';
    return `${ccy === 'EUR' ? '€' : (ccy === 'USD' ? '$' : ccy + ' ')}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (rows.length === 0) return <div style={{ padding: 20, fontSize: 12, color: INK_SOFT, fontStyle: 'italic' }}>No clients yet. Add one above.</div>;

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: PAPER_SOFT }}>
              {([['name','Name','left'],['category','Category','left'],['country','Country','left'],['invoices_count','Invoices','right'],['total_billed','Total billed','right'],['updated_at','Updated','right']] as Array<[SortKey,string,'left'|'right']>).map(([k, label, align]) => (
                <th key={k} onClick={() => toggle(k)} style={{ ...th, textAlign: align, cursor: 'pointer' }}>
                  {label}{sortKey === k ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th style={{ ...th, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  <button type="button" onClick={() => setEditing(r)} style={{ background: 'none', border: 'none', color: PRIMARY, cursor: 'pointer', fontWeight: 700, padding: 0, textDecoration: 'underline', fontSize: 12 }}>{r.name}</button>
                  {r.contact_person && <div style={{ fontSize: 10, color: INK_SOFT }}>{r.contact_person}</div>}
                  {r.email && <div style={{ fontSize: 10, color: INK_SOFT }}>{r.email}</div>}
                </td>
                <td style={td}>{r.category ?? '—'}</td>
                <td style={td}>{r.country ?? '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.invoices_count ?? 0}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(r.total_billed, r.currency)}</td>
                <td style={{ ...td, textAlign: 'right', color: INK_SOFT, fontSize: 10 }}>{new Date(r.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                <td style={td}>
                  <button type="button" onClick={() => remove(r.id, r.name)} aria-label="deactivate" title="Deactivate client" style={{ background: 'transparent', border: 'none', color: RED, cursor: 'pointer', fontSize: 14 }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PAPER, borderRadius: 8, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 12 }}>Edit client — {editing.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <F label="Display name *"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={inputStyle} /></F>
              <F label="Legal name"><input value={editing.legal_name ?? ''} onChange={(e) => setEditing({ ...editing, legal_name: e.target.value })} style={inputStyle} /></F>
              <F label="Contact person"><input value={editing.contact_person ?? ''} onChange={(e) => setEditing({ ...editing, contact_person: e.target.value })} style={inputStyle} /></F>
              <F label="Email"><input value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} style={inputStyle} /></F>
              <F label="Phone"><input value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} style={inputStyle} /></F>
              <F label="Tax ID / VAT"><input value={editing.tax_id ?? ''} onChange={(e) => setEditing({ ...editing, tax_id: e.target.value })} style={inputStyle} /></F>
              <F label="Country"><input value={editing.country ?? ''} onChange={(e) => setEditing({ ...editing, country: e.target.value })} style={inputStyle} /></F>
              <F label="Currency">
                <select value={editing.currency ?? 'EUR'} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} style={inputStyle}>
                  <option value="EUR">EUR</option><option value="USD">USD</option><option value="AED">AED</option><option value="LAK">LAK</option>
                </select>
              </F>
              <F label="Category">
                <select value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  <option value="DMC">DMC</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Partner">Partner</option>
                  <option value="Supplier">Supplier</option>
                  <option value="Other">Other</option>
                </select>
              </F>
              <F label="Tags (comma sep)"><input value={(editing.tags ?? []).join(', ')} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} style={inputStyle} placeholder="retreat, monthly, priority" /></F>
              <div style={{ gridColumn: '1 / -1' }}>
                <F label="Address"><textarea value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} /></F>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <F label="Notes"><textarea value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} style={{ ...inputStyle, minHeight: 80 }} /></F>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditing(null)} style={secondaryBtn}>Cancel</button>
              <button type="button" onClick={save} disabled={pending} style={primaryBtn}>{pending ? 'Saving…' : 'Save'}</button>
            </div>
            {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.startsWith('✓') ? '#1F5C2C' : RED }}>{msg}</div>}
          </div>
        </div>
      )}
      {msg && !editing && <div style={{ marginTop: 8, fontSize: 12, color: msg.startsWith('✓') ? '#1F5C2C' : RED }}>{msg}</div>}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label style={labelStyle}>{label}</label>{children}</div>);
}

const th: CSSProperties = { padding: '8px 10px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_SOFT, fontWeight: 700, borderBottom: `1px solid ${HAIRLINE}`, userSelect: 'none' };
const td: CSSProperties = { padding: '8px 10px', borderBottom: `1px solid #F1EBD9`, color: INK };
const labelStyle: CSSProperties = { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, fontWeight: 700, display: 'block', marginBottom: 4 };
const inputStyle: CSSProperties = { padding: '5px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 4, fontSize: 12, background: PAPER, color: INK, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const primaryBtn: CSSProperties = { padding: '7px 14px', border: `1px solid ${PRIMARY}`, background: PRIMARY, color: PAPER, borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const secondaryBtn: CSSProperties = { padding: '5px 10px', border: `1px solid ${HAIRLINE}`, background: PAPER, color: INK, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' };
