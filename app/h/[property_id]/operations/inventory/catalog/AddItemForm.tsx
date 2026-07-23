'use client';

// app/h/[property_id]/operations/inventory/catalog/AddItemForm.tsx
// PBS 2026-07-24: manual item entry form for non-POS supply items
// (maintenance, housekeeping, eco farm, activities, spa consumables etc.)

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export interface DropdownOption { id: number; name: string; code?: string }

interface Props {
  propertyId: number;
  categories: DropdownOption[];
  units: DropdownOption[];
  locations: DropdownOption[];
}

const FIELD: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A' };
const INPUT: React.CSSProperties = { fontSize: 13, padding: '6px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', outline: 'none' };
const SELECT: React.CSSProperties = { ...INPUT, cursor: 'pointer' };
const BTN_PRIMARY: React.CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 20px', borderRadius: 4, background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer' };
const BTN_CANCEL: React.CSSProperties = { ...BTN_PRIMARY, background: 'transparent', color: '#5A5A5A', border: '1px solid #E6DFCC' };

export default function AddItemForm({ propertyId, categories, units, locations }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    item_name: '',
    item_name_lao: '',
    category_id: '',
    uom_id: '',
    default_location_id: '',
    reorder_point: '',
    reorder_quantity: '',
    is_perishable: false,
    is_eco_certified: false,
    is_local_sourced: false,
  });

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.item_name.trim()) { setError('Name is required'); return; }
    if (!form.category_id) { setError('Category is required'); return; }
    if (!form.uom_id) { setError('Unit of measure is required'); return; }

    startTransition(async () => {
      const res = await fetch(`/api/inventory/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, property_id: propertyId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Failed to save item');
      } else {
        setSuccess(`Added: ${json.item_name} (${json.sku})`);
        setForm({ item_name: '', item_name_lao: '', category_id: '', uom_id: '', default_location_id: '', reorder_point: '', reorder_quantity: '', is_perishable: false, is_eco_certified: false, is_local_sourced: false });
        router.refresh();
      }
    });
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setSuccess(null); setError(null); }}
          style={{ ...BTN_PRIMARY, marginBottom: 4 }}
        >
          + Add new item
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6, padding: '16px 20px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: '#1B1B1B' }}>New catalog item</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={FIELD}>
              <label style={LABEL}>Name *</label>
              <input style={INPUT} value={form.item_name} onChange={e => set('item_name', e.target.value)} placeholder="e.g. Coconut Massage Oil 1L" required />
            </div>
            <div style={FIELD}>
              <label style={LABEL}>Name (Lao)</label>
              <input style={INPUT} value={form.item_name_lao} onChange={e => set('item_name_lao', e.target.value)} placeholder="Optional Lao name for staff" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={FIELD}>
              <label style={LABEL}>Category *</label>
              <select style={SELECT} value={form.category_id} onChange={e => set('category_id', e.target.value)} required>
                <option value="">Select…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={FIELD}>
              <label style={LABEL}>Unit of measure *</label>
              <select style={SELECT} value={form.uom_id} onChange={e => set('uom_id', e.target.value)} required>
                <option value="">Select…</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}{u.code ? ` (${u.code})` : ''}</option>)}
              </select>
            </div>
            <div style={FIELD}>
              <label style={LABEL}>Default location</label>
              <select style={SELECT} value={form.default_location_id} onChange={e => set('default_location_id', e.target.value)}>
                <option value="">None</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={FIELD}>
              <label style={LABEL}>Reorder point</label>
              <input style={INPUT} type="number" min="0" step="0.01" value={form.reorder_point} onChange={e => set('reorder_point', e.target.value)} placeholder="Min quantity to trigger reorder" />
            </div>
            <div style={FIELD}>
              <label style={LABEL}>Reorder quantity</label>
              <input style={INPUT} type="number" min="0" step="0.01" value={form.reorder_quantity} onChange={e => set('reorder_quantity', e.target.value)} placeholder="How much to order" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            {[
              { field: 'is_perishable', label: 'Perishable' },
              { field: 'is_eco_certified', label: 'Eco certified' },
              { field: 'is_local_sourced', label: 'Local sourced' },
            ].map(({ field, label }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[field as keyof typeof form]} onChange={e => set(field, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>

          {error && <div style={{ fontSize: 12, color: '#B8542A', marginBottom: 10 }}>{error}</div>}
          {success && <div style={{ fontSize: 12, color: '#2E7D32', marginBottom: 10 }}>{success}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={isPending} style={{ ...BTN_PRIMARY, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? 'Saving…' : 'Save item'}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={BTN_CANCEL}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
