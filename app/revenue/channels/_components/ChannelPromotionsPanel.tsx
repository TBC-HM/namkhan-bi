'use client';
// app/revenue/channels/_components/ChannelPromotionsPanel.tsx
// PBS 2026-07-07: Shared UI panel for OTA promotion activation.
// Each row: label · Active toggle · cost % · cost flat · notes · save.

import { useState } from 'react';

export interface PromotionRow {
  channel: string;
  promo_key: string;
  label: string;
  is_active: boolean;
  cost_pct: number | null;
  cost_flat: number | null;
  notes: string | null;
}

interface Props { channel: string; propertyId: number; initial: PromotionRow[] }

// PBS 2026-07-09 pm: standard tactical promo types the panel offers as a template.
// Selecting a type auto-fills the promo_key + label so operator only needs to tweak notes.
const PROMO_TYPES: Array<{ type: string; label: string; suffix?: string }> = [
  { type: 'country',      label: 'Country deal',           suffix: '(specify market in notes)' },
  { type: 'los',          label: 'Length-of-stay deal',    suffix: '(specify N nights in notes)' },
  { type: 'ta_campaign',  label: 'Travel-agent campaign',  suffix: '(specify TA + code in notes)' },
  { type: 'seasonal',     label: 'Seasonal campaign',      suffix: '(specify window in notes)' },
  { type: 'custom',       label: 'Custom',                 suffix: '' },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '').slice(0, 40);
}

export default function ChannelPromotionsPanel({ channel, propertyId, initial }: Props) {
  const [rows, setRows] = useState<PromotionRow[]>(initial);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Inline "Add promotion" form state
  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState<string>('country');
  const [newLabel, setNewLabel] = useState<string>('');
  const [newKey, setNewKey] = useState<string>('');

  const patch = (key: string, p: Partial<PromotionRow>) =>
    setRows(prev => prev.map(r => r.promo_key === key ? { ...r, ...p } : r));

  const addNew = async () => {
    const label = newLabel.trim();
    if (!label) { setMsg({ kind: 'err', text: 'Label required.' }); return; }
    const key = (newKey.trim() || slugify(label));
    if (rows.some((r) => r.promo_key === key)) {
      setMsg({ kind: 'err', text: `Promo key "${key}" already exists — pick a different label.` });
      return;
    }
    const row: PromotionRow = {
      channel, promo_key: key, label,
      is_active: false, cost_pct: null, cost_flat: null,
      notes: PROMO_TYPES.find((t) => t.type === newType)?.suffix ?? '',
    };
    setSavingKey(key);
    setMsg(null);
    try {
      const r = await fetch('/api/channel-promotions/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId, channel,
          promo_key: key, label,
          is_active: false, cost_pct: null, cost_flat: null,
          notes: row.notes ?? '',
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) { setMsg({ kind: 'err', text: j.error ?? `HTTP ${r.status}` }); return; }
      setRows((prev) => [...prev, row]);
      setMsg({ kind: 'ok', text: `Added ${label}` });
      setAddOpen(false); setNewLabel(''); setNewKey(''); setNewType('country');
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSavingKey(null);
    }
  };

  const save = async (row: PromotionRow) => {
    setSavingKey(row.promo_key);
    setMsg(null);
    try {
      const r = await fetch('/api/channel-promotions/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          channel,
          promo_key: row.promo_key,
          label: row.label,
          is_active: row.is_active,
          cost_pct: row.cost_pct == null ? null : Number(row.cost_pct),
          cost_flat: row.cost_flat == null ? null : Number(row.cost_flat),
          notes: row.notes ?? '',
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) setMsg({ kind: 'err', text: j.error ?? `HTTP ${r.status}` });
      else setMsg({ kind: 'ok', text: `Saved ${row.label}` });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {msg && (
        <div style={{
          padding: '8px 12px', borderRadius: 4, fontSize: 12,
          background: msg.kind === 'ok' ? '#F0F7F2' : '#FFF3F1',
          color:      msg.kind === 'ok' ? '#084838' : '#B04A2F',
          border: '1px solid ' + (msg.kind === 'ok' ? '#0848380F' : '#B04A2F33'),
        }}>{msg.text}</div>
      )}

      {/* PBS 2026-07-09 pm: Inline "Add promotion" form. Country / LOS / TA-campaign / seasonal / custom. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {addOpen ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4, width: '100%' }}>
            <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ ...inp, width: 160 }}>
              {PROMO_TYPES.map((t) => (<option key={t.type} value={t.type}>{t.label}</option>))}
            </select>
            <input type="text" placeholder="Label (e.g. Germany 15%)"
              value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              style={{ ...inp, width: 240 }} />
            <input type="text" placeholder="promo_key (auto)"
              value={newKey} onChange={(e) => setNewKey(e.target.value)}
              style={{ ...inp, width: 180 }} />
            <button onClick={addNew} disabled={savingKey !== null} style={btnSave}>
              {savingKey ? 'Adding…' : 'Add'}
            </button>
            <button onClick={() => { setAddOpen(false); setMsg(null); }} style={{ ...btnSave, background: '#FFFFFF', color: '#5A5A5A', border: '1px solid #E6DFCC' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddOpen(true)} style={btnSave}>+ Add promotion</button>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ background: '#FAFAF7' }}>
          <tr>
            <th style={th}>Status</th>
            <th style={{ ...th, width: 220 }}>Promotion</th>
            <th style={th}>Active</th>
            <th style={th}>Cost %</th>
            <th style={th}>Cost flat (USD)</th>
            <th style={{ ...th, minWidth: 200 }}>Notes</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.promo_key} style={{ borderTop: '1px solid #F5F0E1' }}>
              <td style={td}>
                <span title={r.is_active ? 'Active — column will show green in day report' : 'Inactive — column will show red in day report'}
                  style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                           background: r.is_active ? '#1F8A4C' : '#B04A2F', cursor: 'help' }}
                />
              </td>
              <td style={{ ...td, fontWeight: 600 }}>{r.label}</td>
              <td style={td}>
                <input type="checkbox" checked={r.is_active}
                  onChange={e => patch(r.promo_key, { is_active: e.target.checked })} />
              </td>
              <td style={td}>
                <input type="number" step="0.01" value={r.cost_pct ?? ''}
                  onChange={e => patch(r.promo_key, { cost_pct: e.target.value === '' ? null : Number(e.target.value) })}
                  style={inp} />
              </td>
              <td style={td}>
                <input type="number" step="0.01" value={r.cost_flat ?? ''}
                  onChange={e => patch(r.promo_key, { cost_flat: e.target.value === '' ? null : Number(e.target.value) })}
                  style={inp} />
              </td>
              <td style={td}>
                <input type="text" value={r.notes ?? ''}
                  onChange={e => patch(r.promo_key, { notes: e.target.value })}
                  style={{ ...inp, width: '100%' }} />
              </td>
              <td style={td}>
                <button onClick={() => save(r)} disabled={savingKey === r.promo_key} style={btnSave}>
                  {savingKey === r.promo_key ? 'Saving…' : 'Save'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #E6DFCC', color: '#3A3A3A', fontSize: 11 };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: '#1B1B1B' };
const inp: React.CSSProperties = { padding: '4px 8px', border: '1px solid #E6DFCC', borderRadius: 3, fontSize: 12, background: '#FFFFFF', color: '#1B1B1B', width: 100 };
const btnSave: React.CSSProperties = { padding: '4px 12px', fontSize: 11, fontWeight: 600, background: '#084838', color: '#FFFFFF', border: '1px solid #084838', borderRadius: 3, cursor: 'pointer' };
