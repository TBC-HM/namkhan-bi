'use client';
// Activity catalog drawer — internal/external/all tabs, category chips, search, sort.
// Reads /api/sales/proposals/activities. Adds picked activities as proposal blocks.

import { useEffect, useMemo, useState } from 'react';
import StatusPill from '@/components/ui/StatusPill';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd, FX_LAK_PER_USD, EMPTY } from '@/lib/format';
import type { Activity } from '@/lib/sales';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (activity: Activity) => void;
}

type Kind = 'internal' | 'external' | 'all';
type Sort = 'popularity' | 'az' | 'price' | 'margin';

export default function ActivityCatalogDrawer({ open, onClose, onPick }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; slug: string; name: string; glyph: string | null }>>([]);
  const [kind, setKind] = useState<Kind>('all');
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('popularity');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (kind !== 'all') params.set('kind', kind);
    if (cat !== 'all') params.set('cat', cat);
    if (q) params.set('q', q);
    fetch(`/api/sales/proposals/activities?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setActivities(d.activities ?? []); setCategories(d.categories ?? []); })
      .finally(() => setLoading(false));
  }, [open, kind, cat, q]);

  const sorted = useMemo(() => {
    const arr = [...activities];
    if (sort === 'az') arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'price') arr.sort((a, b) => Number(a.sell_lak) - Number(b.sell_lak));
    else if (sort === 'margin') arr.sort((a, b) => (Number(b.margin_pct ?? 0) - Number(a.margin_pct ?? 0)));
    return arr;
  }, [activities, sort]);

  if (!open) return null;

  const columns: Column<Activity>[] = [
    {
      key: 'title', header: 'ACTIVITY',
      sortValue: (a) => a.title.toLowerCase(),
      render: (a) => (
        <span>
          <span style={{ fontWeight: 500 }}>{a.title}</span>
          {a.is_signature && (
            <span style={{ marginLeft: 6 }}>
              <StatusPill tone="info">SIG</StatusPill>
            </span>
          )}
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>
            {a.short_summary ?? EMPTY}
          </div>
        </span>
      ),
    },
    {
      key: 'kind', header: 'TYPE', align: 'center',
      sortValue: (a) => a.kind,
      render: (a) => (
        <StatusPill tone={a.kind === 'internal' ? 'active' : 'info'}>
          {a.kind === 'internal' ? 'IN' : 'EXT'}
        </StatusPill>
      ),
    },
    {
      key: 'partner', header: 'PARTNER',
      sortValue: (a) => (a.partner_name ?? '').toLowerCase(),
      render: (a) => a.partner_name ?? EMPTY,
    },
    {
      key: 'duration', header: 'MIN', numeric: true,
      sortValue: (a) => a.duration_min ?? 0,
      render: (a) => a.duration_min ?? EMPTY,
    },
    {
      key: 'price', header: 'PRICE', numeric: true,
      sortValue: (a) => Number(a.sell_lak),
      render: (a) => fmtTableUsd(Number(a.sell_lak) / FX_LAK_PER_USD),
    },
    {
      key: 'margin', header: 'MARGIN', numeric: true,
      sortValue: (a) => Number(a.margin_pct ?? 0),
      render: (a) => a.margin_pct != null ? `${Number(a.margin_pct).toFixed(0)}%` : EMPTY,
    },
    {
      key: 'pick', header: '', align: 'right',
      render: (a) => {
        const isPicked = selected.has(a.id);
        return (
          <button
            className={isPicked ? 'btn' : 'btn btn-primary'}
            onClick={() => { onPick(a); setSelected(s => new Set(s).add(a.id)); }}
          >
            {isPicked ? 'Added' : 'Add →'}
          </button>
        );
      },
    },
  ];

  return (
    <div onClick={onClose} className="proposal-drawer-mask">
      <aside onClick={e => e.stopPropagation()} className="proposal-drawer wide">
        <header className="proposal-drawer-head">
          <div>
            <div className="t-eyebrow">Activity catalog · Luang Prabang</div>
            <h3 className="proposal-drawer-title">
              Pick your <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>add-ons</em>
            </h3>
          </div>
          <button className="btn" onClick={onClose}>Close ✕</button>
        </header>

        <div className="proposal-drawer-body">
          {/* Tabs */}
          <div className="proposal-drawer-tabs">
            {(['all', 'internal', 'external'] as Kind[]).map(k => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`btn${kind === k ? ' btn-primary' : ''}`}
                style={{ textTransform: 'capitalize' }}
              >{k}</button>
            ))}
          </div>

          {/* Category chips */}
          <div className="proposal-drawer-chips">
            <button onClick={() => setCat('all')} className={`chip${cat === 'all' ? ' on' : ''}`}>All</button>
            {categories.map(c => (
              <button key={c.slug} onClick={() => setCat(c.slug)} className={`chip${cat === c.slug ? ' on' : ''}`}>{c.name}</button>
            ))}
          </div>

          {/* Search + sort */}
          <div className="proposal-drawer-controls">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search title or summary…"
              className="proposal-input"
            />
            <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="proposal-input">
              <option value="popularity">Popularity</option>
              <option value="az">A → Z</option>
              <option value="price">Price low → high</option>
              <option value="margin">Margin %</option>
            </select>
          </div>

          {loading && <p style={{ color: 'var(--ink-mute)' }}>Loading catalog…</p>}

          {!loading && (
            <DataTable<Activity>
              columns={columns}
              rows={sorted}
              rowKey={(a) => a.id}
              emptyState="No activities match these filters."
            />
          )}
        </div>
      </aside>
    </div>
  );
}
