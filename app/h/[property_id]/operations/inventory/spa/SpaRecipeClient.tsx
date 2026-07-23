'use client';

// app/h/[property_id]/operations/inventory/spa/SpaRecipeClient.tsx
// Recipe form: select a treatment → configure up to 5 products + qty used per session.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/app/(cockpit)/_design';

interface SpaItem { item_id: string; item_name: string; uom_id: number }
interface RecipeRow { recipe_id?: number; sort_order: number; item_id: string; qty_per_treatment: string; notes: string }
interface ExistingRecipe { recipe_id: number; treatment_name: string; sort_order: number; item_id: string; qty_per_treatment: number; uom_id: number; notes: string | null }

interface Props {
  treatmentNames: string[];
  spaItems: SpaItem[];
  existingRecipes: ExistingRecipe[];
  propertyId: number;
}

const EMPTY_ROW = (): RecipeRow => ({ sort_order: 0, item_id: '', qty_per_treatment: '', notes: '' });
const INPUT: React.CSSProperties = { fontSize: 12, padding: '5px 8px', border: '1px solid #E6DFCC', borderRadius: 3, background: '#FFFFFF', color: '#1B1B1B' };
const SEL: React.CSSProperties = { ...INPUT, cursor: 'pointer' };
const BTN: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 3, background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' };

export default function SpaRecipeClient({ treatmentNames, spaItems, existingRecipes, propertyId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTreatment, setSelectedTreatment] = useState('');
  const [rows, setRows] = useState<RecipeRow[]>([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function loadTreatment(name: string) {
    setSelectedTreatment(name);
    setMsg(null);
    const existing = existingRecipes.filter(r => r.treatment_name === name).sort((a,b) => a.sort_order - b.sort_order);
    const filled: RecipeRow[] = Array.from({ length: 5 }, (_, i) => {
      const ex = existing[i];
      return ex ? { recipe_id: ex.recipe_id, sort_order: i + 1, item_id: ex.item_id, qty_per_treatment: String(ex.qty_per_treatment), notes: ex.notes ?? '' } : EMPTY_ROW();
    });
    setRows(filled);
  }

  function setRow(i: number, field: keyof RecipeRow, val: string) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }

  async function handleSave() {
    if (!selectedTreatment) { setMsg({ type: 'err', text: 'Select a treatment first' }); return; }
    const activeRows = rows.filter(r => r.item_id && r.qty_per_treatment);
    if (!activeRows.length) { setMsg({ type: 'err', text: 'Add at least one product' }); return; }

    startTransition(async () => {
      const res = await fetch('/api/inventory/treatment-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treatment_name: selectedTreatment, property_id: propertyId, rows: activeRows.map((r, i) => ({ sort_order: i + 1, item_id: r.item_id, qty_per_treatment: Number(r.qty_per_treatment), notes: r.notes || null })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ type: 'err', text: json.error ?? 'Save failed' });
      else { setMsg({ type: 'ok', text: `Recipe saved for "${selectedTreatment}" · ${activeRows.length} products` }); router.refresh(); }
    });
  }

  return (
    <Container title="Treatment recipes" subtitle="Set consumable products used per treatment session · up to 5 items · auto-deducts from stock when treatment is recorded" density="compact">
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', display: 'block', marginBottom: 6 }}>
          Select treatment to configure
        </label>
        <select style={{ ...SEL, width: '100%', maxWidth: 480 }} value={selectedTreatment} onChange={e => loadTreatment(e.target.value)}>
          <option value="">Choose a treatment…</option>
          {treatmentNames.map(t => (
            <option key={t} value={t}>{t}{existingRecipes.some(r => r.treatment_name === t) ? ' ✓' : ''}</option>
          ))}
        </select>
      </div>

      {selectedTreatment && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 120px 1fr', gap: 6, marginBottom: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#5A5A5A' }}>
            <span>Product</span><span>Qty per treatment</span><span style={{ textAlign: 'center' }}>#</span><span>Notes</span>
          </div>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 120px 1fr', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <select style={SEL} value={row.item_id} onChange={e => setRow(i, 'item_id', e.target.value)}>
                <option value="">— not used —</option>
                {spaItems.map(it => <option key={it.item_id} value={it.item_id}>{it.item_name}</option>)}
              </select>
              <input style={INPUT} type="number" min="0" step="0.001" value={row.qty_per_treatment} onChange={e => setRow(i, 'qty_per_treatment', e.target.value)} placeholder="e.g. 30 (ml)" />
              <div style={{ textAlign: 'center', fontSize: 11, color: '#8A8A8A' }}>slot {i + 1}</div>
              <input style={INPUT} value={row.notes} onChange={e => setRow(i, 'notes', e.target.value)} placeholder="Optional note (e.g. dilute 1:3)" />
            </div>
          ))}

          {msg && (
            <div style={{ fontSize: 12, color: msg.type === 'ok' ? '#2E7D32' : '#B8542A', marginBottom: 10, padding: '6px 10px', background: msg.type === 'ok' ? '#E8F2E4' : '#F7E2DC', borderRadius: 3 }}>
              {msg.text}
            </div>
          )}

          <button type="button" onClick={handleSave} disabled={isPending} style={{ ...BTN, opacity: isPending ? 0.6 : 1 }}>
            {isPending ? 'Saving…' : 'Save recipe'}
          </button>
        </>
      )}
    </Container>
  );
}
