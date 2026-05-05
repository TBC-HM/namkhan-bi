'use client';

// ShopCart — sticky cart with line items + submit.
// Items added via window event 'inv-cart-add' from product cards (server-rendered grid + client island sprinkled in via AddToCartButton sibling).
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
}

const STORAGE_KEY = 'inv_cart_v1';

export default function ShopCart({ locations }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Load from sessionStorage + listen for add events
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
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setOpen(true);
    }
    window.addEventListener('inv-cart-add', onAdd);
    return () => window.removeEventListener('inv-cart-add', onAdd);
  }, []);

  function persist(next: CartItem[]) {
    setItems(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function setQty(item_id: string, qty: number) {
    if (qty <= 0) { remove(item_id); return; }
    persist(items.map((it) => it.item_id === item_id ? { ...it, qty } : it));
  }
  function remove(item_id: string) { persist(items.filter((it) => it.item_id !== item_id)); }
  function clear() { persist([]); }

  const total = items.reduce((s, it) => s + it.qty * it.unit_cost_usd, 0);
  const autoApprove = total < 500;

  async function submit(form: HTMLFormElement) {
    if (busy || items.length === 0) return;
    setBusy(true); setErr(null);
    const fd = new FormData(form);
    const body = {
      pr_title: (fd.get('pr_title') as string) || `Restock ${new Date().toISOString().slice(0,10)}`,
      requesting_dept: (fd.get('requesting_dept') as string) || null,
      delivery_location_id: Number(fd.get('delivery_location_id')) || null,
      needed_by_date: (fd.get('needed_by_date') as string) || null,
      priority: (fd.get('priority') as string) || 'normal',
      business_justification: (fd.get('business_justification') as string) || null,
      lines: items.map((it) => ({
        item_id: it.item_id,
        quantity: it.qty,
        unit_cost_usd: it.unit_cost_usd,
        preferred_supplier_id: it.preferred_supplier_id ?? null,
      })),
    };
    try {
      const resp = await fetch('/api/proc/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || `HTTP ${resp.status}`); setBusy(false); return; }
      clear();
      setOpen(false);
      setToast(`Submitted — status: ${j.approval_status}`);
      setTimeout(() => setToast(null), 4000);
      router.push(`/operations/inventory/requests/${j.pr_id}`);
    } catch (e: any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button
        type="button"
        className="inv-cart-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Cart: ${items.length} items`}
      >
        🛒 {items.length > 0 && <span className="inv-cart-badge">{items.length}</span>}
      </button>

      {open && (
        <div className="inv-cart-drawer-backdrop" onClick={() => setOpen(false)}>
          <aside className="inv-cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="inv-cart-head">
              <strong>Your request</strong>
              <button type="button" className="inv-cart-close" onClick={() => setOpen(false)}>×</button>
            </div>

            {items.length === 0 ? (
              <p className="empty-state">Cart is empty. Click + Cart on a product card to add.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
                <label className="inv-field">
                  <span>Title</span>
                  <input type="text" name="pr_title" className="inv-input" placeholder="e.g. May linen restock" />
                </label>
                <label className="inv-field">
                  <span>Requesting dept</span>
                  <select name="requesting_dept" className="inv-input" defaultValue="">
                    <option value="">— pick —</option>
                    <option value="hk">Housekeeping</option>
                    <option value="fb">F&B</option>
                    <option value="spa">Spa</option>
                    <option value="engineering">Engineering</option>
                    <option value="fo">Front Office</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="inv-field">
                  <span>Delivery location</span>
                  <select name="delivery_location_id" className="inv-input" defaultValue="">
                    <option value="">— pick —</option>
                    {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
                  </select>
                </label>
                <label className="inv-field">
                  <span>Needed by</span>
                  <input type="date" name="needed_by_date" className="inv-input" />
                </label>
                <label className="inv-field">
                  <span>Priority</span>
                  <select name="priority" className="inv-input" defaultValue="normal">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>

                <div className="inv-cart-lines">
                  {items.map((it) => (
                    <div key={it.item_id} className="inv-cart-line">
                      <div className="inv-cart-line-name">{it.item_name}</div>
                      <input
                        type="number" min={1} value={it.qty}
                        onChange={(e) => setQty(it.item_id, Number(e.target.value))}
                        className="inv-input inv-cart-qty"
                      />
                      <div className="inv-cart-line-total">${(it.qty * it.unit_cost_usd).toFixed(2)}</div>
                      <button type="button" className="inv-cart-remove" onClick={() => remove(it.item_id)}>×</button>
                    </div>
                  ))}
                </div>

                <div className="inv-cart-total">
                  Total estimate: <strong>${total.toFixed(2)}</strong>
                  <div className={autoApprove ? 'inv-cart-status-ok' : 'inv-cart-status-warn'}>
                    {autoApprove ? '✓ Auto-approved on submit (under $500)' : '⚠ Needs approval'}
                  </div>
                </div>

                <label className="inv-field">
                  <span>Business justification (optional)</span>
                  <textarea name="business_justification" className="inv-input" rows={2}></textarea>
                </label>

                {err && <div className="inv-error">{err}</div>}

                <div className="inv-actions">
                  <button type="button" className="btn-ghost"   onClick={clear}    disabled={busy}>Clear</button>
                  <button type="submit" className="btn-primary" disabled={busy || items.length === 0}>
                    {busy ? 'Submitting…' : 'Submit request'}
                  </button>
                </div>
              </form>
            )}
          </aside>
        </div>
      )}

      {toast && <div className="inv-toast">{toast}</div>}
    </>
  );
}
