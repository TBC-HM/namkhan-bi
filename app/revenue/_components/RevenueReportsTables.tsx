// app/revenue/_components/RevenueReportsTables.tsx
// PBS 2026-07-08 final: sortable + bulk-delete tables for the Revenue HoD.
// - ScheduledReportsTable — one row per active recipient · dismiss cancels schedule.
// - SendLogTable — every send ever · bulk delete.
// Both tables: click column header to sort · leading checkbox column · "Delete selected" bar.

'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';

// ─── Shared table shell ─────────────────────────────────────────────

interface ColumnDef<Row> {
  key: keyof Row & string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: Row) => React.ReactNode;
  sortAccessor?: (row: Row) => number | string;
}

interface SortState { key: string; dir: 'asc' | 'desc' }

interface SortableTableProps<Row extends { id: number | string }> {
  rows: Row[];
  columns: ColumnDef<Row>[];
  defaultSort?: SortState;
  emptyLabel?: string;
  onBulkDelete: (ids: (number | string)[]) => Promise<void>;
  bulkVerb?: string;
}

export function SortableTable<Row extends { id: number | string }>({
  rows, columns, defaultSort, emptyLabel = 'Nothing here yet',
  onBulkDelete, bulkVerb = 'Delete selected',
}: SortableTableProps<Row>) {
  const [sort, setSort] = useState<SortState>(defaultSort ?? { key: columns[0]?.key ?? 'id', dir: 'asc' });
  const [checked, setChecked] = useState<Set<number | string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    const accessor = col?.sortAccessor ?? ((r: Row) => (r as unknown as Record<string, unknown>)[sort.key] as number | string);
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = accessor(a) ?? '';
      const bv = accessor(b) ?? '';
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [rows, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const toggleAll = () =>
    setChecked((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));

  const toggleOne = (id: number | string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const doBulk = () => {
    if (checked.size === 0) return;
    const ids = Array.from(checked);
    startTransition(async () => {
      try {
        await onBulkDelete(ids);
        setChecked(new Set());
        setMsg(`✓ ${ids.length} row${ids.length === 1 ? '' : 's'} removed`);
        setTimeout(() => setMsg(null), 3000);
        window.location.reload();
      } catch (e) {
        setMsg(`✗ ${(e as Error).message}`);
      }
    });
  };

  return (
    <div>
      {checked.size > 0 && (
        <div style={bulkBar}>
          <span>{checked.size} selected</span>
          <button type="button" onClick={doBulk} disabled={pending} style={bulkBtn}>
            {pending ? '…' : `${bulkVerb} (${checked.size})`}
          </button>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 32 }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={rows.length > 0 && checked.size === rows.length}
                  onChange={toggleAll}
                />
              </th>
              {columns.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} style={{ ...thStyle, textAlign: c.align ?? 'left', cursor: 'pointer' }}
                      onClick={() => toggleSort(c.key)}>
                    {c.label}
                    <span style={{ marginLeft: 4, opacity: active ? 1 : 0.25, fontSize: 10 }}>
                      {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={columns.length + 1} style={emptyStyle}>{emptyLabel}</td></tr>
            )}
            {sorted.map((r) => (
              <tr key={String(r.id)}>
                <td style={tdStyle}>
                  <input
                    type="checkbox"
                    aria-label="Select row"
                    checked={checked.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                  />
                </td>
                {columns.map((c) => (
                  <td key={c.key} style={{ ...tdStyle, textAlign: c.align ?? 'left' }}>
                    {c.render ? c.render(r) : ((r as unknown as Record<string, unknown>)[c.key] as React.ReactNode) ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.startsWith('✓') ? '#1F5C2C' : '#B04A2F' }}>{msg}</div>}
    </div>
  );
}

// ─── Add-recipient inline form ─────────────────────────────────────

export function AddRecipientForm({ propertyId }: { propertyId: number }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const submit = () => {
    if (!email.trim()) return;
    startTransition(async () => {
      try {
        const r = await fetch('/api/revenue/reports/recipient/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: propertyId, template_key: template, email: email.trim(), name: name.trim() || null }),
        });
        if (!r.ok) throw new Error(`add failed (${r.status})`);
        setMsg('✓ added');
        setEmail(''); setName('');
        setTimeout(() => window.location.reload(), 300);
      } catch (e) {
        setMsg(`✗ ${(e as Error).message}`);
      }
    });
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
      <select value={template} onChange={(e) => setTemplate(e.target.value as 'daily' | 'weekly' | 'monthly')} style={inputStyle}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <input placeholder="email"  value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, minWidth: 200 }} />
      <input placeholder="name (optional)" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, minWidth: 150 }} />
      <button type="button" onClick={submit} disabled={pending || !email.trim()} style={primaryBtn}>
        {pending ? '…' : '+ Add recipient'}
      </button>
      {msg && <span style={{ fontSize: 11, color: msg.startsWith('✓') ? '#1F5C2C' : '#B04A2F' }}>{msg}</span>}
    </div>
  );
}

// ─── Scheduled reports table (recipients + dismiss) ────────────────

export interface ScheduledRow {
  id: number;
  property_id: number;
  template_key: 'daily' | 'weekly' | 'monthly';
  email: string;
  name: string | null;
  next_fire_at: string | null;
  created_at: string;
}

export function ScheduledReportsTable({ rows, propertyId }: { rows: ScheduledRow[]; propertyId: number }) {
  return (
    <>
      <AddRecipientForm propertyId={propertyId} />
      <SortableTable<ScheduledRow>
        rows={rows}
        emptyLabel="No scheduled reports yet — add a recipient above."
        bulkVerb="Dismiss selected"
        defaultSort={{ key: 'next_fire_at', dir: 'asc' }}
        columns={[
          { key: 'email', label: 'Receiver' },
          { key: 'template_key', label: 'Report', render: (r) => ({ daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[r.template_key]) },
          { key: 'template_key', label: 'Frequency', render: (r) => ({ daily: 'every day', weekly: 'every Monday', monthly: '1st of month' }[r.template_key]) },
          { key: 'next_fire_at', label: 'Next date', render: (r) => (r.next_fire_at ? new Date(r.next_fire_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—') },
        ]}
        onBulkDelete={async (ids) => {
          const r = await fetch('/api/revenue/reports/recipient/dismiss', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
          });
          if (!r.ok) throw new Error(`dismiss failed (${r.status})`);
        }}
      />
    </>
  );
}

// ─── Send log table ───────────────────────────────────────────────

export interface SendLogRow {
  id: number;
  property_id: number;
  template_key: 'daily' | 'weekly' | 'monthly';
  sent_at: string;
  recipient_email: string;
  created_by: string;
  report_name: string;
  status: string;
}

export function SendLogTable({ rows }: { rows: SendLogRow[] }) {
  return (
    <SortableTable<SendLogRow>
      rows={rows}
      emptyLabel="No reports have been sent yet. When the cron fires, entries appear here."
      bulkVerb="Delete selected"
      defaultSort={{ key: 'sent_at', dir: 'desc' }}
      columns={[
        { key: 'created_by',      label: 'Created by' },
        { key: 'recipient_email', label: 'Sent to' },
        { key: 'report_name',     label: 'Report' },
        { key: 'sent_at',         label: 'Date + time', render: (r) => new Date(r.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
        { key: 'status',          label: 'Status' },
      ]}
      onBulkDelete={async (ids) => {
        const r = await fetch('/api/revenue/reports/sends/delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        if (!r.ok) throw new Error(`delete failed (${r.status})`);
      }}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#FFFFFF' };
const thStyle: CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', borderBottom: '1px solid #E6DFCC', userSelect: 'none' };
const tdStyle: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F1EBD9', color: '#1B1B1B', fontVariantNumeric: 'tabular-nums' };
const emptyStyle: CSSProperties = { padding: 20, textAlign: 'center', color: '#5A5A5A', fontStyle: 'italic', fontSize: 12 };
const inputStyle: CSSProperties = { padding: '5px 8px', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, background: '#FFFFFF', color: '#1B1B1B', fontFamily: 'inherit' };
const primaryBtn: CSSProperties = { padding: '6px 12px', border: '1px solid #084838', background: '#084838', color: '#FFFFFF', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const bulkBar: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: '#FBEEE7', border: '1px solid #E6DFCC', borderRadius: 4, marginBottom: 8, fontSize: 12, color: '#8C3B12' };
const bulkBtn: CSSProperties = { padding: '4px 10px', border: '1px solid #B8542A', background: '#B8542A', color: '#FFFFFF', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' };
