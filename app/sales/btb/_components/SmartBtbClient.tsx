'use client';

// app/sales/btb/_components/SmartBtbClient.tsx
//
// Smart BTB / partners surface — one page, four type pills (All · MICE · DMC ·
// Retreats · Groups), shared filters, sortable canonical <DataTable>, slide-in
// drawer for row detail.
//
// PBS 2026-05-09: "WANT TO AVOID TOO MUCH CLICKING". Combine dropdowns +
// containers — don't make me hop between sub-pages.
//
// Drawer pattern mirrors app/guest/directory/_components/ProfileDrawer.tsx
// so cross-page muscle memory is identical.

import { useMemo, useState } from 'react';
import KpiBox from '@/components/kpi/KpiBox';
import Panel from '@/components/page/Panel';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import ArtifactActions from '@/components/page/ArtifactActions';
import { fmtIsoDate, fmtTableUsd, EMPTY } from '@/lib/format';

// ────────────────────────────────────────────────────────────────────────────
// Account model — unified row across the four sources.
// ────────────────────────────────────────────────────────────────────────────

export type AccountType = 'MICE' | 'DMC' | 'Retreat' | 'Group';

export interface Account {
  /** Stable composite key: `${type}:${source_id}`. */
  key: string;
  type: AccountType;
  /** Display name (partner / retreat / group / MICE block). */
  name: string;
  /** ISO country code or country name; null if unknown. */
  country: string | null;
  /** Flag emoji if available. */
  flag: string | null;
  /** Lifecycle status normalised to a StatusPill tone. */
  status: 'active' | 'pending' | 'expired' | 'inactive' | 'info';
  /** Free-text status label as it lives in the source. */
  statusLabel: string;
  /** Open value indicator — USD revenue, contract %, block size, etc. Null if N/A. */
  value: number | null;
  /** Unit hint for `value`. Used by the table cell renderer. */
  valueKind: 'usd' | 'count' | 'pct' | null;
  /** Optional date that anchors the row (arrival / effective / signed). */
  anchorDate: string | null;
  /** Optional contact name for at-a-glance. */
  contact: string | null;
  /** Optional source-specific lead source / channel. */
  leadSource: string | null;
  /** Detail block — pre-resolved key/value rows shown inside the drawer. */
  detail: Array<{ k: string; v: string | null }>;
  /** Optional deep-link to a dedicated source page (e.g. /sales/b2b/partner/<id>). */
  deepLink?: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Pills + filters
// ────────────────────────────────────────────────────────────────────────────

const TYPES: Array<{ key: 'all' | AccountType; label: string; subtitle: string }> = [
  { key: 'all',     label: 'All',      subtitle: 'every BTB account' },
  { key: 'MICE',    label: 'MICE',     subtitle: 'meetings · incentives · conf · exhibitions' },
  { key: 'DMC',     label: 'DMC',      subtitle: 'destination management + tour operators' },
  { key: 'Retreat', label: 'Retreats', subtitle: 'wellness, yoga, curated programs' },
  { key: 'Group',   label: 'Groups',   subtitle: 'block bookings ≥ 5 rooms' },
];

const STATUS_FILTERS = [
  { v: 'all',      label: 'All status' },
  { v: 'active',   label: 'Active' },
  { v: 'pending',  label: 'Pending / open' },
  { v: 'expired',  label: 'Expired' },
  { v: 'inactive', label: 'Inactive / closed' },
] as const;

interface Props {
  rows: Account[];
}

export default function SmartBtbClient({ rows }: Props) {
  const [tab, setTab] = useState<'all' | AccountType>('all');
  const [country, setCountry] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [leadSrc, setLeadSrc] = useState<string>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Distinct dropdown options — derived from the data so we never invent values.
  const countryOpts = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.country && set.add(r.country));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const leadOpts = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.leadSource && set.add(r.leadSource));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  // Type counts — always show all tabs, even when empty (PBS rule: empty state
  // with CTA is fine; hiding tabs is not).
  const counts = useMemo(() => {
    const c = { all: rows.length, MICE: 0, DMC: 0, Retreat: 0, Group: 0 } as Record<string, number>;
    rows.forEach((r) => { c[r.type] = (c[r.type] ?? 0) + 1; });
    return c;
  }, [rows]);

  // Per-type open value (sum of `value` where `valueKind === 'usd'` and status active).
  const openValueByType = useMemo(() => {
    const v = { all: 0, MICE: 0, DMC: 0, Retreat: 0, Group: 0 } as Record<string, number>;
    rows.forEach((r) => {
      if (r.valueKind === 'usd' && r.value != null && (r.status === 'active' || r.status === 'pending')) {
        v[r.type] += r.value;
        v.all += r.value;
      }
    });
    return v;
  }, [rows]);

  const activeByType = useMemo(() => {
    const a = { all: 0, MICE: 0, DMC: 0, Retreat: 0, Group: 0 } as Record<string, number>;
    rows.forEach((r) => {
      if (r.status === 'active' || r.status === 'pending') {
        a[r.type] += 1;
        a.all += 1;
      }
    });
    return a;
  }, [rows]);

  // Filter pipeline.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== 'all' && r.type !== tab) return false;
      if (country !== 'all' && r.country !== country) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (leadSrc !== 'all' && r.leadSource !== leadSrc) return false;
      if (q) {
        const hay = `${r.name} ${r.contact ?? ''} ${r.country ?? ''} ${r.statusLabel} ${r.leadSource ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tab, country, status, leadSrc, search]);

  const openAcct = useMemo(() => rows.find((r) => r.key === openKey) ?? null, [rows, openKey]);

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<Account>[] = [
    {
      key: 'name', header: 'Account', align: 'left',
      sortValue: (r) => r.name.toLowerCase(),
      render: (r) => (
        <div style={ST.nameCell} data-rowkey={r.key}>
          <strong style={ST.nameStrong}>{r.name}</strong>
          {r.contact && <span style={ST.contactSub}>{r.contact}</span>}
        </div>
      ),
    },
    {
      key: 'type', header: 'Type', align: 'center', width: '110px',
      sortValue: (r) => r.type,
      render: (r) => <span style={ST.typeBadge}>{r.type}</span>,
    },
    {
      key: 'country', header: 'Country', align: 'left', width: '160px',
      sortValue: (r) => (r.country ?? 'zzz').toLowerCase(),
      render: (r) => (
        <span>{r.flag ? `${r.flag} ` : ''}{r.country ?? EMPTY}</span>
      ),
    },
    {
      key: 'leadSource', header: 'Channel', align: 'left', width: '140px',
      sortValue: (r) => (r.leadSource ?? 'zzz').toLowerCase(),
      render: (r) => <span style={ST.muted}>{r.leadSource ?? EMPTY}</span>,
    },
    {
      key: 'status', header: 'Status', align: 'center', width: '110px',
      sortValue: (r) => r.status,
      render: (r) => <StatusPill tone={statusTone(r.status)}>{r.statusLabel}</StatusPill>,
    },
    {
      key: 'value', header: 'Open value', align: 'right', width: '130px', numeric: true,
      sortValue: (r) => r.value ?? -1,
      render: (r) => {
        if (r.value == null) return <span style={ST.muted}>{EMPTY}</span>;
        if (r.valueKind === 'usd')   return <span>{fmtTableUsd(r.value)}</span>;
        if (r.valueKind === 'pct')   return <span>{r.value.toFixed(1)}%</span>;
        if (r.valueKind === 'count') return <span>{r.value.toLocaleString('en-US')}</span>;
        return <span>{EMPTY}</span>;
      },
    },
    {
      key: 'anchor', header: 'Date', align: 'left', width: '120px',
      sortValue: (r) => r.anchorDate ?? '0000-00-00',
      render: (r) => <span style={ST.muted}>{fmtIsoDate(r.anchorDate)}</span>,
    },
  ];

  return (
    <>
      {/* ── KPI strip — counts per type + open value ────────────────────── */}
      <div style={ST.kpiStrip}>
        <KpiBox value={counts.all}     unit="count" label="Total accounts"  tooltip="All BTB accounts across MICE / DMC / Retreats / Groups." />
        <KpiBox value={activeByType.all} unit="count" label="Active / open" tooltip="Active or pending status across all types." />
        <KpiBox value={counts.MICE}    unit="count" label="MICE"            tooltip="Meeting / incentive / conference / exhibition leads. Subset of public.groups." />
        <KpiBox value={counts.DMC}     unit="count" label="DMC partners"    tooltip="Source: governance.dmc_contracts." />
        <KpiBox value={counts.Retreat} unit="count" label="Retreat programs" tooltip="Source: marketing.retreat_programs." />
        <KpiBox value={counts.Group}   unit="count" label="Group blocks"    tooltip="Source: public.groups." />
        <KpiBox
          value={openValueByType[tab as string] ?? 0}
          unit="usd"
          label={tab === 'all' ? 'Pipeline (all)' : `Pipeline · ${tab}`}
          tooltip="Sum of USD value on rows currently active or pending in the selected tab. Excludes rows without USD value (e.g. retreats, MICE blocks without quote)."
        />
      </div>

      {/* ── Type pills ──────────────────────────────────────────────────── */}
      <div style={ST.pillRow}>
        {TYPES.map((t) => {
          const isActive = tab === t.key;
          const n = counts[t.key as string] ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setOpenKey(null); }}
              style={isActive ? ST.pillActive : ST.pillIdle}
              title={t.subtitle}
            >
              {t.label} <span style={ST.pillCount}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* ── Filter row ──────────────────────────────────────────────────── */}
      <div style={ST.filterRow}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search account, contact, channel…"
          style={ST.search}
        />
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={ST.select}>
          {countryOpts.map((c) => <option key={c} value={c}>{c === 'all' ? 'All countries' : c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={ST.select}>
          {STATUS_FILTERS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <select value={leadSrc} onChange={(e) => setLeadSrc(e.target.value)} style={ST.select}>
          {leadOpts.map((c) => <option key={c} value={c}>{c === 'all' ? 'All channels' : c}</option>)}
        </select>
        <span style={ST.filterMeta}>{filtered.length} of {rows.length} rows</span>
      </div>

      {/* ── Table OR empty-state CTA ────────────────────────────────────── */}
      <Panel
        title={tab === 'all' ? 'All BTB accounts' : `${tab} accounts`}
        eyebrow={`${filtered.length} rows`}
        actions={<ArtifactActions context={{ kind: 'table', title: `${tab} accounts`, dept: 'sales' }} />}
      >
        {filtered.length === 0 ? (
          <EmptyTab tab={tab} hasAny={counts[tab as string] > 0} />
        ) : (
          <div
            style={ST.tableWrap}
            onClick={(e) => {
              // Row-click → open drawer. We delegate via data-rowkey
              // attribute on the name cell (since DataTable doesn't
              // expose row-click). The attribute survives sort changes.
              const tr = (e.target as HTMLElement).closest('tr.data-table-row');
              if (!tr) return;
              const tag = tr.querySelector('[data-rowkey]') as HTMLElement | null;
              const k = tag?.dataset.rowkey;
              if (k) setOpenKey(k);
            }}
          >
            <DataTable<Account>
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.key}
              defaultSort={{ key: 'name', dir: 'asc' }}
              emptyState="No accounts match the current filters."
            />
          </div>
        )}
      </Panel>

      {/* ── Drawer ──────────────────────────────────────────────────────── */}
      <AccountDrawer account={openAcct} onClose={() => setOpenKey(null)} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Drawer (right-side slide-in)
// ────────────────────────────────────────────────────────────────────────────

function AccountDrawer({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const open = !!account;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          ...ST.drawerBackdrop,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />
      <aside
        style={{
          ...ST.drawer,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}
        role="dialog"
        aria-label="Account detail"
      >
        <header style={ST.drawerHead}>
          <span style={ST.drawerEyebrow}>BTB account</span>
          <button onClick={onClose} style={ST.drawerClose} aria-label="Close">✕</button>
        </header>

        {!account ? (
          <div style={ST.drawerEmpty}>—</div>
        ) : (
          <div style={ST.drawerBody}>
            <div style={ST.drawerHero}>
              <div style={ST.drawerType}>{account.type}</div>
              <h2 style={ST.drawerName}>{account.name}</h2>
              <div style={ST.drawerSub}>
                {account.flag ? `${account.flag} ` : ''}{account.country ?? EMPTY}
                {' · '}
                <StatusPill tone={statusTone(account.status)}>{account.statusLabel}</StatusPill>
              </div>
            </div>

            <div style={ST.drawerKv}>
              {account.detail.map((row, i) => (
                <div key={i} style={ST.kvRow}>
                  <span style={ST.kvKey}>{row.k}</span>
                  <span style={ST.kvVal}>{row.v ?? EMPTY}</span>
                </div>
              ))}
            </div>

            {account.deepLink && (
              <a href={account.deepLink} style={ST.deepLink}>
                Open full record →
              </a>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Empty state
// ────────────────────────────────────────────────────────────────────────────

function EmptyTab({ tab, hasAny }: { tab: 'all' | AccountType; hasAny: boolean }) {
  if (hasAny) {
    return <div style={ST.empty}>No accounts match the current filters. Reset country / status / channel above.</div>;
  }
  // Tab has zero accounts in source. Show CTA.
  const cta: Record<AccountType | 'all', { msg: string; href: string; label: string }> = {
    all: { msg: 'No accounts on file.', href: '/sales/b2b', label: 'Open contracts area' },
    MICE: {
      msg: 'No MICE leads yet. Tag a group with offsite / corporate / leadership / incentive in its name to surface it here, or create a new group block.',
      href: '/sales/groups',
      label: 'Set up first MICE block',
    },
    DMC: {
      msg: 'No DMC contracts on file. Upload your first contract to start tracking partner performance.',
      href: '/sales/b2b',
      label: 'Upload first DMC contract',
    },
    Retreat: {
      msg: 'No retreat programs configured. Add the first program in marketing.retreat_programs.',
      href: '/marketing/compiler/retreats',
      label: 'Set up first retreat',
    },
    Group: {
      msg: 'No group blocks yet. Groups sync from Cloudbeds — add a block in Cloudbeds Connect, then refresh.',
      href: '/sales/groups',
      label: 'Open Groups page',
    },
  };
  const c = cta[tab];
  return (
    <div style={ST.empty}>
      <div style={ST.emptyMsg}>{c.msg}</div>
      <a href={c.href} style={ST.emptyCta}>{c.label}</a>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function statusTone(s: Account['status']): StatusTone {
  switch (s) {
    case 'active':   return 'active';
    case 'pending':  return 'pending';
    case 'expired':  return 'expired';
    case 'inactive': return 'inactive';
    case 'info':     return 'info';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Inline styles — token-driven, no hardcoded fontSize literals.
// ────────────────────────────────────────────────────────────────────────────

const ST: Record<string, React.CSSProperties> = {
  kpiStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
    marginBottom: 14,
  },
  pillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  pillIdle: {
    background: 'transparent',
    border: '1px solid #2a2520',
    color: '#d8cca8',
    padding: '6px 12px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    fontWeight: 700,
    borderRadius: 4,
    cursor: 'pointer',
  },
  pillActive: {
    background: '#a8854a',
    border: '1px solid #a8854a',
    color: '#0a0a0a',
    padding: '6px 12px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    fontWeight: 700,
    borderRadius: 4,
    cursor: 'pointer',
  },
  pillCount: {
    marginLeft: 6,
    opacity: 0.65,
    fontVariantNumeric: 'tabular-nums',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginBottom: 14,
  },
  search: {
    background: '#0f0d0a',
    border: '1px solid #2a2520',
    color: '#d8cca8',
    padding: '6px 10px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-sm)',
    borderRadius: 4,
    flex: '1 1 220px',
    minWidth: 200,
  },
  select: {
    background: '#0f0d0a',
    border: '1px solid #2a2520',
    color: '#d8cca8',
    padding: '6px 10px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-loose)',
    textTransform: 'uppercase',
    borderRadius: 4,
    cursor: 'pointer',
  },
  filterMeta: {
    color: '#7d7565',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-loose)',
    textTransform: 'uppercase',
  },
  tableWrap: { cursor: 'pointer' },
  nameCell: { display: 'flex', flexDirection: 'column', gap: 2 },
  nameStrong: { color: 'var(--ink)' },
  contactSub: {
    color: '#7d7565',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-loose)',
  },
  typeBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    border: '1px solid #2a261d',
    borderRadius: 3,
    color: 'var(--brass)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  muted: { color: '#7d7565' },
  empty: {
    padding: 32,
    color: '#9b907a',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  emptyMsg: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: 'italic',
    fontSize: 'var(--t-md)',
    maxWidth: 480,
    lineHeight: 1.5,
  },
  emptyCta: {
    background: '#a8854a',
    color: '#0a0a0a',
    padding: '8px 16px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    fontWeight: 700,
    borderRadius: 4,
    textDecoration: 'none',
  },

  // Drawer
  drawerBackdrop: {
    position: 'fixed', inset: 0, zIndex: 40,
    background: 'rgba(10, 10, 10, 0.6)',
    transition: 'opacity 200ms ease',
  },
  drawer: {
    position: 'fixed', right: 0, top: 0, bottom: 0,
    width: '100%', maxWidth: 520,
    background: '#0f0d0a',
    borderLeft: '1px solid #1f1c15',
    boxShadow: '-12px 0 28px rgba(0, 0, 0, 0.5)',
    zIndex: 50,
    transition: 'transform 240ms ease',
    display: 'flex', flexDirection: 'column',
  },
  drawerHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px',
    borderBottom: '1px solid #1f1c15',
  },
  drawerEyebrow: {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    color: 'var(--brass)',
  },
  drawerClose: {
    background: 'transparent',
    border: '1px solid #2a261d',
    color: '#9b907a',
    cursor: 'pointer',
    padding: '4px 10px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    borderRadius: 4,
  },
  drawerEmpty: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#7d7565',
  },
  drawerBody: { flex: 1, overflowY: 'auto', padding: '18px 20px' },
  drawerHero: {
    paddingBottom: 14,
    borderBottom: '1px solid #1f1c15',
    marginBottom: 16,
  },
  drawerType: {
    display: 'inline-block',
    padding: '2px 8px',
    border: '1px solid #2a261d',
    borderRadius: 3,
    color: 'var(--brass)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    fontWeight: 700,
    marginBottom: 6,
  },
  drawerName: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: 'italic',
    fontWeight: 400,
    color: '#e9e1ce',
    fontSize: 'var(--t-2xl)',
    margin: 0,
    marginBottom: 6,
  },
  drawerSub: {
    color: '#9b907a',
    fontSize: 'var(--t-sm)',
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  },
  drawerKv: {
    display: 'grid', gap: 10,
  },
  kvRow: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: 12,
    paddingBottom: 8,
    borderBottom: '1px dashed #1f1c15',
  },
  kvKey: {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    color: 'var(--brass)',
  },
  kvVal: {
    color: '#d8cca8',
    fontSize: 'var(--t-sm)',
  },
  deepLink: {
    display: 'inline-block',
    marginTop: 18,
    color: 'var(--brass)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    fontWeight: 700,
    textDecoration: 'none',
    border: '1px solid #2a261d',
    padding: '6px 12px',
    borderRadius: 4,
  },
};
