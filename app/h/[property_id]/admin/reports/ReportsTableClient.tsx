'use client';
import { useState, useMemo } from 'react';

export type KnownReport = { label: string; category: string };
export type CatalogRow = {
  report_id: number;
  snapshot_count: number;
  total_rows: number;
  last_synced_at: string | null;
  earliest_date: string | null;
  latest_date: string | null;
};
export type ReportRow = { id: number; meta: KnownReport; synced: CatalogRow | null };

interface Props {
  rows: ReportRow[];
  propertyId: number;
}

const CATEGORIES = ['All', 'Revenue', 'Finance', 'Ledger', 'Transactions', 'Operations', 'Guests', 'Management'];
type SortCol = 'id' | 'report' | 'category' | 'lastSync' | 'rows';
type SortDir = 'asc' | 'desc';

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const m = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days < 30 ? `${days}d ago` : d.toISOString().slice(0, 10);
}

function fmtNum(n: string | number | null | undefined): string {
  if (n == null) return '—';
  const num = Number(n);
  return Number.isFinite(num) ? num.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
}

function catColor(cat: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    Revenue:      { background: 'rgba(31,58,46,0.08)',  color: '#1F3A2E' },
    Finance:      { background: 'rgba(184,88,42,0.08)', color: '#B8542A' },
    Ledger:       { background: 'rgba(68,85,200,0.08)', color: '#4455C8' },
    Transactions: { background: 'rgba(90,90,90,0.08)',  color: '#3A3A3A' },
    Operations:   { background: 'rgba(140,100,40,0.08)',color: '#8C6428' },
    Guests:       { background: 'rgba(68,140,200,0.08)',color: '#1A6EAA' },
    Management:   { background: 'rgba(100,60,180,0.08)',color: '#643CB4' },
  };
  return map[cat] ?? { background: 'rgba(90,90,90,0.06)', color: '#5A5A5A' };
}

type SendState = 'idle' | 'loading' | 'done' | 'error';

export default function ReportsTableClient({ rows, propertyId }: Props) {
  const [catFilter, setCatFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');  // All | Synced | Not Synced
  const [actionFilter, setActionFilter] = useState('All');  // All | Has CSV | Needs Sync
  const [sortCol, setSortCol] = useState<SortCol>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [scheduleEmail, setScheduleEmail] = useState('');
  const [sendStates, setSendStates] = useState<Record<number, SendState>>({});
  const [sendError, setSendError] = useState('');

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    let r = rows;
    if (catFilter !== 'All') r = r.filter(x => x.meta.category === catFilter);
    if (statusFilter === 'Synced') r = r.filter(x => !!x.synced);
    if (statusFilter === 'Not Synced') r = r.filter(x => !x.synced);
    if (actionFilter === 'Has CSV') r = r.filter(x => x.synced && Number(x.synced.total_rows) > 0);
    if (actionFilter === 'Needs Sync') r = r.filter(x => !x.synced);
    return r;
  }, [rows, catFilter, statusFilter, actionFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortCol) {
        case 'id': return (a.id - b.id) * dir;
        case 'report': return a.meta.label.localeCompare(b.meta.label) * dir;
        case 'category': return a.meta.category.localeCompare(b.meta.category) * dir;
        case 'lastSync': {
          const ta = a.synced?.last_synced_at ?? '';
          const tb = b.synced?.last_synced_at ?? '';
          return ta.localeCompare(tb) * dir;
        }
        case 'rows': return ((Number(a.synced?.total_rows ?? 0)) - (Number(b.synced?.total_rows ?? 0))) * dir;
        default: return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

  async function handleSend(id: number) {
    setSendStates(s => ({ ...s, [id]: 'loading' }));
    setSendError('');
    try {
      const res = await fetch(`/api/admin/reports/send-email?property_id=${propertyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: id, email: scheduleEmail }),
      });
      if (res.ok) {
        setSendStates(s => ({ ...s, [id]: 'done' }));
        setScheduleId(null);
        setScheduleEmail('');
      } else {
        const j = await res.json().catch(() => ({}));
        setSendError(j.error ?? `Error ${res.status}`);
        setSendStates(s => ({ ...s, [id]: 'error' }));
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Network error');
      setSendStates(s => ({ ...s, [id]: 'error' }));
    }
  }

  const sortIndicator = (col: SortCol) =>
    sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div>
      {/* Filter bar */}
      <div style={filterBar}>
        <label style={filterLabel}>Category</label>
        <select style={filterSelect} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={filterLabel}>Status</label>
        <select style={filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {['All', 'Synced', 'Not Synced'].map(s => <option key={s}>{s}</option>)}
        </select>
        <label style={filterLabel}>Action</label>
        <select style={filterSelect} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          {['All', 'Has CSV', 'Needs Sync'].map(a => <option key={a}>{a}</option>)}
        </select>
        <span style={filterCount}>{sorted.length} / {rows.length}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadRow}>
              <th style={thSort} onClick={() => toggleSort('id')}>ID{sortIndicator('id')}</th>
              <th style={thSort} onClick={() => toggleSort('report')}>Report{sortIndicator('report')}</th>
              <th style={thSort} onClick={() => toggleSort('category')}>Category{sortIndicator('category')}</th>
              <th style={th}>Status</th>
              <th style={th}>Date range</th>
              <th style={thSort} onClick={() => toggleSort('rows')}>Rows{sortIndicator('rows')}</th>
              <th style={thSort} onClick={() => toggleSort('lastSync')}>Last sync{sortIndicator('lastSync')}</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ id, meta, synced }) => {
              const hasData = synced && Number(synced.total_rows ?? 0) > 0;
              const downloadUrl = `/api/admin/reports/download?property_id=${propertyId}&report_id=${id}`;
              const sending = sendStates[id];
              const isOpen = scheduleId === id;

              return (
                <tr key={id} style={{ ...trRow, opacity: synced ? 1 : 0.5 }}>
                  <td style={tdMono}>{id}</td>
                  <td style={tdLeft}><span style={{ fontWeight: 500 }}>{meta.label}</span></td>
                  <td style={tdLeft}>
                    <span style={{ ...catPill, ...catColor(meta.category) }}>{meta.category}</span>
                  </td>
                  <td style={tdLeft}>
                    {synced
                      ? <span style={syncedBadge}>✓ Synced</span>
                      : <span style={notSyncedBadge}>Not synced</span>}
                  </td>
                  <td style={tdLeft}>
                    {synced ? (
                      <span style={{ fontSize: 11, color: 'var(--tbl-fg-mute, #5A5A5A)', fontVariantNumeric: 'tabular-nums' }}>
                        {synced.earliest_date} → {synced.latest_date}
                      </span>
                    ) : (
                      <code style={{ fontSize: 9, color: 'var(--tbl-fg-mute, #5A5A5A)', wordBreak: 'break-all' }}>
                        {`{"scope":"stock_report","propertyID":${propertyId},"reportId":${id}}`}
                      </code>
                    )}
                  </td>
                  <td style={tdRight}>{synced ? fmtNum(synced.total_rows) : '—'}</td>
                  <td style={tdLeft}>
                    <span style={{ fontSize: 11, color: 'var(--tbl-fg-mute, #5A5A5A)' }}>
                      {relTime(synced?.last_synced_at ?? null)}
                    </span>
                  </td>
                  <td style={{ ...tdLeft, minWidth: 140 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {hasData && <a href={downloadUrl} style={downloadBtn}>↓ CSV</a>}
                      {hasData && !isOpen && (
                        <button style={scheduleBtn}
                          onClick={() => { setScheduleId(id); setScheduleEmail(''); setSendStates(s => ({ ...s, [id]: 'idle' })); }}>
                          ✉ Email
                        </button>
                      )}
                      {!synced && <SyncButtonInline propertyId={propertyId} reportId={id} reportName={meta.label} />}
                      {synced && !hasData && <span style={{ fontSize: 10, color: 'var(--tbl-fg-mute,#8A8A8A)' }}>—</span>}
                    </div>
                    {isOpen && (
                      <div style={scheduleForm}>
                        <input
                          style={emailInput}
                          type="email"
                          placeholder="recipient@email.com"
                          value={scheduleEmail}
                          onChange={e => setScheduleEmail(e.target.value)}
                          disabled={sending === 'loading'}
                        />
                        <button
                          style={{ ...sendBtn, opacity: scheduleEmail && sending !== 'loading' ? 1 : 0.5 }}
                          disabled={!scheduleEmail || sending === 'loading'}
                          onClick={() => handleSend(id)}
                        >
                          {sending === 'loading' ? '…' : sending === 'done' ? '✓ Sent' : sending === 'error' ? '✗ Failed' : 'Send'}
                        </button>
                        <button style={cancelBtn} onClick={() => setScheduleId(null)}>✕</button>
                      </div>
                    )}
                    {isOpen && sending === 'error' && sendError && (
                      <div style={{ fontSize: 10, color: '#B8542A', marginTop: 4, maxWidth: 240 }}>{sendError}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SyncButtonInline({ propertyId, reportId, reportName }: { propertyId: number; reportId: number; reportName: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  async function handleSync() {
    setState('loading');
    try {
      const res = await fetch(`/api/admin/reports/sync?property_id=${propertyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, report_name: reportName }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch { setState('error'); }
  }
  if (state === 'done') return <span style={{ fontSize: 10, color: '#1F3A2E', fontWeight: 600 }}>✓ Syncing…</span>;
  if (state === 'error') return <span style={{ fontSize: 10, color: '#B8542A' }}>✗ Failed</span>;
  return (
    <button onClick={handleSync} disabled={state === 'loading'} style={{
      padding: '2px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
      background: state === 'loading' ? 'rgba(90,90,90,0.06)' : 'rgba(68,85,200,0.07)',
      color: state === 'loading' ? '#8A8A8A' : '#4455C8',
      border: `1px solid ${state === 'loading' ? 'rgba(90,90,90,0.15)' : 'rgba(68,85,200,0.25)'}`,
      borderRadius: 3, cursor: state === 'loading' ? 'default' : 'pointer', whiteSpace: 'nowrap',
    }}>
      {state === 'loading' ? '…' : '↻ Sync'}
    </button>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const filterBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 12px',
  flexWrap: 'wrap',
};
const filterLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--tbl-fg-mute,#5A5A5A)',
};
const filterSelect: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', borderRadius: 4,
  border: '1px solid var(--tbl-border,#E6DFCC)',
  background: 'var(--tbl-bg,#FAF6ED)',
  color: 'var(--tbl-fg,#1B1B1B)',
  cursor: 'pointer',
};
const filterCount: React.CSSProperties = {
  marginLeft: 'auto', fontSize: 10, color: 'var(--tbl-fg-mute,#5A5A5A)',
  fontVariantNumeric: 'tabular-nums',
};
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const theadRow: React.CSSProperties = { borderBottom: '1px solid var(--tbl-border,#E6DFCC)' };
const th: React.CSSProperties = {
  padding: '8px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--tbl-fg-mute,#5A5A5A)', textAlign: 'left', whiteSpace: 'nowrap',
};
const thSort: React.CSSProperties = { ...th, cursor: 'pointer', userSelect: 'none' };
const trRow: React.CSSProperties = { borderBottom: '1px solid var(--tbl-border,#E6DFCC)' };
const tdLeft: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: 'var(--tbl-fg,#1B1B1B)', verticalAlign: 'middle' };
const tdRight: React.CSSProperties = { ...tdLeft, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const tdMono: React.CSSProperties = { ...tdLeft, fontFamily: 'monospace', fontSize: 11, color: 'var(--tbl-fg-mute,#5A5A5A)' };
const catPill: React.CSSProperties = { display: 'inline-block', padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' };
const syncedBadge: React.CSSProperties = { display: 'inline-block', padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: 'rgba(31,58,46,0.08)', color: '#1F3A2E' };
const notSyncedBadge: React.CSSProperties = { display: 'inline-block', padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 500, background: 'rgba(90,90,90,0.06)', color: '#8A8A8A' };
const downloadBtn: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', background: 'rgba(31,58,46,0.06)', color: '#1F3A2E', border: '1px solid rgba(31,58,46,0.2)', borderRadius: 3, textDecoration: 'none', whiteSpace: 'nowrap' };
const scheduleBtn: React.CSSProperties = { padding: '2px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', background: 'rgba(68,85,200,0.06)', color: '#4455C8', border: '1px solid rgba(68,85,200,0.2)', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' };
const scheduleForm: React.CSSProperties = { display: 'flex', gap: 4, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' };
const emailInput: React.CSSProperties = { fontSize: 11, padding: '3px 8px', borderRadius: 3, border: '1px solid var(--tbl-border,#E6DFCC)', background: 'var(--tbl-bg,#FAF6ED)', color: 'var(--tbl-fg,#1B1B1B)', width: 200 };
const sendBtn: React.CSSProperties = { padding: '3px 10px', fontSize: 10, fontWeight: 600, background: 'rgba(31,58,46,0.08)', color: '#1F3A2E', border: '1px solid rgba(31,58,46,0.2)', borderRadius: 3, cursor: 'pointer' };
const cancelBtn: React.CSSProperties = { padding: '3px 7px', fontSize: 10, background: 'transparent', color: 'var(--tbl-fg-mute,#8A8A8A)', border: '1px solid var(--tbl-border,#E6DFCC)', borderRadius: 3, cursor: 'pointer' };
