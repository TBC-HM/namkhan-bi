// components/settings/panels/LicensesPanel.tsx
// PBS 2026-07-15 (Item 6): full CRUD — boutique-hotel licenses & regulatory docs.
// Renewal-awareness: red pill "Expiring in Nd" if valid_to within 60d, grey
// "Expired" if past. Sorted by valid_to ascending (soonest expiry first).
//
// Reads:  public.v_property_licenses (bridge view over property.licenses)
// Writes: public.fn_license_upsert / fn_license_delete (SECURITY DEFINER RPCs
//         — PostgREST silently no-ops writes to non-public schemas).
'use client';

import { useEffect, useState, useTransition } from 'react';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';

type LicenseRow = {
  id: number;
  property_id: number;
  license_type: string;
  license_number: string | null;
  issuer: string | null;
  valid_from: string | null;
  valid_to: string | null;
  document_url: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

interface Draft {
  id: number | null;
  license_type: string;
  license_number: string;
  issuer: string;
  valid_from: string;
  valid_to: string;
  document_url: string;
  notes: string;
}

// Canonical dropdown — mirrors the comment inside fn_license_upsert.
const LICENSE_TYPES = [
  'Hotel Operating License',
  'Tourism License',
  'Business Registration',
  'Alcohol License',
  'Food & Beverage License',
  'Music / Entertainment License',
  'Fire Safety Certificate',
  'Boat Operator License',
  'Pool Operator License',
  'Tax Registration',
  'Employer Registration',
  'Insurance Policy (public liability)',
  'Insurance Policy (property)',
  'Other',
] as const;

const EMPTY: Draft = {
  id: null,
  license_type: LICENSE_TYPES[0],
  license_number: '',
  issuer: '',
  valid_from: '',
  valid_to: '',
  document_url: '',
  notes: '',
};

function toDraft(r: LicenseRow): Draft {
  return {
    id:             r.id,
    license_type:   r.license_type ?? LICENSE_TYPES[0],
    license_number: r.license_number ?? '',
    issuer:         r.issuer ?? '',
    valid_from:     r.valid_from ?? '',
    valid_to:       r.valid_to ?? '',
    document_url:   r.document_url ?? '',
    notes:          r.notes ?? '',
  };
}

// Returns { kind: 'ok' | 'expiring' | 'expired', days: number|null, label: string|null }
function expiryStatus(validTo: string | null): { kind: 'ok' | 'expiring' | 'expired'; days: number | null; label: string | null } {
  if (!validTo) return { kind: 'ok', days: null, label: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(validTo);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - today.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return { kind: 'expired', days, label: 'Expired' };
  if (days <= 60) return { kind: 'expiring', days, label: `Expiring in ${days}d` };
  return { kind: 'ok', days, label: null };
}

// Sort key: soonest valid_to first, nulls last.
function sortRows(rows: LicenseRow[]): LicenseRow[] {
  return [...rows].sort((a, b) => {
    if (!a.valid_to && !b.valid_to) return 0;
    if (!a.valid_to) return 1;
    if (!b.valid_to) return -1;
    return a.valid_to.localeCompare(b.valid_to);
  });
}

export default function LicensesPanel({ propertyId }: { propertyId: number }) {
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('v_property_licenses')
      .select('*')
      .eq('property_id', propertyId);
    if (e) { setError(e.message); setRows([]); }
    else   { setRows(sortRows((data ?? []) as LicenseRow[])); setError(null); }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [propertyId]);

  function save() {
    if (!draft) return;
    if (!draft.license_type.trim()) { setError('License type is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_license_upsert', {
        p_id:             draft.id,
        p_property_id:    propertyId,
        p_license_type:   draft.license_type.trim(),
        p_license_number: draft.license_number.trim() || null,
        p_issuer:         draft.issuer.trim() || null,
        p_valid_from:     draft.valid_from || null,
        p_valid_to:       draft.valid_to || null,
        p_document_url:   draft.document_url.trim() || null,
        p_notes:          draft.notes.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null);
      await load();
    });
  }

  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_license_delete', { p_id: id });
      if (e) { setError(e.message); return; }
      setConfirmDelete(null);
      await load();
    });
  }

  const count = rows.length;
  const expiringSoon = rows.filter((r) => {
    const s = expiryStatus(r.valid_to);
    return s.kind === 'expiring';
  }).length;
  const expiredCount = rows.filter((r) => expiryStatus(r.valid_to).kind === 'expired').length;

  const subtitleParts = [
    `${count} entr${count === 1 ? 'y' : 'ies'}`,
    expiringSoon > 0 ? `${expiringSoon} expiring soon` : null,
    expiredCount > 0 ? `${expiredCount} expired` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div>
      <PanelHeader
        title="Licenses"
        subtitle={subtitleParts}
        action={<button type="button" onClick={() => setDraft({ ...EMPTY })} style={btnPrimary}>+ Add</button>}
      />

      {error && (
        <div style={{ margin: '12px 20px', padding: 10, background: '#FBE8E4', border: '1px solid #E8B7AB', borderRadius: 4, fontSize: 12, color: '#8A2419' }}>
          {error}
        </div>
      )}

      {draft && (
        <LicenseForm
          draft={draft}
          onChange={setDraft}
          onSave={save}
          onCancel={() => { setDraft(null); setError(null); }}
          busy={busy}
        />
      )}

      {loading ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13, color: '#5A5A5A' }}>Loading…</div>
      ) : rows.length === 0 && !draft ? (
        <EmptyState message="No licenses or regulatory documents yet." />
      ) : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => {
            const status = expiryStatus(r.valid_to);
            return (
              <div key={r.id} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1B1B1B' }}>{r.license_type}</span>
                    {r.license_number && (
                      <span style={{ fontSize: 12, color: '#5A5A5A' }}>
                        #<strong style={{ color: '#1B1B1B' }}>{r.license_number}</strong>
                      </span>
                    )}
                    {status.kind === 'expired' && (
                      <span style={pill('#F5F0E1', '#8A8A8A')}>{status.label}</span>
                    )}
                    {status.kind === 'expiring' && (
                      <span style={pill('#FBE8E4', '#8A2419')}>{status.label}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {r.issuer && <span>Issued by {r.issuer}</span>}
                    {r.valid_from && <span>from {r.valid_from.slice(0, 10)}</span>}
                    {r.valid_to && <span>to {r.valid_to.slice(0, 10)}</span>}
                    {r.document_url && (
                      <a href={r.document_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1F3A2E' }}>
                        document ↗
                      </a>
                    )}
                  </div>
                  {r.notes && <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3, fontStyle: 'italic' }}>{r.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
                  {confirmDelete === r.id ? (
                    <>
                      <button type="button" onClick={() => del(r.id)} disabled={busy} style={btnDanger}>{busy ? '…' : 'Confirm'}</button>
                      <button type="button" onClick={() => setConfirmDelete(null)} style={btnGhost}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(r.id)} style={btnGhost}>Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LicenseForm({ draft, onChange, onSave, onCancel, busy }: {
  draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; busy: boolean;
}) {
  const setF = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  return (
    <div style={{ padding: 20, background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1F3A2E', marginBottom: 10 }}>
        {draft.id ? 'Edit license' : 'New license / regulatory document'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <F label="License type *">
          <select value={draft.license_type} onChange={(e) => setF('license_type', e.target.value)} style={input}>
            {LICENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </F>
        <F label="License number">
          <input type="text" value={draft.license_number} onChange={(e) => setF('license_number', e.target.value)} placeholder="Reference / ID" style={input} />
        </F>
        <F label="Issuer">
          <input type="text" value={draft.issuer} onChange={(e) => setF('issuer', e.target.value)} placeholder="Ministry · municipality · insurer" style={input} />
        </F>
        <F label="Valid from">
          <input type="date" value={draft.valid_from} onChange={(e) => setF('valid_from', e.target.value)} style={input} />
        </F>
        <F label="Valid to">
          <input type="date" value={draft.valid_to} onChange={(e) => setF('valid_to', e.target.value)} style={input} />
        </F>
        <F label="Document URL">
          <input type="url" value={draft.document_url} onChange={(e) => setF('document_url', e.target.value)} placeholder="https://…" style={input} />
        </F>
        <F label="Notes" span={3}>
          <input type="text" value={draft.notes} onChange={(e) => setF('notes', e.target.value)} style={input} />
        </F>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button type="button" onClick={onSave} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

function F({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 | 3 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

const btnPrimary: React.CSSProperties = { padding: '7px 14px', background: '#1F3A2E', color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost:   React.CSSProperties = { padding: '6px 12px', background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };
const btnDanger:  React.CSSProperties = { padding: '6px 12px', background: '#B03826', color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const input:      React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', fontSize: 13, fontFamily: 'inherit' };
const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 4 };
const rowStyle:   React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4 };
function pill(bg: string, color: string): React.CSSProperties {
  return { padding: '1px 8px', borderRadius: 99, background: bg, color, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' };
}
