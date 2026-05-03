'use client';

// Editable table for /finance/mapping. Each row exposes a class dropdown +
// optional note + Save button. On Save: POST /api/finance/mapping/upsert,
// then router.refresh() so the server component re-reads the view.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export interface ClassOption {
  class_id: string;
  label: string;
  section: string | null;
  department: string | null;
}

export interface MappingRow {
  account_id: string;
  account_name: string;
  usali_subcategory: string | null;
  usali_line_label: string | null;
  txns: number;
  usd_total: number;
  last_seen: string | null;
  is_unclear: boolean;
  current_class_id: string | null;
  current_class_name: string | null;
  override_class_id: string | null;
  override_class_name: string | null;
  override_note: string | null;
  override_updated_at: string | null;
}

interface Props {
  rows: MappingRow[];
  classes: ClassOption[];
  mode: 'unclear' | 'overridden' | 'standard';
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function suggestClass(row: MappingRow, classes: ClassOption[]): string {
  // Heuristic to pre-select a sensible class so the accountant only has to
  // confirm. Falls back to undistributed for safety.
  const sub = (row.usali_subcategory || '').toLowerCase();
  const name = (row.account_name || '').toLowerCase();
  if (/transport/.test(name)) return 'transport';
  if (/spa/.test(name)) return 'spa';
  if (/activity|activities/.test(name)) return 'activities';
  if (/mekong|cruise/.test(name)) return 'imekong';
  if (/retail|shop/.test(name)) return 'retail';
  if (/f&b|food|beverage|restaurant/.test(name)) return 'fb';
  if (/room|accommodation/.test(name)) return 'rooms';
  if (/^a&g$|payroll|pom|utilities|sales & marketing|mgmt fees|depreciation|interest|fx|non-operating|tax/.test(sub)) {
    return 'undistributed';
  }
  // unknown — first non-DQ option
  return classes.find(c => c.class_id !== 'not_specified')?.class_id ?? 'undistributed';
}

export default function MappingTable({ rows, classes, mode }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, { class_id: string; note: string; saving: boolean; error: string | null }>>(() => {
    const init: Record<string, any> = {};
    for (const r of rows) {
      init[r.account_id] = {
        class_id: r.override_class_id ?? (r.is_unclear ? suggestClass(r, classes) : r.current_class_id ?? 'undistributed'),
        note: r.override_note ?? '',
        saving: false,
        error: null,
      };
    }
    return init;
  });

  async function save(account_id: string) {
    const draft = drafts[account_id];
    if (!draft) return;
    setDrafts(d => ({ ...d, [account_id]: { ...d[account_id], saving: true, error: null } }));
    try {
      const res = await fetch('/api/finance/mapping/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id, class_id: draft.class_id, note: draft.note || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setDrafts(d => ({ ...d, [account_id]: { ...d[account_id], saving: false, error: null } }));
      startTransition(() => router.refresh());
    } catch (e: any) {
      setDrafts(d => ({ ...d, [account_id]: { ...d[account_id], saving: false, error: e?.message ?? 'failed' } }));
    }
  }

  const editable = mode !== 'standard';

  return (
    <div className="map-table-wrap">
      <table className="map-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>USALI subcat</th>
            <th className="num">Txns</th>
            <th className="num">$ impact</th>
            <th>Current</th>
            {editable && <th>New class</th>}
            {editable && <th>Note (optional)</th>}
            {editable && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const d = drafts[r.account_id];
            return (
              <tr key={r.account_id} className={r.is_unclear ? 'unclear' : ''}>
                <td>
                  <div className="acct-name">{r.account_name}</div>
                  <div className="acct-id">{r.account_id} · {r.usali_line_label ?? '—'}</div>
                </td>
                <td>{r.usali_subcategory ?? '—'}</td>
                <td className="num">{r.txns}</td>
                <td className="num">{fmtUsd(r.usd_total)}</td>
                <td>
                  <span className={`pill ${r.is_unclear ? 'pill-warn' : 'pill-ok'}`}>
                    {r.current_class_name ?? r.current_class_id ?? '—'}
                  </span>
                  {r.override_class_id && r.override_class_id !== r.current_class_id && (
                    <div className="override-hint">override: {r.override_class_name ?? r.override_class_id}</div>
                  )}
                </td>
                {editable && (
                  <td>
                    <select
                      value={d?.class_id ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [r.account_id]: { ...prev[r.account_id], class_id: e.target.value } }))}
                      disabled={d?.saving}
                    >
                      {classes
                        .filter(c => c.class_id !== 'not_specified')
                        .map(c => (
                          <option key={c.class_id} value={c.class_id}>{c.label}</option>
                        ))}
                    </select>
                  </td>
                )}
                {editable && (
                  <td>
                    <input
                      type="text"
                      placeholder="why this class?"
                      value={d?.note ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [r.account_id]: { ...prev[r.account_id], note: e.target.value } }))}
                      disabled={d?.saving}
                    />
                  </td>
                )}
                {editable && (
                  <td>
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() => save(r.account_id)}
                      disabled={d?.saving}
                    >
                      {d?.saving ? 'Saving…' : 'Save'}
                    </button>
                    {d?.error && <div className="err">{d.error}</div>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <style>{`
        .map-table-wrap { overflow-x: auto; border: 1px solid var(--line, #e7e2d8); border-radius: 8px; background: var(--card, #fff); }
        .map-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .map-table th { text-align: left; padding: 10px 12px; background: var(--surf-2, #f5f1e7); border-bottom: 1px solid var(--line, #e7e2d8); font-weight: 500; color: var(--ink-mute, #6a6353); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
        .map-table td { padding: 10px 12px; border-bottom: 1px solid var(--line-soft, #efeae0); vertical-align: top; }
        .map-table tbody tr:hover { background: var(--surf-hover, #faf7ee); }
        .map-table tr.unclear { background: rgba(217, 165, 78, .06); }
        .map-table tr.unclear:hover { background: rgba(217, 165, 78, .12); }
        .map-table .num { text-align: right; font-variant-numeric: tabular-nums; }
        .acct-name { font-weight: 500; }
        .acct-id { font-size: 11px; color: var(--ink-mute, #8a8170); margin-top: 2px; }
        .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; }
        .pill-warn { background: rgba(217, 165, 78, .15); color: #8a5e1a; }
        .pill-ok { background: rgba(46, 74, 54, .1); color: var(--green-2, #2e4a36); }
        .override-hint { font-size: 10px; color: var(--ink-mute, #8a8170); margin-top: 4px; font-style: italic; }
        .map-table select, .map-table input[type=text] {
          padding: 6px 8px; border: 1px solid var(--line, #d6d0c2); border-radius: 4px;
          font-size: 12px; min-width: 140px; background: var(--paper-warm);
        }
        .map-table input[type=text] { min-width: 180px; }
        .save-btn {
          padding: 6px 14px; background: var(--green-2, #2e4a36); color: #fff;
          border: none; border-radius: 4px; font-size: 12px; font-weight: 500;
          cursor: pointer; white-space: nowrap;
        }
        .save-btn:hover { background: var(--green-1, #1f3526); }
        .save-btn:disabled { background: var(--ink-mute, #8a8170); cursor: not-allowed; }
        .err { font-size: 11px; color: #c44; margin-top: 4px; max-width: 200px; }
      `}</style>
    </div>
  );
}
