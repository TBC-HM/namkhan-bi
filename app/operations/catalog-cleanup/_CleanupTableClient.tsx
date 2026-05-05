'use client';

// Catalog cleanup queue with per-row mapping form.
// F&B manager picks an action, fills the relevant fields, and saves.
// Decisions persist via POST /api/operations/catalog-cleanup/decide and the
// page revalidates on next reload.

import { useMemo, useState, useTransition } from 'react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd, EMPTY } from '@/lib/format';

export interface DirtyRow {
  usali_dept: string | null;
  usali_subdept: string | null;
  item_category_name: string | null;
  description: string;
  lines: number;
  revenue_usd: number;
  avg_amount: number;
  min_amount: number;
  max_amount: number;
  distinct_prices: number;
  weird_cents_lines: number;
  f_unclassified: boolean;
  f_multi_price: boolean;
  f_missing_duration: boolean;
  f_lak_converted: boolean;
  f_dirty_name: boolean;
  dirty_score: number;
  suggested_action: string;
  // Decision (LEFT JOIN with catalog_cleanup_decisions WHERE status = 'open')
  decision_id: number | null;
  action_type: string | null;
  target_description: string | null;
  target_usali_dept: string | null;
  target_usali_subdept: string | null;
  target_category: string | null;
  target_price_usd: number | null;
  decision_notes: string | null;
  decision_status: string | null;
}

type FilterKey = 'all' | 'unclassified' | 'multi_price' | 'missing_duration' | 'lak_converted' | 'dirty_name' | 'open' | 'decided';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  open: 'Open · no decision',
  decided: 'Decided',
  unclassified: 'Unclassified',
  multi_price: 'Multi-price',
  missing_duration: 'No duration',
  lak_converted: 'LAK price',
  dirty_name: 'Bad name',
};

const ACTION_LABELS: Record<string, string> = {
  set_usali:       'Set USALI dept',
  set_category:    'Set category',
  rename:          'Rename in Cloudbeds',
  split_variants:  'Split into N SKUs',
  merge_into:      'Merge into another SKU',
  set_price:       'Set USD price',
  dismiss:         'Dismiss (correct as-is)',
  todo:            'Note · decide later',
};

const USALI_DEPTS = ['F&B', 'Other Operated', 'Rooms', 'Retail', 'Unclassified'];
const USALI_SUBS_BY_DEPT: Record<string, string[]> = {
  'F&B':            ['Food', 'Beverage', 'Other'],
  'Other Operated': ['Spa', 'Activities', 'Transportation', 'Retail', 'Other'],
  'Rooms':          ['Transient', 'Group', 'Contract'],
  'Retail':         [],
  'Unclassified':   [],
};

export default function CleanupTableClient({ rows }: { rows: DirtyRow[] }) {
  const [filter, setFilter] = useState<FilterKey>('open');
  const [dept, setDept] = useState<string>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const depts = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => s.add(r.usali_dept || 'Unclassified'));
    return ['all', ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (dept !== 'all' && (r.usali_dept || 'Unclassified') !== dept) return false;
      if (filter === 'unclassified'     && !r.f_unclassified)     return false;
      if (filter === 'multi_price'      && !r.f_multi_price)      return false;
      if (filter === 'missing_duration' && !r.f_missing_duration) return false;
      if (filter === 'lak_converted'    && !r.f_lak_converted)    return false;
      if (filter === 'dirty_name'       && !r.f_dirty_name)       return false;
      if (filter === 'open'             && r.decision_id != null) return false;
      if (filter === 'decided'          && r.decision_id == null) return false;
      return true;
    });
  }, [rows, filter, dept]);

  const rowKey = (r: DirtyRow) => `${r.description}|${r.item_category_name ?? ''}`;

  const columns: Column<DirtyRow>[] = [
    {
      key: 'sku',
      header: 'SKU',
      align: 'left',
      width: '24%',
      render: (r) => (
        <div>
          <button
            onClick={() => setExpandedKey(expandedKey === rowKey(r) ? null : rowKey(r))}
            style={{
              display: 'block',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              color: 'inherit',
              fontWeight: 500,
            }}>
            {expandedKey === rowKey(r) ? '▾ ' : '▸ '}{r.description || EMPTY}
          </button>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
            {r.item_category_name || <em>no category</em>}
          </div>
        </div>
      ),
      sortValue: (r) => r.description?.toLowerCase() ?? '',
    },
    {
      key: 'usali',
      header: 'USALI',
      align: 'left',
      width: '11%',
      render: (r) => (
        <div>
          <div>{r.usali_dept || EMPTY}</div>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>{r.usali_subdept || ''}</div>
        </div>
      ),
      sortValue: (r) => `${r.usali_dept ?? ''}/${r.usali_subdept ?? ''}`,
    },
    {
      key: 'flags',
      header: 'Flags',
      align: 'left',
      width: '14%',
      render: (r) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {r.f_unclassified     && <Pill tone="bad">USALI</Pill>}
          {r.f_multi_price      && <Pill tone="warn">{`${(r.max_amount / Math.max(r.min_amount, 0.01)).toFixed(1)}×`}</Pill>}
          {r.f_missing_duration && <Pill tone="warn">duration</Pill>}
          {r.f_lak_converted    && <Pill tone="warn">LAK</Pill>}
          {r.f_dirty_name       && <Pill tone="warn">name</Pill>}
        </div>
      ),
      sortValue: (r) => r.dirty_score,
    },
    {
      key: 'lines',
      header: 'Lines',
      align: 'right',
      numeric: true,
      width: '6%',
      render: (r) => r.lines.toLocaleString('en-US'),
      sortValue: (r) => r.lines,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      numeric: true,
      width: '8%',
      render: (r) => fmtTableUsd(r.revenue_usd),
      sortValue: (r) => r.revenue_usd,
    },
    {
      key: 'price_range',
      header: 'Price spread',
      align: 'right',
      numeric: true,
      width: '11%',
      render: (r) => (
        <span style={{ color: r.f_multi_price ? 'var(--bad, #b53a2a)' : undefined }}>
          {fmtTableUsd(r.min_amount)} → {fmtTableUsd(r.max_amount)}
        </span>
      ),
      sortValue: (r) => (r.max_amount - r.min_amount),
    },
    {
      key: 'decision',
      header: 'Decision',
      align: 'left',
      width: '17%',
      render: (r) =>
        r.decision_id != null ? (
          <div>
            <Pill tone="ok">{ACTION_LABELS[r.action_type ?? ''] ?? r.action_type}</Pill>
            {r.target_description && (
              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                → {r.target_description}
              </div>
            )}
            {r.target_usali_dept && (
              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                → {r.target_usali_dept}{r.target_usali_subdept ? ` / ${r.target_usali_subdept}` : ''}
              </div>
            )}
          </div>
        ) : (
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            color: 'var(--brass)',
          }}>{r.suggested_action}</span>
        ),
      sortValue: (r) => r.decision_id != null ? '0' : (r.suggested_action ?? '1'),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
        }}>Filter:</span>
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map(k => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            style={{
              padding: '4px 10px',
              border: '1px solid var(--rule, #e3dfd3)',
              background: filter === k ? 'var(--ink, #2c2a25)' : 'transparent',
              color: filter === k ? 'var(--paper, #fbf9f3)' : 'var(--ink, #2c2a25)',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}>
            {FILTER_LABELS[k]}
          </button>
        ))}
        <span style={{
          marginLeft: 16,
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
        }}>Dept:</span>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--rule, #e3dfd3)',
            background: 'transparent',
            fontSize: 'var(--t-xs)',
            fontFamily: 'var(--mono)',
            color: 'var(--ink, #2c2a25)',
          }}>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <DataTable<DirtyRow>
        columns={columns}
        rows={filtered}
        rowKey={(r) => rowKey(r)}
        defaultSort={{ key: 'flags', dir: 'desc' }}
        emptyState={
          <span>
            {filter === 'open'
              ? 'No undecided dirty SKUs match this filter — well done.'
              : 'No dirty items match this filter.'}
          </span>
        }
      />

      {expandedKey && (
        <div style={{
          position: 'fixed',
          right: 24, bottom: 24,
          width: 460, maxHeight: '80vh',
          background: 'var(--paper, #fbf9f3)',
          border: '1px solid var(--rule, #e3dfd3)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          zIndex: 50,
          overflowY: 'auto',
        }}>
          <DecisionForm
            row={filtered.find(r => rowKey(r) === expandedKey)!}
            onClose={() => setExpandedKey(null)}
          />
        </div>
      )}
    </>
  );
}

function DecisionForm({ row, onClose }: { row: DirtyRow; onClose: () => void }) {
  const [action, setAction] = useState<string>(row.action_type ?? row.suggested_action);
  const [targetDescription, setTargetDescription] = useState<string>(row.target_description ?? '');
  const [targetDept, setTargetDept]               = useState<string>(row.target_usali_dept ?? '');
  const [targetSubdept, setTargetSubdept]         = useState<string>(row.target_usali_subdept ?? '');
  const [targetCategory, setTargetCategory]       = useState<string>(row.target_category ?? '');
  const [targetPriceUsd, setTargetPriceUsd]       = useState<string>(row.target_price_usd?.toString() ?? '');
  const [notes, setNotes]                         = useState<string>(row.decision_notes ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/operations/catalog-cleanup/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: row.description,
            item_category_name: row.item_category_name,
            action_type: action,
            target_description: targetDescription || null,
            target_usali_dept:  targetDept || null,
            target_usali_subdept: targetSubdept || null,
            target_category: targetCategory || null,
            target_price_usd: targetPriceUsd ? Number(targetPriceUsd) : null,
            notes: notes || null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error || `HTTP ${res.status}`);
          return;
        }
        setDone(true);
        // Trigger a fresh fetch on next page interaction
        setTimeout(() => {
          window.location.reload();
        }, 600);
      } catch (e: any) {
        setError(e?.message ?? 'request_failed');
      }
    });
  };

  const showsTarget   = action === 'merge_into' || action === 'rename';
  const showsUsali    = action === 'set_usali';
  const showsCategory = action === 'set_category';
  const showsPrice    = action === 'set_price';

  const subdeptOptions = USALI_SUBS_BY_DEPT[targetDept] ?? [];

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            color: 'var(--brass)',
          }}>Map · {row.usali_dept ?? 'Unclassified'}{row.usali_subdept ? ` / ${row.usali_subdept}` : ''}</div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', marginTop: 2 }}>
            {row.description}
          </div>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
            {row.item_category_name || <em>no category</em>} · {row.lines} lines · ${row.revenue_usd.toFixed(0)} · {row.min_amount} → {row.max_amount}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 'var(--t-lg)', color: 'var(--ink-soft)',
        }}>×</button>
      </div>

      <FormRow label="Action">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          style={selectStyle}>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </FormRow>

      {showsTarget && (
        <FormRow label={action === 'merge_into' ? 'Merge into SKU' : 'New name'}>
          <input
            type="text"
            value={targetDescription}
            onChange={(e) => setTargetDescription(e.target.value)}
            placeholder={action === 'merge_into' ? 'e.g. Lao Massage 60 min' : 'e.g. Aroma of Lao 60 min'}
            style={inputStyle} />
        </FormRow>
      )}

      {showsUsali && (
        <>
          <FormRow label="USALI dept">
            <select
              value={targetDept}
              onChange={(e) => { setTargetDept(e.target.value); setTargetSubdept(''); }}
              style={selectStyle}>
              <option value="">— pick —</option>
              {USALI_DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormRow>
          {subdeptOptions.length > 0 && (
            <FormRow label="USALI subdept">
              <select
                value={targetSubdept}
                onChange={(e) => setTargetSubdept(e.target.value)}
                style={selectStyle}>
                <option value="">— pick —</option>
                {subdeptOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormRow>
          )}
        </>
      )}

      {showsCategory && (
        <FormRow label="Cloudbeds category">
          <input
            type="text"
            value={targetCategory}
            onChange={(e) => setTargetCategory(e.target.value)}
            placeholder="e.g. Wine & Sparkling, Salads"
            style={inputStyle} />
        </FormRow>
      )}

      {showsPrice && (
        <FormRow label="New USD price">
          <input
            type="number"
            step="0.01"
            value={targetPriceUsd}
            onChange={(e) => setTargetPriceUsd(e.target.value)}
            placeholder="e.g. 15.00"
            style={inputStyle} />
        </FormRow>
      )}

      <FormRow label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Context for the operator who applies this in Cloudbeds"
          style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
      </FormRow>

      {error && (
        <div style={{
          padding: '6px 10px',
          background: 'rgba(181, 58, 42, 0.10)',
          color: 'var(--bad, #b53a2a)',
          fontSize: 'var(--t-xs)',
          marginBottom: 8,
        }}>{error}</div>
      )}
      {done && (
        <div style={{
          padding: '6px 10px',
          background: 'rgba(44, 122, 75, 0.10)',
          color: 'var(--good, #2c7a4b)',
          fontSize: 'var(--t-xs)',
          marginBottom: 8,
        }}>Saved. Reloading…</div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
        <button onClick={onSave} disabled={pending} style={btnPrimary}>
          {pending ? 'Saving…' : (row.decision_id != null ? 'Update decision' : 'Save decision')}
        </button>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{
        display: 'block',
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
        marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--rule, #e3dfd3)',
  background: 'var(--paper, #fbf9f3)',
  fontFamily: 'inherit',
  fontSize: 'var(--t-sm)',
  color: 'var(--ink, #2c2a25)',
};
const selectStyle: React.CSSProperties = { ...inputStyle, padding: '5px 8px' };
const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--ink, #2c2a25)',
  background: 'var(--ink, #2c2a25)',
  color: 'var(--paper, #fbf9f3)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--rule, #e3dfd3)',
  background: 'transparent',
  color: 'var(--ink, #2c2a25)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

function Pill({ children, tone }: { children: React.ReactNode; tone: 'bad' | 'warn' | 'ok' }) {
  const bg =
    tone === 'bad'  ? 'rgba(181, 58, 42, 0.12)' :
    tone === 'warn' ? 'rgba(180, 130, 40, 0.14)' :
                      'rgba(44, 122, 75, 0.12)';
  const fg =
    tone === 'bad'  ? 'var(--bad, #b53a2a)' :
    tone === 'warn' ? 'var(--brass, #b48228)' :
                      'var(--good, #2c7a4b)';
  return (
    <span style={{
      padding: '1px 6px',
      background: bg,
      color: fg,
      fontFamily: 'var(--mono)',
      fontSize: 'var(--t-xs)',
      letterSpacing: 'var(--ls-extra)',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}
