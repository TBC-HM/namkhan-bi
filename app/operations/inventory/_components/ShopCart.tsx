'use client';

// ShopCart — sticky cart with line items + submit.
//
// 2026-09-09 REPAIR (inventory buying-side, ADR-310). Three defects fixed:
//  1. INVISIBLE CART. Every class this file used (inv-cart-fab, inv-cart-drawer,
//     inv-cart-backdrop, inv-field, inv-cart-*) existed ONLY here — no stylesheet
//     in the repo ever defined them. The FAB rendered as an unpositioned pill at
//     the bottom of the page (read as a loading spinner) and the drawer opened
//     with no fixed positioning or z-index, i.e. invisible below the fold.
//     styles/globals.css is an ADR-222 Gate-2 PROTECTED path, so the fix is
//     inline styles — matching sibling ShopCatalog.tsx which already inlines.
//  2. NO TENANT SCOPE. procurement.requests.property_id is NOT NULL with no
//     default and the POST body never carried it -> every submit died on
//     23502 before the RPC was ever reached. propertyId is now a required prop.
//  3. UNPRICED ITEMS. All 124 real purchasables carry last_unit_cost_usd = NULL,
//     so every basket totalled $0 and proc_pr_submit raised 'no priced line
//     items'. Unit cost is now editable per line, and submit is blocked with an
//     explicit reason while the total is 0.
//
// Items arrive via the window event 'inv-cart-add' dispatched by ShopCatalog.
// POSTs to /api/proc/request.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CartItem {
  item_id: string;
  sku: string;
  item_name: string;
  unit_cost_usd: number;
  qty: number;
  preferred_supplier_id?: string | null;
}

interface Props {
  locations: { location_id: number; location_name: string }[];
  /** Tenant scope. Required — ADR-300/302: no silent property defaults. */
  propertyId: number;
  /** Route prefix for post-submit navigation. */
  basePath: string;
  /** Auto-approve threshold (USD) read from procurement.config. */
  autoApproveCap?: number;
}

const STORAGE_KEY = 'inv_cart_v1';

const COLORS = {
  ink: '#1F3A2E',
  sand: '#B8A878',
  border: '#E3DCC9',
  bg: '#FFFFFF',
  muted: '#5A5A5A',
  warn: '#B8542A',
};

const sx: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed', right: 24, bottom: 24, zIndex: 1000,
    width: 56, height: 56, borderRadius: 28,
    background: COLORS.ink, color: '#FFF', border: 'none',
    fontSize: 22, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 22, height: 22, borderRadius: 11,
    background: COLORS.warn, color: '#FFF',
    fontSize: 12, fontWeight: 700, lineHeight: '22px',
    textAlign: 'center', padding: '0 5px',
  },
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1001,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    width: 'min(440px, 100vw)', height: '100%',
    background: COLORS.bg, borderLeft: '1px solid ' + COLORS.border,
    padding: '16px 18px', overflowY: 'auto',
    boxShadow: '-6px 0 24px rgba(0,0,0,0.18)',
  },
  head: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid ' + COLORS.border,
    fontSize: 16,
  },
  close: {
    background: 'none', border: 'none', fontSize: 26,
    lineHeight: 1, cursor: 'pointer', color: COLORS.muted,
  },
  field: { display: 'block', marginBottom: 10, fontSize: 12, color: COLORS.muted },
  input: {
    width: '100%', marginTop: 4, padding: '7px 9px', fontSize: 13,
    border: '1px solid ' + COLORS.border, borderRadius: 6,
    background: '#FFF', color: '#111', boxSizing: 'border-box',
  },
  lines: { margin: '14px 0', borderTop: '1px solid ' + COLORS.border },
  line: {
    display: 'grid', gridTemplateColumns: '1fr 58px 70px 74px 26px',
    gap: 6, alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid ' + COLORS.border,
    fontSize: 12,
  },
  lineInput: {
    width: '100%', padding: '4px 6px', fontSize: 12,
    border: '1px solid ' + COLORS.border, borderRadius: 5,
    boxSizing: 'border-box',
  },
  remove: {
    background: 'none', border: 'none', fontSize: 18,
    cursor: 'pointer', color: COLORS.warn, lineHeight: 1,
  },
  total: {
    padding: '10px 0', fontSize: 14,
    borderBottom: '1px solid ' + COLORS.border, marginBottom: 12,
  },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 },
  btnPrimary: {
    padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
    background: COLORS.ink, color: '#FFF', border: 'none',
  },
  btnGhost: {
    padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
    background: 'transparent', color: COLORS.ink,
    border: '1px solid ' + COLORS.border,
  },
  error: {
    background: '#FDECE6', color: COLORS.warn, border: '1px solid ' + COLORS.warn,
    borderRadius: 6, padding: '8px 10px', fontSize: 12, marginBottom: 10,
  },
  toast: {
    position: 'fixed', bottom: 92, right: 24, zIndex: 1002,
    background: COLORS.ink, color: '#FFF', padding: '10px 16px',
    borderRadius: 8, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
  },
  empty: { fontSize: 13, color: COLORS.muted, padding: '20px 0' },
};

export default function ShopCart({ locations, propertyId, basePath, autoApproveCap = 500 }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}

    function onAdd(e: Event) {
      const detail = (e as CustomEvent<CartItem>).detail;
      setItems((prev) => {
        const idx = prev.findIndex((p) => p.item_id === detail.item_id);
        let next: CartItem[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = { ...next[idx], qty: next[idx].qty + detail.qty };
        } else {
          next = [...prev, detail];
        }
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
      setOpen(true);
    }
    window.addEventListener('inv-cart-add', onAdd);
    return () => window.removeEventListener('inv-cart-add', onAdd);
  }, []);

  function persist(next: CartItem[]) {
    setItems(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function setQty(item_id: string, qty: number) {
    if (qty <= 0) { remove(item_id); return; }
    persist(items.map((it) => (it.item_id === item_id ? { ...it, qty } : it)));
  }
  function setCost(item_id: string, cost: number) {
    persist(items.map((it) => (it.item_id === item_id ? { ...it, unit_cost_usd: cost } : it)));
  }
  function remove(item_id: string) { persist(items.filter((it) => it.item_id !== item_id)); }
  function clear() { persist([]); }

  const total = items.reduce((s, it) => s + it.qty * (Number(it.unit_cost_usd) || 0), 0);
  const autoApprove = total > 0 && total < autoApproveCap;
  const unpriced = items.filter((it) => !(Number(it.unit_cost_usd) > 0)).length;
  const canSubmit = items.length > 0 && total > 0 && !busy;

  async function submit(form: HTMLFormElement) {
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    const fd = new FormData(form);
    const body = {
      property_id: propertyId,
      pr_title: (fd.get('pr_title') as string) || 'Restock ' + new Date().toISOString().slice(0, 10),
      requesting_dept: (fd.get('requesting_dept') as string) || null,
      delivery_location_id: Number(fd.get('delivery_location_id')) || null,
      needed_by_date: (fd.get('needed_by_date') as string) || null,
      priority: (fd.get('priority') as string) || 'normal',
      business_justification: (fd.get('business_justification') as string) || null,
      lines: items.map((it) => ({
        item_id: it.item_id,
        quantity: it.qty,
        unit_cost_usd: Number(it.unit_cost_usd) || 0,
        preferred_supplier_id: it.preferred_supplier_id ?? null,
      })),
    };
    try {
      const resp = await fetch('/api/proc/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || ('HTTP ' + resp.status)); setBusy(false); return; }
      clear();
      setOpen(false);
      setToast('Submitted — status: ' + j.approval_status);
      setTimeout(() => setToast(null), 4000);
      router.push(basePath + '/requests/' + j.pr_id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Network error');
    } finally { setBusy(false); }
  }

  return (
    <>
      <button
        type="button"
        style={sx.fab}
        onClick={() => setOpen((o) => !o)}
        aria-label={'Cart: ' + items.length + ' items'}
      >
        <span aria-hidden>&#128722;</span>
        {items.length > 0 && <span style={sx.badge}>{items.length}</span>}
      </button>

      {open && (
        <div style={sx.backdrop} onClick={() => setOpen(false)}>
          <aside style={sx.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={sx.head}>
              <strong>Your request</strong>
              <button type="button" style={sx.close} onClick={() => setOpen(false)}>&times;</button>
            </div>

            {items.length === 0 ? (
              <p style={sx.empty}>Cart is empty. Click + Cart on a product card to add.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
                <label style={sx.field}>
                  <span>Title</span>
                  <input type="text" name="pr_title" style={sx.input} placeholder="e.g. May linen restock" />
                </label>
                <label style={sx.field}>
                  <span>Requesting dept</span>
                  <select name="requesting_dept" style={sx.input} defaultValue="">
                    <option value="">&mdash; pick &mdash;</option>
                    <option value="hk">Housekeeping</option>
                    <option value="fb">F&amp;B</option>
                    <option value="spa">Spa</option>
                    <option value="engineering">Engineering</option>
                    <option value="fo">Front Office</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label style={sx.field}>
                  <span>Delivery location</span>
                  <select name="delivery_location_id" style={sx.input} defaultValue="">
                    <option value="">&mdash; pick &mdash;</option>
                    {locations.map((l) => (
                      <option key={l.location_id} value={l.location_id}>{l.location_name}</option>
                    ))}
                  </select>
                </label>
                <label style={sx.field}>
                  <span>Needed by</span>
                  <input type="date" name="needed_by_date" style={sx.input} />
                </label>
                <label style={sx.field}>
                  <span>Priority</span>
                  <select name="priority" style={sx.input} defaultValue="normal">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>

                <div style={sx.lines}>
                  <div style={{ ...sx.line, fontWeight: 600, color: COLORS.muted }}>
                    <div>Item</div><div>Qty</div><div>$ / unit</div><div style={{ textAlign: 'right' }}>Line</div><div />
                  </div>
                  {items.map((it) => (
                    <div key={it.item_id} style={sx.line}>
                      <div title={it.sku}>{it.item_name}</div>
                      <input
                        type="number" min={1} value={it.qty}
                        onChange={(e) => setQty(it.item_id, Number(e.target.value))}
                        style={sx.lineInput}
                      />
                      <input
                        type="number" min={0} step="0.01"
                        value={Number(it.unit_cost_usd) || ''}
                        placeholder="0.00"
                        onChange={(e) => setCost(it.item_id, Number(e.target.value))}
                        style={{
                          ...sx.lineInput,
                          borderColor: Number(it.unit_cost_usd) > 0 ? COLORS.border : COLORS.warn,
                        }}
                      />
                      <div style={{ textAlign: 'right' }}>
                        ${(it.qty * (Number(it.unit_cost_usd) || 0)).toFixed(2)}
                      </div>
                      <button type="button" style={sx.remove} onClick={() => remove(it.item_id)}>&times;</button>
                    </div>
                  ))}
                </div>

                <div style={sx.total}>
                  Total estimate: <strong>${total.toFixed(2)}</strong>
                  {total > 0 && (
                    <div style={{ marginTop: 4, fontSize: 12, color: autoApprove ? COLORS.ink : COLORS.warn }}>
                      {autoApprove
                        ? 'Auto-approved on submit (under $' + autoApproveCap + ')'
                        : 'Needs approval'}
                    </div>
                  )}
                  {unpriced > 0 && (
                    <div style={{ marginTop: 4, fontSize: 12, color: COLORS.warn }}>
                      {unpriced} line{unpriced > 1 ? 's have' : ' has'} no cost on file — enter an
                      estimated $/unit. A request with a $0 total cannot be submitted.
                    </div>
                  )}
                </div>

                <label style={sx.field}>
                  <span>Business justification (optional)</span>
                  <textarea name="business_justification" style={sx.input} rows={2} />
                </label>

                {err && <div style={sx.error}>{err}</div>}

                <div style={sx.actions}>
                  <button type="button" style={sx.btnGhost} onClick={clear} disabled={busy}>Clear</button>
                  <button
                    type="submit"
                    style={{ ...sx.btnPrimary, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
                    disabled={!canSubmit}
                  >
                    {busy ? 'Submitting...' : 'Submit request'}
                  </button>
                </div>
              </form>
            )}
          </aside>
        </div>
      )}

      {toast && <div style={sx.toast}>{toast}</div>}
    </>
  );
}
