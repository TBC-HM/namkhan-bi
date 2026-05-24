// components/settings/panels/IdentityPanel.tsx
// PBS #161 (2026-05-24) — editable Identity panel ("uplink"). Edits save via
// public.fn_update_property_identity SECURITY DEFINER RPC. property schema
// isn't exposed through PostgREST (claude_md §0.5), so the RPC bridge is the
// only legal write path. Whitelisted columns: legal_name, trading_name,
// business_license_no, tax_id, vat_registered, star_rating, category,
// affiliations. Pattern: this panel is the canonical reference; the other 11
// panels (Location, Brand, Policies, Rooms, Facilities, Activities, Seasons,
// Certifications, Contacts, Social, Team) follow the same shape once PBS
// signs off on Identity.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, Field, Section, ChipList, Chip, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';

type IdentityRow = {
  legal_name?: string | null;
  trading_name?: string | null;
  business_license_no?: string | null;
  tax_id?: string | null;
  vat_registered?: boolean | null;
  star_rating?: number | null;
  category?: string | null;
  affiliations?: string[] | null;
};

export default function IdentityPanel({
  data,
  propertyId,
}: {
  data: IdentityRow | null;
  propertyId: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<IdentityRow>(() => ({
    legal_name: data?.legal_name ?? '',
    trading_name: data?.trading_name ?? '',
    business_license_no: data?.business_license_no ?? '',
    tax_id: data?.tax_id ?? '',
    vat_registered: data?.vat_registered ?? false,
    star_rating: data?.star_rating ?? null,
    category: data?.category ?? '',
    affiliations: data?.affiliations ?? [],
  }));

  function reset() {
    setDraft({
      legal_name: data?.legal_name ?? '',
      trading_name: data?.trading_name ?? '',
      business_license_no: data?.business_license_no ?? '',
      tax_id: data?.tax_id ?? '',
      vat_registered: data?.vat_registered ?? false,
      star_rating: data?.star_rating ?? null,
      category: data?.category ?? '',
      affiliations: data?.affiliations ?? [],
    });
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const patch: Record<string, unknown> = {
        legal_name: draft.legal_name?.trim() || null,
        trading_name: draft.trading_name?.trim() || null,
        business_license_no: draft.business_license_no?.trim() || null,
        tax_id: draft.tax_id?.trim() || null,
        vat_registered: !!draft.vat_registered,
        star_rating: draft.star_rating ?? null,
        category: draft.category?.trim() || null,
        affiliations: (draft.affiliations ?? []).map((a) => a.trim()).filter(Boolean),
      };
      const { error: rpcErr } = await supabase.rpc('fn_update_property_identity', {
        p_property_id: propertyId,
        p_patch: patch,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!data && !editing) {
    return (
      <>
        <PanelHeader
          title="Identity"
          action={
            <button onClick={() => setEditing(true)} style={btnPrimary}>
              Add identity
            </button>
          }
        />
        <EmptyState message="No identity record found." />
      </>
    );
  }

  return (
    <>
      <PanelHeader
        title="Identity"
        subtitle="Legal entity, classification, and licensing"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Chip>Property ID {propertyId}</Chip>
            {editing ? (
              <>
                <button onClick={() => { reset(); setEditing(false); }} style={btnSecondary} disabled={saving}>Cancel</button>
                <button onClick={save} style={btnPrimary} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} style={btnPrimary}>Edit</button>
            )}
          </div>
        }
      />
      {error && (
        <div style={{ padding: '8px 24px', color: 'var(--st-bad, #C0584C)', fontSize: 'var(--t-sm)' }}>
          Save failed: {error}
        </div>
      )}
      <Section title="Legal Entity">
        {editing ? (
          <>
            <EditField label="Legal name" span={2}>
              <input style={inputStyle} value={draft.legal_name ?? ''} onChange={(e) => setDraft({ ...draft, legal_name: e.target.value })} />
            </EditField>
            <EditField label="Trading name">
              <input style={inputStyle} value={draft.trading_name ?? ''} onChange={(e) => setDraft({ ...draft, trading_name: e.target.value })} />
            </EditField>
            <EditField label="Business license #">
              <input style={inputStyle} value={draft.business_license_no ?? ''} onChange={(e) => setDraft({ ...draft, business_license_no: e.target.value })} />
            </EditField>
            <EditField label="Tax ID">
              <input style={inputStyle} value={draft.tax_id ?? ''} onChange={(e) => setDraft({ ...draft, tax_id: e.target.value })} />
            </EditField>
            <EditField label="VAT registered">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-sm)' }}>
                <input
                  type="checkbox"
                  checked={!!draft.vat_registered}
                  onChange={(e) => setDraft({ ...draft, vat_registered: e.target.checked })}
                />
                <span>{draft.vat_registered ? 'Yes' : 'No'}</span>
              </label>
            </EditField>
          </>
        ) : (
          <>
            <Field label="Legal name" value={data?.legal_name} span={2} />
            <Field label="Trading name" value={data?.trading_name} />
            <Field label="Business license #" value={data?.business_license_no} />
            <Field label="Tax ID" value={data?.tax_id} />
            <Field
              label="VAT registered"
              value={data?.vat_registered ? <Chip tone="green">Yes</Chip> : <Chip tone="muted">No</Chip>}
            />
          </>
        )}
      </Section>
      <Section title="Classification">
        {editing ? (
          <>
            <EditField label="Star rating">
              <select
                style={inputStyle}
                value={draft.star_rating ?? ''}
                onChange={(e) => setDraft({ ...draft, star_rating: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>
                ))}
              </select>
            </EditField>
            <EditField label="Category" span={2}>
              <input style={inputStyle} value={draft.category ?? ''} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </EditField>
            <EditField label="Affiliations (comma-separated)" span={3}>
              <input
                style={inputStyle}
                value={(draft.affiliations ?? []).join(', ')}
                onChange={(e) => setDraft({ ...draft, affiliations: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                placeholder="SLH, ASEAN Green, …"
              />
            </EditField>
          </>
        ) : (
          <>
            <Field
              label="Star rating"
              value={data?.star_rating ? '★'.repeat(data.star_rating) + ' (' + data.star_rating + ')' : null}
            />
            <Field label="Category" value={data?.category} span={2} />
            <Field label="Affiliations" value={<ChipList items={data?.affiliations} />} span={3} />
          </>
        )}
      </Section>
    </>
  );
}

function EditField({ label, span = 1, children }: { label: string; span?: 1 | 2 | 3; children: React.ReactNode }) {
  const spanCls = { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3' }[span];
  return (
    <div className={spanCls}>
      <dt
        className="uppercase tracking-wider font-medium mb-1.5"
        style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}
      >
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: 'var(--paper-deep, #F4EFE2)',
  border: '1px solid var(--border, #E6DFCC)',
  borderRadius: 4,
  color: 'var(--ink, #1B1B1B)',
  fontSize: 'var(--t-sm, 13px)',
  fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--brass, #C4A06B)',
  color: 'var(--paper-deep, #1B1B1B)',
  border: 'none',
  borderRadius: 4,
  fontSize: 'var(--t-xs, 11px)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  color: 'var(--ink-mute, #5A5A5A)',
  border: '1px solid var(--border, #E6DFCC)',
  borderRadius: 4,
  fontSize: 'var(--t-xs, 11px)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 500,
  cursor: 'pointer',
};
