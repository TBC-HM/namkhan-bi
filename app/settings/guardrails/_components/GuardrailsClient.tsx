'use client';
// app/settings/guardrails/_components/GuardrailsClient.tsx
// PBS 2026-07-06 v2:
//   · 10 domain sections always visible (empty state with "add first" CTA when no rules)
//   · Add-rule form per section (POST /api/guardrail/create)
//   · Delete (soft, active=false) per row via existing /api/guardrail/update
//   · Dynamic rules render with lock icon + tooltip and no editable inputs
//   · Coloured pill per domain drawn from Namkhan token palette
//   · Top summary strip (total · active · last updated · biggest domain)

import { useState, useMemo } from 'react';
import type { RuleStatus } from '@/lib/rules/wiring';
import { PAGES_BY_DOMAIN, pageForRule, type PageDescriptor } from '@/lib/guardrails/pageMap';

interface Row {
  id: number;
  domain: string;
  rule_key: string;
  threshold_kind: string;
  threshold_val: number | string;
  active: boolean;
  is_dynamic: boolean;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface Stats {
  total: number;
  activeCount: number;
  liveCount: number;
  missingCount: number;
  lastUpdatedLabel: string;
  lastUpdatedRuleLabel: string;
  biggestDomain: string;
  biggestCount: number;
}

// Canonical 10 domains — order + label + pill colour.
// Colours pulled from Namkhan palette (green revenue · amber marketing · brass contacts · red-brown ops · grey admin etc.).
const DOMAINS: Array<{ key: string; label: string; pillBg: string; pillFg: string }> = [
  { key: 'sales',        label: 'Sales',           pillBg: '#0F5B4B', pillFg: '#FFFFFF' },
  { key: 'revenue',      label: 'Revenue',         pillBg: '#0A7A4A', pillFg: '#FFFFFF' },
  { key: 'marketing',    label: 'Marketing',       pillBg: '#B87333', pillFg: '#FFFFFF' },
  { key: 'contacts',     label: 'Contacts',        pillBg: '#A88A5C', pillFg: '#FFFFFF' },
  { key: 'operations',   label: 'Operations',      pillBg: '#8B4A2F', pillFg: '#FFFFFF' },
  { key: 'finance',      label: 'Administration',  pillBg: '#3A3A3A', pillFg: '#FFFFFF' },
  { key: 'reputation',   label: 'Reputation',      pillBg: '#5A4C93', pillFg: '#FFFFFF' },
  { key: 'retention',    label: 'Retention',       pillBg: '#0848A0', pillFg: '#FFFFFF' },
  { key: 'newsletter',   label: 'Newsletter',      pillBg: '#7A5C1F', pillFg: '#FFFFFF' },
  { key: 'observations', label: 'Observations',    pillBg: '#5A5A5A', pillFg: '#FFFFFF' },
];

const KIND_LABEL: Record<string, string> = { gte: '≥', lte: '≤', eq: '=' };

export default function GuardrailsClient({
  rows: initial,
  stats,
  statusById = {},
}: {
  rows: Row[];
  stats: Stats;
  statusById?: Record<number, RuleStatus>;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState<Record<string, boolean>>({});
  const [addForm, setAddForm] = useState<Record<string, { rule_key: string; threshold_kind: string; threshold_val: string; notes: string }>>({});
  const [creatingDomain, setCreatingDomain] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // PBS 2026-07-17: dept-tab scoping. Only render the ACTIVE dept's block on screen.
  // Default = revenue (most guardrails today).
  const [activeDomain, setActiveDomain] = useState<string>('revenue');

  // Per-domain rule counts for the dept tab strip badges.
  const rulesByDomain = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.domain, (m.get(r.domain) ?? 0) + 1);
    return m;
  }, [rows]);

  const setRow = (id: number, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (row: Row) => {
    setSavingId(row.id);
    setMsg(null);
    try {
      const res = await fetch('/api/guardrail/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: row.domain,
          rule_key: row.rule_key,
          threshold_val: Number(row.threshold_val),
          active: row.active,
          notes: row.notes ?? '',
        }),
      });
      const j = await res.json();
      if (j.ok) setMsg({ kind: 'ok', text: `Saved ${row.domain} · ${row.rule_key}` });
      else setMsg({ kind: 'err', text: j.error ?? 'update failed' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSavingId(null);
    }
  };

  const softDelete = async (row: Row) => {
    if (!confirm(`Deactivate ${row.domain} · ${row.rule_key}? (soft delete — row stays in DB with active=false)`)) return;
    setDeletingId(row.id);
    setMsg(null);
    try {
      const res = await fetch('/api/guardrail/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: row.domain,
          rule_key: row.rule_key,
          threshold_val: Number(row.threshold_val),
          active: false,
          notes: row.notes ?? '',
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setRow(row.id, { active: false });
        setMsg({ kind: 'ok', text: `Deactivated ${row.domain} · ${row.rule_key}` });
      } else {
        setMsg({ kind: 'err', text: j.error ?? 'delete failed' });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setDeletingId(null);
    }
  };

  const openAdd = (domain: string) => {
    setShowAdd(prev => ({ ...prev, [domain]: true }));
    setAddForm(prev => ({
      ...prev,
      [domain]: prev[domain] ?? { rule_key: '', threshold_kind: 'gte', threshold_val: '', notes: '' },
    }));
  };

  const cancelAdd = (domain: string) => {
    setShowAdd(prev => ({ ...prev, [domain]: false }));
  };

  const submitAdd = async (domain: string) => {
    const f = addForm[domain];
    if (!f || !f.rule_key.trim() || !Number.isFinite(Number(f.threshold_val))) {
      setMsg({ kind: 'err', text: 'rule_key and numeric threshold required' });
      return;
    }
    setCreatingDomain(domain);
    setMsg(null);
    try {
      const res = await fetch('/api/guardrail/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          rule_key: f.rule_key.trim(),
          threshold_kind: f.threshold_kind,
          threshold_val: Number(f.threshold_val),
          notes: f.notes ?? '',
        }),
      });
      const j = await res.json();
      if (j.ok) {
        // Optimistically append the row (or replace if it upserted)
        const newRow: Row = {
          id: j.id,
          domain,
          rule_key: f.rule_key.trim(),
          threshold_kind: f.threshold_kind,
          threshold_val: Number(f.threshold_val),
          active: true,
          is_dynamic: false,
          notes: f.notes ?? null,
          updated_at: new Date().toISOString(),
          updated_by: 'settings_ui',
        };
        setRows(prev => {
          const idx = prev.findIndex(r => r.domain === domain && r.rule_key === newRow.rule_key);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...newRow };
            return next;
          }
          return [...prev, newRow];
        });
        setShowAdd(prev => ({ ...prev, [domain]: false }));
        setAddForm(prev => ({ ...prev, [domain]: { rule_key: '', threshold_kind: 'gte', threshold_val: '', notes: '' } }));
        setMsg({ kind: 'ok', text: `Added ${domain} · ${newRow.rule_key}` });
      } else {
        setMsg({ kind: 'err', text: j.error ?? 'create failed' });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCreatingDomain(null);
    }
  };

  // Group rows by domain — but ALWAYS render every DOMAINS entry (empty state when no rows)
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = groups.get(r.domain) ?? [];
    arr.push(r);
    groups.set(r.domain, arr);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top summary strip */}
      <div style={topStrip}>
        <StatBlock label="Total rules" value={String(stats.total)} />
        <StatBlock label="Active" value={`${stats.activeCount} / ${stats.total}`} />
        <StatBlock
          label="Live / Missing"
          value={`${stats.liveCount} / ${stats.missingCount}`}
          sub="green = wired · red = not-wired or data missing"
        />
        <StatBlock label="Last updated" value={stats.lastUpdatedLabel} sub={stats.lastUpdatedRuleLabel} />
      </div>

      {msg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            fontSize: 12,
            background: msg.kind === 'ok' ? '#F0F7F2' : '#FFF3F1',
            color: msg.kind === 'ok' ? '#084838' : '#B04A2F',
            border: '1px solid ' + (msg.kind === 'ok' ? '#0848380F' : '#B04A2F33'),
          }}
        >
          {msg.text}
        </div>
      )}

      {/* PBS 2026-07-17: dept tab strip — click a dept to focus its rules. */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid #E6DFCC', paddingBottom: 8 }}>
        {DOMAINS.map((d) => {
          const active = d.key === activeDomain;
          const count = rulesByDomain.get(d.key) ?? 0;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setActiveDomain(d.key)}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${active ? d.pillBg : '#E6DFCC'}`,
                background: active ? d.pillBg : '#FFFFFF',
                color: active ? d.pillFg : '#3A3A3A',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              {d.label}
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 99,
                background: active ? 'rgba(255,255,255,0.24)' : '#F5F0E1',
                color: active ? d.pillFg : '#5A5A5A',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {DOMAINS.filter((d) => d.key === activeDomain).map(d => {
        const list = groups.get(d.key) ?? [];
        const isAdding = showAdd[d.key];
        const f = addForm[d.key] ?? { rule_key: '', threshold_kind: 'gte', threshold_val: '', notes: '' };
        return (
          <div key={d.key} style={box}>
            <div style={header}>
              <span style={{ ...pill, background: d.pillBg, color: d.pillFg }}>{d.label}</span>
              <span style={{ marginLeft: 8, fontSize: 10, color: '#5A5A5A' }}>
                {list.length} rule{list.length === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => (isAdding ? cancelAdd(d.key) : openAdd(d.key))}
                style={{ ...btnGhost, marginLeft: 'auto' }}
              >
                {isAdding ? 'Cancel' : '+ Add rule'}
              </button>
            </div>

            {isAdding && (
              <div style={addRow}>
                <input
                  type="text"
                  placeholder="rule_key (e.g. open_rate_min)"
                  value={f.rule_key}
                  onChange={e => setAddForm(prev => ({ ...prev, [d.key]: { ...f, rule_key: e.target.value } }))}
                  style={{ ...inp, width: 260, fontFamily: 'monospace' }}
                />
                <select
                  value={f.threshold_kind}
                  onChange={e => setAddForm(prev => ({ ...prev, [d.key]: { ...f, threshold_kind: e.target.value } }))}
                  style={{ ...inp, width: 70 }}
                >
                  <option value="gte">≥ gte</option>
                  <option value="lte">≤ lte</option>
                  <option value="eq">= eq</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="threshold"
                  value={f.threshold_val}
                  onChange={e => setAddForm(prev => ({ ...prev, [d.key]: { ...f, threshold_val: e.target.value } }))}
                  style={{ ...inp, width: 110 }}
                />
                <input
                  type="text"
                  placeholder="notes (optional)"
                  value={f.notes}
                  onChange={e => setAddForm(prev => ({ ...prev, [d.key]: { ...f, notes: e.target.value } }))}
                  style={{ ...inp, flex: 1 }}
                />
                <button
                  onClick={() => submitAdd(d.key)}
                  disabled={creatingDomain === d.key}
                  style={btnSave}
                >
                  {creatingDomain === d.key ? 'Adding…' : 'Add'}
                </button>
              </div>
            )}

            {/* PBS 2026-07-17: when the dept has a page map (starts w/ Revenue), render
                one mini-header per page + only that page's rules. Unassigned rules
                (rule_key not in RULE_PAGE_MAP) land in an "Unassigned" trailing block
                so they don't disappear — PBS or next PR assigns them. */}
            {(() => {
              const deptPages: PageDescriptor[] = PAGES_BY_DOMAIN[d.key] ?? [];
              // Fast-path: no page map for this dept → single flat table (legacy render).
              // Structural change is opt-in via pageMap.ts so we don't disturb other depts.
              if (deptPages.length === 0) {
                return null; // fall through to the legacy render below
              }
              // Build page groups + unassigned bucket.
              type Group = { page: PageDescriptor | null; rows: Row[] };
              const bySlug = new Map<string, Row[]>();
              const unassigned: Row[] = [];
              for (const r of list) {
                const pg = pageForRule(d.key, r.rule_key);
                if (!pg) { unassigned.push(r); continue; }
                const arr = bySlug.get(pg.page_slug) ?? [];
                arr.push(r);
                bySlug.set(pg.page_slug, arr);
              }
              const groupsInOrder: Group[] = [
                ...deptPages.map((p) => ({ page: p, rows: bySlug.get(p.page_slug) ?? [] })),
                { page: null, rows: unassigned },
              ];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {groupsInOrder.map((g) => {
                    const label = g.page ? g.page.page_label : 'Unassigned';
                    const href  = g.page?.page_href ?? null;
                    return (
                      <div key={g.page?.page_slug ?? 'unassigned'} style={pageBlock}>
                        <div style={pageBlockHeader}>
                          <span style={pageBlockTitle}>{label}</span>
                          <span style={pageBlockCount}>{g.rows.length} rule{g.rows.length === 1 ? '' : 's'}</span>
                          {href && (
                            <a href={href} style={pageBlockLink} title={`Open ${label}`}>↗ open page</a>
                          )}
                        </div>
                        {g.rows.length === 0 ? (
                          <div style={pageBlockEmpty}>
                            No rules yet on this page.
                          </div>
                        ) : (
                          <div style={{ padding: '4px 0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th style={th}>Rule</th>
                                  <th style={th}>Kind</th>
                                  <th style={th}>Threshold</th>
                                  <th style={th}>Active</th>
                                  <th style={th}>Notes</th>
                                  <th style={th}>Updated</th>
                                  <th style={th}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.rows.map(r => {
                                  const isDyn = r.is_dynamic || /dynamic|rolling/i.test(r.notes ?? '');
                                  const dimmed = !r.active;
                                  const st = statusById[r.id];
                                  const dotBg =
                                    st?.status === 'live' ? '#1F8A4C' :
                                    st?.status === 'data_missing' ? '#B04A2F' :
                                    st?.status === 'not_wired' ? '#C4A06B' :
                                    '#5A5A5A';
                                  const dotTitle = st ? `${st.status.toUpperCase()} · ${st.reason ?? ''}` : 'Status not computed';
                                  return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #F5F0E1', opacity: dimmed ? 0.5 : 1 }}>
                                      <td style={{ ...td, fontFamily: 'monospace', color: '#3A3A3A' }}>
                                        <span title={dotTitle} style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: dotBg, marginRight: 8, verticalAlign: 'middle', cursor: 'help' }} />
                                        {isDyn && <span title="Dynamic threshold — controlled by rolling baseline logic" style={{ marginRight: 6, cursor: 'help' }}>🔒</span>}
                                        {r.rule_key}
                                      </td>
                                      <td style={td}>{KIND_LABEL[r.threshold_kind] ?? r.threshold_kind}</td>
                                      <td style={td}>
                                        {isDyn ? (
                                          <span style={{ fontStyle: 'italic', color: '#5A5A5A' }}>dynamic · {String(r.threshold_val)}</span>
                                        ) : (
                                          <input type="number" step="0.01" value={String(r.threshold_val)} onChange={e => setRow(r.id, { threshold_val: e.target.value })} style={inp} />
                                        )}
                                      </td>
                                      <td style={td}>
                                        <input type="checkbox" checked={r.active} onChange={e => setRow(r.id, { active: e.target.checked })} disabled={isDyn} />
                                      </td>
                                      <td style={td}>
                                        <input type="text" value={r.notes ?? ''} onChange={e => setRow(r.id, { notes: e.target.value })} style={{ ...inp, width: 260 }} disabled={isDyn} />
                                      </td>
                                      <td style={{ ...td, fontSize: 10, color: '#5A5A5A' }}>
                                        {r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-GB') : '—'}
                                        {r.updated_by ? <div>{r.updated_by}</div> : null}
                                      </td>
                                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                        <button onClick={() => save(r)} disabled={savingId === r.id || isDyn} style={{ ...btnSave, opacity: isDyn ? 0.4 : 1, cursor: isDyn ? 'not-allowed' : 'pointer' }}>
                                          {savingId === r.id ? 'Saving…' : 'Save'}
                                        </button>
                                        <button onClick={() => softDelete(r)} disabled={deletingId === r.id || !r.active} style={{ ...btnDanger, marginLeft: 6, opacity: !r.active ? 0.4 : 1 }} title={r.active ? 'Soft delete (sets active=false)' : 'Already inactive'}>
                                          {deletingId === r.id ? '…' : 'Delete'}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Legacy render for depts without a pageMap — flat single-table. */}
            {(PAGES_BY_DOMAIN[d.key] ?? []).length === 0 && (list.length === 0 ? (
              <div style={emptyState}>
                <span style={{ color: '#5A5A5A' }}>No rules yet in {d.label}.</span>
                {!isAdding && (
                  <button onClick={() => openAdd(d.key)} style={{ ...btnGhost, marginLeft: 12 }}>
                    Add first rule
                  </button>
                )}
              </div>
            ) : (
              <div style={{ padding: '4px 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={th}>Rule</th>
                      <th style={th}>Kind</th>
                      <th style={th}>Threshold</th>
                      <th style={th}>Active</th>
                      <th style={th}>Notes</th>
                      <th style={th}>Updated</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(r => {
                      const isDyn = r.is_dynamic || /dynamic|rolling/i.test(r.notes ?? '');
                      const dimmed = !r.active;
                      const st = statusById[r.id];
                      const dotBg =
                        st?.status === 'live' ? '#1F8A4C' :
                        st?.status === 'data_missing' ? '#B04A2F' :
                        st?.status === 'not_wired' ? '#C4A06B' :
                        '#5A5A5A';
                      const dotTitle = st
                        ? `${st.status.toUpperCase()} · ${st.reason ?? ''}`
                        : 'Status not computed';
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #F5F0E1', opacity: dimmed ? 0.5 : 1 }}>
                          <td style={{ ...td, fontFamily: 'monospace', color: '#3A3A3A' }}>
                            <span
                              title={dotTitle}
                              style={{
                                display: 'inline-block',
                                width: 9, height: 9,
                                borderRadius: '50%',
                                background: dotBg,
                                marginRight: 8,
                                verticalAlign: 'middle',
                                cursor: 'help',
                              }}
                            />
                            {isDyn && (
                              <span
                                title="Dynamic threshold — controlled by rolling baseline logic, edits ignored"
                                style={{ marginRight: 6, cursor: 'help' }}
                              >
                                🔒
                              </span>
                            )}
                            {r.rule_key}
                          </td>
                          <td style={td}>{KIND_LABEL[r.threshold_kind] ?? r.threshold_kind}</td>
                          <td style={td}>
                            {isDyn ? (
                              <span style={{ fontStyle: 'italic', color: '#5A5A5A' }}>
                                dynamic · {String(r.threshold_val)}
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                value={String(r.threshold_val)}
                                onChange={e => setRow(r.id, { threshold_val: e.target.value })}
                                style={inp}
                              />
                            )}
                          </td>
                          <td style={td}>
                            <input
                              type="checkbox"
                              checked={r.active}
                              onChange={e => setRow(r.id, { active: e.target.checked })}
                              disabled={isDyn}
                            />
                          </td>
                          <td style={td}>
                            <input
                              type="text"
                              value={r.notes ?? ''}
                              onChange={e => setRow(r.id, { notes: e.target.value })}
                              style={{ ...inp, width: 260 }}
                              disabled={isDyn}
                            />
                          </td>
                          <td style={{ ...td, fontSize: 10, color: '#5A5A5A' }}>
                            {r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-GB') : '—'}
                            {r.updated_by ? <div>{r.updated_by}</div> : null}
                          </td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => save(r)}
                              disabled={savingId === r.id || isDyn}
                              style={{ ...btnSave, opacity: isDyn ? 0.4 : 1, cursor: isDyn ? 'not-allowed' : 'pointer' }}
                            >
                              {savingId === r.id ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={() => softDelete(r)}
                              disabled={deletingId === r.id || !r.active}
                              style={{ ...btnDanger, marginLeft: 6, opacity: !r.active ? 0.4 : 1 }}
                              title={r.active ? 'Soft delete (sets active=false)' : 'Already inactive'}
                            >
                              {deletingId === r.id ? '…' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#5A5A5A', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1B1B1B', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function labelForDomain(key: string): string {
  const found = DOMAINS.find(d => d.key === key);
  return found?.label ?? key;
}

const topStrip: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 12,
};
const statBox: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E6DFCC',
  borderRadius: 6,
  padding: '12px 16px',
};
const box: React.CSSProperties = {
  border: '1px solid #E6DFCC',
  borderRadius: 6,
  background: '#FFFFFF',
  overflow: 'hidden',
};
const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  background: '#FAFAF7',
  borderBottom: '1px solid #E6DFCC',
};
const pill: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  borderRadius: 99,
  textTransform: 'uppercase',
};
const th: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  borderBottom: '1px solid #E6DFCC',
  color: '#3A3A3A',
  fontSize: 11,
};
const td: React.CSSProperties = { padding: '6px 12px', color: '#1B1B1B', fontSize: 12 };
const inp: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  border: '1px solid #E6DFCC',
  borderRadius: 3,
  background: '#FFFFFF',
  color: '#1B1B1B',
  width: 80,
};
const btnSave: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 11,
  fontWeight: 600,
  background: '#084838',
  color: '#FFFFFF',
  border: '1px solid #084838',
  borderRadius: 3,
  cursor: 'pointer',
};
const btnDanger: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  background: '#FFFFFF',
  color: '#B04A2F',
  border: '1px solid #B04A2F',
  borderRadius: 3,
  cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  background: '#FFFFFF',
  color: '#3A3A3A',
  border: '1px solid #E6DFCC',
  borderRadius: 3,
  cursor: 'pointer',
};
const emptyState: React.CSSProperties = {
  padding: '18px 14px',
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  color: '#5A5A5A',
};
const addRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '10px 14px',
  background: '#FAFAF7',
  borderBottom: '1px solid #E6DFCC',
  alignItems: 'center',
};

// PBS 2026-07-17: per-page sub-block styles (used within Revenue tab).
const pageBlock: React.CSSProperties = {
  border: '1px solid #E6DFCC',
  borderRadius: 6,
  background: '#FDFCF8',
  overflow: 'hidden',
};
const pageBlockHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  background: '#F5F0E1',
  borderBottom: '1px solid #E6DFCC',
  fontSize: 12,
};
const pageBlockTitle: React.CSSProperties = {
  fontWeight: 700,
  color: '#1B1B1B',
  letterSpacing: '0.02em',
};
const pageBlockCount: React.CSSProperties = {
  fontSize: 11,
  color: '#5A5A5A',
  padding: '1px 8px',
  borderRadius: 99,
  background: '#FFFFFF',
  border: '1px solid #E6DFCC',
};
const pageBlockLink: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: 11,
  color: '#084838',
  textDecoration: 'none',
  fontWeight: 600,
  letterSpacing: '0.04em',
};
const pageBlockEmpty: React.CSSProperties = {
  padding: '14px',
  fontSize: 12,
  color: '#8A8A8A',
  fontStyle: 'italic',
};
