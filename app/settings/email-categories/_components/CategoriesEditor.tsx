'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CategoryRow {
  key: string; label: string; display_order: number; active: boolean;
  default_category: boolean; description: string | null;
}
interface RuleRow {
  id: string; category_key: string;
  match_field: 'from_email'|'from_domain'|'subject'|'body'|'intended_mailbox';
  match_op: 'ilike'|'endswith'|'equals'|'regex';
  pattern: string; priority: number; active: boolean; notes: string | null;
}

const FIELDS: Array<RuleRow['match_field']> = ['from_email','from_domain','subject','body','intended_mailbox'];
const OPS: Array<RuleRow['match_op']> = ['ilike','endswith','equals','regex'];

const cellTh: React.CSSProperties = {
  textAlign: 'left', padding: '6px 10px', fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)',
  borderBottom: '1px solid var(--paper-deep)', whiteSpace: 'nowrap',
};
const cellTd: React.CSSProperties = { padding: '6px 10px', fontSize: 'var(--t-sm)', borderBottom: '1px solid var(--line-soft)' };
const ipt: React.CSSProperties = { padding: '4px 8px', borderRadius: 4, border: '1px solid var(--paper-deep)', background: 'var(--paper-warm)', fontSize: 'var(--t-sm)', color: 'var(--ink)', fontFamily: 'var(--mono)' };
const btn: React.CSSProperties = { padding: '3px 8px', borderRadius: 4, border: '1px solid var(--paper-deep)', background: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', cursor: 'pointer' };
const btnBrass: React.CSSProperties = { ...btn, color: 'var(--brass)', borderColor: 'var(--brass-soft)' };
const btnDanger: React.CSSProperties = { ...btn, color: 'var(--st-bad)', borderColor: 'var(--st-bad)' };

export default function CategoriesEditor({ categories: initCats, rules: initRules }: { categories: CategoryRow[]; rules: RuleRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cats = initCats;
  const rules = initRules;

  async function patchRule(id: string, patch: Partial<RuleRow>) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sales/email-categories?type=rule', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'patch failed');
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/sales/email-categories?type=rule&id=${id}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'delete failed');
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function patchCat(key: string, patch: Partial<CategoryRow>) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sales/email-categories?type=cat', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'patch failed');
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ marginBottom: 10, padding: 10, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
        Rules are evaluated in priority order (lower number first). First match wins. The default fallback (currently <strong>{cats.find(c => c.default_category)?.label ?? '—'}</strong>) catches anything not matched.
        {' '}<Link href="/sales/inquiries" style={{ color: 'var(--brass)' }}>← back to cockpit</Link>
      </div>

      {err && <div style={{ padding: 10, marginBottom: 10, background: 'var(--st-bad-bg)', border: '1px solid var(--st-bad-bd)', borderRadius: 6, color: 'var(--st-bad)' }}>error: {err}</div>}

      {/* Categories */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500, margin: '0 0 8px' }}>
        Categories <span style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-sm)', marginLeft: 8 }}>{cats.length}</span>
      </h3>
      <table style={{ width: '100%', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6, borderCollapse: 'separate', borderSpacing: 0, marginBottom: 22 }}>
        <thead>
          <tr><th style={cellTh}>KEY</th><th style={cellTh}>LABEL</th><th style={cellTh}>ORDER</th><th style={cellTh}>DEFAULT</th><th style={cellTh}>ACTIVE</th><th style={cellTh}>RULES</th><th style={cellTh}>DESCRIPTION</th></tr>
        </thead>
        <tbody>
          {cats.map(c => {
            const cnt = rules.filter(r => r.category_key === c.key).length;
            return (
              <tr key={c.key}>
                <td style={{ ...cellTd, fontFamily: 'var(--mono)' }}>{c.key}</td>
                <td style={cellTd}>
                  <input defaultValue={c.label} onBlur={e => e.target.value !== c.label && patchCat(c.key, { label: e.target.value })} style={ipt} />
                </td>
                <td style={cellTd}>
                  <input type="number" defaultValue={c.display_order} onBlur={e => parseInt(e.target.value,10) !== c.display_order && patchCat(c.key, { display_order: parseInt(e.target.value,10) })} style={{ ...ipt, width: 60 }} />
                </td>
                <td style={cellTd}>
                  <input type="radio" name="default_cat" checked={c.default_category} onChange={() => patchCat(c.key, { default_category: true })} disabled={busy} title="Default fallback bucket" />
                </td>
                <td style={cellTd}>
                  <input type="checkbox" checked={c.active} onChange={e => patchCat(c.key, { active: e.target.checked })} disabled={busy} />
                </td>
                <td style={{ ...cellTd, fontFamily: 'var(--mono)', color: cnt === 0 ? 'var(--ink-mute)' : 'var(--ink)' }}>{cnt}</td>
                <td style={{ ...cellTd, color: 'var(--ink-mute)', fontSize: 'var(--t-xs)' }}>{c.description ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <NewCategoryRow onSaved={() => router.refresh()} />

      {/* Rules grouped by category */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500, margin: '22px 0 8px' }}>
        Rules <span style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-sm)', marginLeft: 8 }}>{rules.length}</span>
        <span style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-sm)', marginLeft: 12 }}>(first match wins · lower priority runs first)</span>
      </h3>
      <table style={{ width: '100%', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6, borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={cellTh}>PRIORITY</th>
            <th style={cellTh}>CATEGORY</th>
            <th style={cellTh}>FIELD</th>
            <th style={cellTh}>OP</th>
            <th style={cellTh}>PATTERN</th>
            <th style={cellTh}>NOTES</th>
            <th style={cellTh}>ACTIVE</th>
            <th style={cellTh}>—</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
              <td style={cellTd}>
                <input type="number" defaultValue={r.priority}
                       onBlur={e => parseInt(e.target.value,10) !== r.priority && patchRule(r.id, { priority: parseInt(e.target.value,10) })}
                       style={{ ...ipt, width: 60 }} />
              </td>
              <td style={cellTd}>
                <select defaultValue={r.category_key} onChange={e => patchRule(r.id, { category_key: e.target.value })} style={ipt}>
                  {initCats.map(c => <option key={c.key} value={c.key}>{c.label} ({c.key})</option>)}
                </select>
              </td>
              <td style={cellTd}>
                <select defaultValue={r.match_field} onChange={e => patchRule(r.id, { match_field: e.target.value as RuleRow['match_field'] })} style={ipt}>
                  {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </td>
              <td style={cellTd}>
                <select defaultValue={r.match_op} onChange={e => patchRule(r.id, { match_op: e.target.value as RuleRow['match_op'] })} style={ipt}>
                  {OPS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </td>
              <td style={{ ...cellTd, fontFamily: 'var(--mono)' }}>
                <input defaultValue={r.pattern} onBlur={e => e.target.value !== r.pattern && patchRule(r.id, { pattern: e.target.value })} style={{ ...ipt, minWidth: 180 }} />
              </td>
              <td style={cellTd}>
                <input defaultValue={r.notes ?? ''} onBlur={e => e.target.value !== (r.notes ?? '') && patchRule(r.id, { notes: e.target.value })} style={{ ...ipt, minWidth: 120 }} />
              </td>
              <td style={cellTd}>
                <input type="checkbox" checked={r.active} onChange={e => patchRule(r.id, { active: e.target.checked })} disabled={busy} />
              </td>
              <td style={cellTd}>
                <button type="button" onClick={() => deleteRule(r.id)} disabled={busy} style={btnDanger}>delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <NewRuleRow categories={initCats} onSaved={() => router.refresh()} />
    </div>
  );
}

function NewRuleRow({ categories, onSaved }: { categories: CategoryRow[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState(categories[0]?.key ?? '');
  const [field, setField] = useState<RuleRow['match_field']>('from_domain');
  const [op, setOp] = useState<RuleRow['match_op']>('ilike');
  const [pattern, setPattern] = useState('');
  const [priority, setPriority] = useState(100);
  const [notes, setNotes] = useState('');

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sales/email-categories?type=rule', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category_key: cat, match_field: field, match_op: op, pattern, priority, notes }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'create failed');
      setPattern(''); setNotes('');
      setOpen(false);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  if (!open) return (
    <div style={{ marginTop: 8 }}>
      <button type="button" onClick={() => setOpen(true)} style={btnBrass}>+ Add rule</button>
    </div>
  );

  return (
    <div style={{ marginTop: 10, padding: 10, background: 'var(--paper-warm)', border: '1px dashed var(--brass-soft)', borderRadius: 6, display: 'grid', gridTemplateColumns: '70px 1.2fr 1fr 0.8fr 1.6fr 1.4fr auto', gap: 6, alignItems: 'center' }}>
      <input type="number" value={priority} onChange={e => setPriority(parseInt(e.target.value,10) || 100)} placeholder="prio" style={ipt} />
      <select value={cat} onChange={e => setCat(e.target.value)} style={ipt}>
        {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <select value={field} onChange={e => setField(e.target.value as RuleRow['match_field'])} style={ipt}>
        {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <select value={op} onChange={e => setOp(e.target.value as RuleRow['match_op'])} style={ipt}>
        {OPS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="pattern (e.g. %booking.com or noreply@%)" style={ipt} />
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="notes (optional)" style={ipt} />
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" onClick={save} disabled={busy || !pattern} style={btnBrass}>save</button>
        <button type="button" onClick={() => setOpen(false)} style={btn}>cancel</button>
      </div>
      {err && <div style={{ gridColumn: '1 / -1', color: 'var(--st-bad)', fontSize: 'var(--t-xs)' }}>{err}</div>}
    </div>
  );
}

function NewCategoryRow({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [order, setOrder] = useState(100);
  const [description, setDescription] = useState('');

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sales/email-categories?type=cat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, label, display_order: order, description }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'create failed');
      setKey(''); setLabel(''); setDescription('');
      setOpen(false);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  if (!open) return (
    <div style={{ marginTop: 8 }}>
      <button type="button" onClick={() => setOpen(true)} style={btnBrass}>+ Add category</button>
    </div>
  );

  return (
    <div style={{ marginTop: 10, padding: 10, background: 'var(--paper-warm)', border: '1px dashed var(--brass-soft)', borderRadius: 6, display: 'grid', gridTemplateColumns: '120px 1.2fr 80px 2fr auto', gap: 6, alignItems: 'center' }}>
      <input value={key} onChange={e => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))} placeholder="key (e.g. campaigns)" style={ipt} />
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="label (e.g. ◆ Campaigns)" style={ipt} />
      <input type="number" value={order} onChange={e => setOrder(parseInt(e.target.value,10) || 100)} style={ipt} />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="description" style={ipt} />
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" onClick={save} disabled={busy || !key || !label} style={btnBrass}>save</button>
        <button type="button" onClick={() => setOpen(false)} style={btn}>cancel</button>
      </div>
      {err && <div style={{ gridColumn: '1 / -1', color: 'var(--st-bad)', fontSize: 'var(--t-xs)' }}>{err}</div>}
    </div>
  );
}
