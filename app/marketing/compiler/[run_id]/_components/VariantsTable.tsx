'use client';

// app/marketing/compiler/[run_id]/_components/VariantsTable.tsx
// v1.4 — adds RATE column (NRF · $213/n · 206-245) and DISCOUNT input.
// Discount applied client-side to total; persisted via PATCH on blur.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DataTable from '@/components/ui/DataTable';
import { fmtKpi, EMPTY } from '@/lib/format';

export interface VariantRow {
  id: string;
  label: string;
  room_category: string | null;
  activity_intensity: string | null;
  fnb_mode: string | null;
  total_usd: number;
  per_pax_usd: number;
  margin_pct: number;
  recommended: boolean | null;
  bookable_program: any[];
  usali_split: any;
  operator_discount_usd?: number | null;
  rate_plan_id?: number | null;
  rate_plan_name?: string | null;
  room_rate_median_usd?: number | null;
  room_rate_min_usd?: number | null;
  room_rate_max_usd?: number | null;
  room_rate_days?: number | null;
}

interface RowState { discountStr: string; busy: boolean; err: string | null; }

export default function VariantsTable({ runId, rows, partySize }: { runId: string; rows: VariantRow[]; partySize: number }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deployErr, setDeployErr] = useState<string | null>(null);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  // initialise per-row discount state
  useEffect(() => {
    setRowState(prev => {
      const next = { ...prev };
      for (const v of rows) {
        if (!next[v.id]) {
          next[v.id] = { discountStr: String(v.operator_discount_usd ?? 0), busy: false, err: null };
        }
      }
      return next;
    });
  }, [rows]);

  const updateDiscount = async (variantId: string, valStr: string) => {
    const n = Math.max(0, Number(valStr) || 0);
    setRowState(s => ({ ...s, [variantId]: { ...s[variantId], busy: true, err: null } }));
    try {
      const res = await fetch(`/api/compiler/variants/${variantId}/discount`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ discount_usd: n }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setRowState(s => ({ ...s, [variantId]: { ...s[variantId], busy: false, err: null, discountStr: String(n) } }));
      router.refresh();
    } catch (e: any) {
      setRowState(s => ({ ...s, [variantId]: { ...s[variantId], busy: false, err: e?.message ?? String(e) } }));
    }
  };

  const deploy = async (variantId: string) => {
    setDeployingId(variantId); setDeployErr(null);
    try {
      const res = await fetch(`/api/compiler/runs/${runId}/deploy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantId, designVariant: 'B' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'deploy failed');
      router.refresh();
    } catch (e: any) {
      setDeployErr(e?.message ?? String(e));
    } finally {
      setDeployingId(null);
    }
  };

  return (
    <div>
      {deployErr && (
        <div style={{ marginBottom: 8, padding: '6px 10px', fontSize: 'var(--t-xs)', color: 'var(--st-bad, #b65f4a)' }}>
          {deployErr}
        </div>
      )}
      <DataTable<VariantRow>
        rowKey={v => v.id}
        rows={rows}
        emptyState={
          <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
            No variants yet — set window + rooms above and click Build.
          </span>
        }
        columns={[
          {
            key: 'label',
            header: 'V',
            align: 'center',
            width: '36px',
            render: v => (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '50%',
                background: v.recommended ? 'var(--moss)' : 'var(--paper-deep)',
                color: v.recommended ? 'var(--paper)' : 'var(--ink-soft)',
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', fontWeight: 600,
              }}>
                {v.label}
              </span>
            ),
            sortValue: v => v.label,
          },
          {
            key: 'room_category',
            header: 'Room',
            align: 'left',
            render: v => (
              <span>
                <strong>{v.room_category ?? EMPTY}</strong>
                {v.recommended && (
                  <span style={{
                    marginLeft: 6, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
                    color: 'var(--brass)', letterSpacing: 'var(--ls-extra)',
                  }}>· REC</span>
                )}
              </span>
            ),
            sortValue: v => v.room_category ?? '',
          },
          {
            key: 'rate',
            header: 'Rate',
            align: 'left',
            width: '180px',
            render: v => v.room_rate_median_usd ? (
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                  {v.rate_plan_name ?? '?'}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                  ${v.room_rate_median_usd}/n median
                  {v.room_rate_min_usd != null && v.room_rate_max_usd != null && (
                    <span> · ${v.room_rate_min_usd}–{v.room_rate_max_usd}</span>
                  )}
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 'var(--t-xs)' }}>
                rebuild for rate
              </span>
            ),
          },
          {
            key: 'fnb_mode',
            header: 'Board',
            align: 'left',
            width: '70px',
            render: v => v.fnb_mode ?? EMPTY,
            sortValue: v => v.fnb_mode ?? '',
          },
          {
            key: 'activity_intensity',
            header: 'Program',
            align: 'left',
            width: '110px',
            render: v => `${v.activity_intensity ?? '—'} · ${Array.isArray(v.bookable_program) ? v.bookable_program.length : 0}`,
            sortValue: v => v.activity_intensity ?? '',
          },
          {
            key: 'total_usd',
            header: 'Subtotal',
            align: 'right',
            numeric: true,
            width: '100px',
            render: v => fmtKpi(v.total_usd, 'usd', 0),
            sortValue: v => v.total_usd,
          },
          {
            key: 'discount',
            header: 'Discount',
            align: 'right',
            width: '110px',
            render: v => {
              const s = rowState[v.id] ?? { discountStr: String(v.operator_discount_usd ?? 0), busy: false, err: null };
              return (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>$</span>
                    <input
                      type="number" min={0} step={50}
                      value={s.discountStr}
                      onChange={e => setRowState(st => ({ ...st, [v.id]: { ...s, discountStr: e.target.value, err: null } }))}
                      onBlur={e => {
                        const cur = Number(s.discountStr) || 0;
                        const orig = Number(v.operator_discount_usd ?? 0);
                        if (cur !== orig) updateDiscount(v.id, e.target.value);
                      }}
                      style={{
                        width: 70, padding: '3px 6px', textAlign: 'right',
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        background: 'var(--paper)', border: '1px solid var(--paper-deep)',
                        borderRadius: 3, color: 'var(--ink)',
                      }}
                    />
                  </div>
                  {s.err && (
                    <div style={{ fontSize: 10, color: 'var(--st-bad, #b65f4a)', fontFamily: 'var(--mono)' }}>
                      {s.err}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: 'final_total',
            header: 'Total',
            align: 'right',
            numeric: true,
            width: '110px',
            render: v => {
              const d = Number(v.operator_discount_usd ?? 0);
              const finalT = Math.max(0, v.total_usd - d);
              return (
                <div>
                  <strong>{fmtKpi(finalT, 'usd', 0)}</strong>
                  {d > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--brass)', fontFamily: 'var(--mono)' }}>
                      −${d.toLocaleString()}
                    </div>
                  )}
                </div>
              );
            },
            sortValue: v => v.total_usd - Number(v.operator_discount_usd ?? 0),
          },
          {
            key: 'per_pax_usd',
            header: 'Per pax',
            align: 'right',
            numeric: true,
            width: '90px',
            render: v => {
              const d = Number(v.operator_discount_usd ?? 0);
              const finalT = Math.max(0, v.total_usd - d);
              const pp = partySize > 0 ? Math.round(finalT / partySize) : v.per_pax_usd;
              return fmtKpi(pp, 'usd', 0);
            },
            sortValue: v => v.per_pax_usd,
          },
          {
            key: 'margin_pct',
            header: 'Margin',
            align: 'right',
            numeric: true,
            width: '80px',
            render: v => fmtKpi(v.margin_pct, 'pct', 1),
            sortValue: v => v.margin_pct,
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: '170px',
            render: v => (
              <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setExpanded(expanded === v.id ? null : v.id)} style={btnGhost}>
                  {expanded === v.id ? 'Hide' : 'Stack'}
                </button>
                <button
                  onClick={() => deploy(v.id)}
                  disabled={deployingId === v.id}
                  style={{ ...btnPrimary, background: deployingId === v.id ? 'var(--ink-faint)' : 'var(--moss)' }}
                >
                  {deployingId === v.id ? 'Deploying…' : 'Deploy'}
                </button>
              </div>
            ),
          },
        ]}
        footer={
          expanded ? (() => {
            const v = rows.find(r => r.id === expanded);
            if (!v) return null;
            const bd = v.usali_split?._breakdown;
            if (!bd) return (
              <tr><td colSpan={11} style={expandTd}>
                <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                  No price stack stored for this variant — rebuild via the form above.
                </span>
              </td></tr>
            );
            return (
              <tr>
                <td colSpan={11} style={expandTd}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 14, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
                  }}>
                    <div>
                      <div className="t-eyebrow">ROOMS</div>
                      <div>{bd.rooms?.qty}× ${bd.rooms?.unit_usd}/n median</div>
                      <div style={{ color: 'var(--ink-mute)' }}>
                        range ${bd.rooms?.rate_min}–${bd.rooms?.rate_max} · {bd.rooms?.rate_days}d
                      </div>
                      <div style={{ marginTop: 4 }}><strong>{fmtKpi(bd.rooms?.line_usd ?? 0, 'usd', 0)}</strong></div>
                    </div>
                    <div>
                      <div className="t-eyebrow">BOARD ({bd.board?.sku})</div>
                      <div>{bd.board?.qty}× ${bd.board?.unit_usd}</div>
                      <div style={{ marginTop: 4 }}><strong>{fmtKpi(bd.board?.line_usd ?? 0, 'usd', 0)}</strong></div>
                    </div>
                    <div>
                      <div className="t-eyebrow">PROGRAM ({(bd.program ?? []).length})</div>
                      {(bd.program ?? []).map((p: any) => (
                        <div key={p.sku}>{p.name} · ${p.unit_usd}/pax</div>
                      ))}
                      <div style={{ marginTop: 4 }}>
                        <strong>{fmtKpi((bd.program ?? []).reduce((s: number, p: any) => s + (p.line_usd ?? 0), 0), 'usd', 0)}</strong>
                      </div>
                    </div>
                    <div>
                      <div className="t-eyebrow">TRANSPORT</div>
                      <div>{bd.transport?.qty}× ${bd.transport?.unit_usd}</div>
                      <div style={{ marginTop: 4 }}><strong>{fmtKpi(bd.transport?.line_usd ?? 0, 'usd', 0)}</strong></div>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })() : undefined
        }
      />
    </div>
  );
}

const btnGhost: React.CSSProperties = {
  padding: '4px 10px',
  background: 'var(--paper)', color: 'var(--ink-soft)',
  border: '1px solid var(--paper-deep)', borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 600,
  cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  padding: '4px 12px',
  color: 'var(--paper)', border: 'none', borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 600,
  cursor: 'pointer',
};
const expandTd: React.CSSProperties = {
  padding: '12px 16px',
  background: 'var(--paper-warm)',
  borderTop: '1px solid var(--paper-deep)',
};
