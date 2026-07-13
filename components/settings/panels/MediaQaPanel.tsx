// components/settings/panels/MediaQaPanel.tsx
// PBS 2026-07-13 · Media QA v1 — property-scoped naming convention rules editor.
// Rows list scope · pattern · examples · description · active. Add form below.
// Also exposes a "Re-score all" button that fires /api/marketing/media/qa-backfill in batches.
'use client';

import { useEffect, useState } from 'react';

interface Rule {
  id: string;
  property_id: number | null;
  scope: 'photo' | 'video' | null;
  pattern: string;
  regex: string | null;
  examples: string[] | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  propertyId: number;
}

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const RED    = '#B03826';
const OK_GRN = '#0E7A4B';

export default function MediaQaPanel({ propertyId }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Add-form state
  const [pattern, setPattern] = useState('');
  const [scope, setScope] = useState<'photo'|'video'|''>('');
  const [examplesText, setExamplesText] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Backfill state
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ ok: number; err: number; scanned: number; totalRun: number } | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/marketing/media/naming-conventions?property_id=${propertyId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'load_failed');
      setRules(j.rules ?? []);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [propertyId]);

  async function addRule() {
    if (!pattern.trim()) { setErr('pattern required'); return; }
    setSaving(true); setErr(null); setOk(null);
    try {
      const examples = examplesText.split(/\n+/).map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/marketing/media/naming-convention-upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          scope: scope || null,
          pattern: pattern.trim(),
          examples,
          description: description.trim() || null,
          active: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'save_failed');
      setOk('Rule saved ✓');
      setPattern(''); setExamplesText(''); setDescription(''); setScope('');
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(rule: Rule) {
    setErr(null);
    try {
      const res = await fetch('/api/marketing/media/naming-convention-upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          property_id: rule.property_id,
          scope: rule.scope,
          pattern: rule.pattern,
          examples: rule.examples ?? [],
          description: rule.description,
          active: !rule.active,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'save_failed');
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  async function deleteRule(rule: Rule) {
    if (!window.confirm(`Delete naming rule "${rule.pattern}"?`)) return;
    try {
      const res = await fetch('/api/marketing/media/naming-convention-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'delete_failed');
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  async function runBackfill(batchLimit = 20) {
    setBackfillBusy(true); setBackfillMsg('Running batch…'); setErr(null);
    let ok_total = 0, err_total = 0, scanned_total = 0;
    try {
      // Loop until no more unscored photos, or safety cap of 10 batches.
      for (let batch = 0; batch < 10; batch++) {
        const res = await fetch('/api/marketing/media/qa-backfill', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: batchLimit, property_id: propertyId }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'backfill_failed');
        const scanned = Number(j.scanned || 0);
        if (scanned === 0) break;
        ok_total += Number(j.ok_count || 0);
        err_total += Number(j.error_count || 0);
        scanned_total += scanned;
        setBackfillProgress({ ok: ok_total, err: err_total, scanned: scanned_total, totalRun: batch + 1 });
        setBackfillMsg(`Batch ${batch + 1}: ${j.ok_count}/${scanned} scored, ${j.error_count} errors. Continuing…`);
        if (scanned < batchLimit) break;
      }
      setBackfillMsg(`Done. Scored ${ok_total} / ${scanned_total}. Errors: ${err_total}.`);
    } catch (e: any) {
      setErr(e.message);
      setBackfillMsg('Aborted.');
    } finally { setBackfillBusy(false); }
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>Media QA</div>
        <div style={{ fontSize: 12, color: INK_M, marginTop: 4 }}>
          Naming-convention rules feed the QA engine. Every uploaded photo is scored 0-100 on
          technical / aesthetic / marketing, plus filename-pattern check. Quality-index = 0.4·tech + 0.3·aes + 0.3·mkt.
        </div>
      </div>

      {err && <div style={S.err}>{err}</div>}
      {ok  && <div style={S.ok}>{ok}</div>}

      {/* Backfill card */}
      <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>Backfill</div>
        <div style={{ fontSize: 11, color: INK_M, marginBottom: 10 }}>
          Score every photo that has never been through the QA engine. Runs in batches of 20 (about 40s each).
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => runBackfill(20)}
            disabled={backfillBusy}
            style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, background: backfillBusy ? INK_M : FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: backfillBusy ? 'default' : 'pointer' }}
          >{backfillBusy ? 'Running…' : 'Re-score all'}</button>
          {backfillMsg && <span style={{ fontSize: 11, color: INK_M }}>{backfillMsg}</span>}
          {backfillProgress && (
            <span style={{ fontSize: 10, color: INK_M, fontVariantNumeric: 'tabular-nums' }}>
              · runs: {backfillProgress.totalRun} · scanned: {backfillProgress.scanned} · ok: {backfillProgress.ok} · err: {backfillProgress.err}
            </span>
          )}
        </div>
      </div>

      {/* Rules table */}
      <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 12 }}>Naming conventions</div>
        {loading ? (
          <div style={{ padding: 20, color: INK_M, fontSize: 12 }}>Loading rules…</div>
        ) : rules.length === 0 ? (
          <div style={{ padding: 20, color: INK_M, fontSize: 12 }}>No rules yet. Add one below.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid ' + HAIR, textAlign: 'left', color: INK_M }}>
                <th style={S.th}>Scope</th>
                <th style={S.th}>Pattern</th>
                <th style={S.th}>Examples</th>
                <th style={S.th}>Description</th>
                <th style={S.th}>Active</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid ' + HAIR }}>
                  <td style={S.td}>{r.scope ?? 'both'}</td>
                  <td style={{ ...S.td, fontFamily: 'ui-monospace, Menlo, monospace', color: INK }}>{r.pattern}</td>
                  <td style={S.td}>
                    {(r.examples ?? []).map((e, i) => (
                      <div key={i} style={{ fontSize: 10, color: INK_M, fontFamily: 'ui-monospace, Menlo, monospace' }}>{e}</div>
                    ))}
                  </td>
                  <td style={S.td}>{r.description ?? ''}</td>
                  <td style={S.td}>
                    <button onClick={() => toggleActive(r)} style={{
                      padding: '2px 8px', fontSize: 10, fontWeight: 600, border: '1px solid ' + (r.active ? OK_GRN : HAIR),
                      background: r.active ? OK_GRN : WHITE, color: r.active ? WHITE : INK_M, borderRadius: 10, cursor: 'pointer',
                    }}>{r.active ? 'ON' : 'off'}</button>
                  </td>
                  <td style={S.td}>
                    <button onClick={() => deleteRule(r)} style={{
                      padding: '2px 8px', fontSize: 10, fontWeight: 600, border: '1px solid ' + RED,
                      background: WHITE, color: RED, borderRadius: 3, cursor: 'pointer',
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add form */}
      <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 10 }}>Add rule</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={S.lab}>Scope</div>
            <select value={scope} onChange={e => setScope(e.target.value as any)} style={S.input}>
              <option value="">Both (photo + video)</option>
              <option value="photo">Photo only</option>
              <option value="video">Video only</option>
            </select>
          </div>
          <div>
            <div style={S.lab}>Pattern (uppercase tokens auto-expand)</div>
            <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="e.g. XX_YYYYMMDD_Location_Scene_ShotType_Orientation" style={{ ...S.input, fontFamily: 'ui-monospace, Menlo, monospace' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={S.lab}>Examples (one per line)</div>
            <textarea value={examplesText} onChange={e => setExamplesText(e.target.value)} rows={3} placeholder={`GC_20260713_YogaShala_MorningYoga_Broll_Vertical\nGC_20260713_MainPool_Sunrise_Wide_Horizontal`} style={{ ...S.input, fontFamily: 'ui-monospace, Menlo, monospace' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={S.lab}>Description</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Why this pattern — what each segment means." style={S.input} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={addRule}
            disabled={saving || !pattern.trim()}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, background: !pattern.trim() ? INK_M : FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: !pattern.trim() ? 'default' : 'pointer' }}
          >{saving ? 'Saving…' : 'Save rule'}</button>
          <span style={{ fontSize: 10, color: INK_M }}>
            Tokens: YYYYMMDD · YYYY · MM · DD · XX (2 alpha) · CamelCase (word)
          </span>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  th: { padding: '8px 8px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 },
  td: { padding: '8px 8px', color: INK, verticalAlign: 'top' },
  input: { width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, color: INK, outline: 'none' },
  lab: { fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 4 },
  err: { padding: '8px 12px', fontSize: 12, background: RED, color: WHITE, borderRadius: 3, marginBottom: 12 },
  ok:  { padding: '8px 12px', fontSize: 12, background: OK_GRN, color: WHITE, borderRadius: 3, marginBottom: 12 },
};
