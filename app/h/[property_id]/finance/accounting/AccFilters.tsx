'use client';
// app/h/[property_id]/finance/accounting/AccFilters.tsx
// Interactive filter bar for the QB Accounting transaction feed.
// URL params: q · type · dept · file · provisional · from · until
// Preserves all other params when patching any single filter.

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

const MUTE = 'var(--tbl-fg-mute, rgba(26,26,26,0.55))';
const BORDER = 'var(--tbl-border, rgba(26,26,26,0.14))';
const FG = 'var(--tbl-fg, #1A1A1A)';
const BG = 'var(--tbl-bg, #fff)';

interface Props {
  txnTypes: string[];
  depts: string[];
  files: string[];
  totalRows: number;
}

export default function AccFilters({ txnTypes, depts, files, totalRows }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const patch = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(Array.from(searchParams.entries()));
      if (value) p.set(key, value); else p.delete(key);
      p.delete('page'); // reset pagination on any filter change
      router.push(`${pathname}?${p.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const q            = searchParams.get('q') ?? '';
  const type         = searchParams.get('type') ?? '';
  const dept         = searchParams.get('dept') ?? '';
  const file         = searchParams.get('file') ?? '';
  const provisional  = searchParams.get('provisional') ?? 'all';
  const from         = searchParams.get('from') ?? '';
  const until        = searchParams.get('until') ?? '';

  const sel: React.CSSProperties = {
    padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 4,
    background: BG, color: FG, fontSize: 'var(--t-xs)', cursor: 'pointer',
    maxWidth: 200,
  };
  const inp: React.CSSProperties = { ...sel, maxWidth: 220 };
  const dateInp: React.CSSProperties = { ...sel, maxWidth: 130 };

  const shortenFile = (f: string) => f.split(/[\\/]/).pop()?.slice(0, 38) ?? f;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      {/* Free-text search */}
      <input
        type="search"
        placeholder="Search payee / memo / account…"
        value={q}
        onChange={(e) => patch('q', e.target.value)}
        style={{ ...inp, maxWidth: 260 }}
      />

      {/* Transaction type */}
      <select value={type} onChange={(e) => patch('type', e.target.value)} style={sel}>
        <option value="">All types</option>
        {txnTypes.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* USALI department / class */}
      <select value={dept} onChange={(e) => patch('dept', e.target.value)} style={sel}>
        <option value="">All depts</option>
        {depts.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      {/* Source file (QB import batch) */}
      <select value={file} onChange={(e) => patch('file', e.target.value)} style={sel}>
        <option value="">All import batches</option>
        {files.map((f) => <option key={f} value={f}>{shortenFile(f)}</option>)}
      </select>

      {/* Provisional */}
      <select value={provisional} onChange={(e) => patch('provisional', e.target.value)} style={sel}>
        <option value="all">All entries</option>
        <option value="false">Live only</option>
        <option value="true">Provisional only</option>
      </select>

      {/* Date range */}
      <input
        type="date"
        value={from}
        onChange={(e) => patch('from', e.target.value)}
        style={dateInp}
        title="From date"
      />
      <span style={{ color: MUTE, fontSize: 'var(--t-xs)' }}>→</span>
      <input
        type="date"
        value={until}
        onChange={(e) => patch('until', e.target.value)}
        style={dateInp}
        title="Until date"
      />

      <span style={{ color: MUTE, fontSize: 'var(--t-xs)', marginLeft: 'auto' }}>
        {totalRows.toLocaleString()} rows
      </span>
    </div>
  );
}
