// components/settings/panels/PoliciesPanel.tsx
// PBS 2026-07-15: Item 5 — canonical policy items (multi-row, typed).
//
// Two sections:
//   (1) Core booking terms — legacy single-row property.policies (unchanged)
//   (2) Additional policies — new property.policy_items, one row per policy,
//       grouped by canonical policy_type. Full add / edit / delete via
//       public.fn_policy_item_upsert + fn_policy_item_delete (SECURITY DEFINER).
//
// Bridge view: public.v_property_policy_items.
// Never sb.schema('property') for writes — PostgREST public-only rule.

'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader } from './_shared';
import { supabase } from '@/lib/supabase';
import {
  btnPrimary,
  btnGhost,
  btnDanger,
  inputStyle,
  sectionTitle,
  fieldLabel,
  ErrorBanner,
  LabeledInput,
  LabeledTextarea,
  LabeledCheckbox,
  ArrayInput,
} from './_settings_ui';

// ---------- legacy row shape (unchanged from prior panel) ----------
type Row = {
  property_id: number;
  check_in_time: string | null;
  check_out_time: string | null;
  cancellation_policy: string | null;
  no_show_policy: string | null;
  modification_policy: string | null;
  early_departure_policy: string | null;
  fit_payment_terms: string | null;
  group_payment_terms: string | null;
  accepted_payment_methods: string[] | null;
  group_booking_terms: string | null;
  recommended_min_nights: number | null;
  selling_approach: string | null;
  final_note: string | null;
} | null;

interface Draft {
  check_in_time: string;
  check_out_time: string;
  cancellation_policy: string;
  no_show_policy: string;
  modification_policy: string;
  early_departure_policy: string;
  fit_payment_terms: string;
  group_payment_terms: string;
  accepted_payment_methods: string[];
  group_booking_terms: string;
  recommended_min_nights: string;
  selling_approach: string;
  final_note: string;
}

const toDraft = (r: Row): Draft => ({
  check_in_time: r?.check_in_time?.slice(0, 5) ?? '',
  check_out_time: r?.check_out_time?.slice(0, 5) ?? '',
  cancellation_policy: r?.cancellation_policy ?? '',
  no_show_policy: r?.no_show_policy ?? '',
  modification_policy: r?.modification_policy ?? '',
  early_departure_policy: r?.early_departure_policy ?? '',
  fit_payment_terms: r?.fit_payment_terms ?? '',
  group_payment_terms: r?.group_payment_terms ?? '',
  accepted_payment_methods: r?.accepted_payment_methods ?? [],
  group_booking_terms: r?.group_booking_terms ?? '',
  recommended_min_nights: r?.recommended_min_nights?.toString() ?? '',
  selling_approach: r?.selling_approach ?? '',
  final_note: r?.final_note ?? '',
});

// ---------- canonical policy_type list (must mirror CHECK constraint) ----------
type PolicyType =
  | 'cancellation_refundable'
  | 'cancellation_nonrefundable'
  | 'cancellation_group'
  | 'no_show'
  | 'deposit_prepay'
  | 'modification'
  | 'group_booking'
  | 'child_age'
  | 'extra_bed'
  | 'pet'
  | 'smoking'
  | 'photo_video_consent'
  | 'data_privacy_gdpr'
  | 'guest_id_registration'
  | 'damage_lost'
  | 'housekeeping'
  | 'complaint_handling'
  | 'payment_methods_fees'
  | 'currency_fx'
  | 'fire_safety'
  | 'emergency_evacuation'
  | 'overbooking_relocation'
  | 'checkin_checkout_flex'
  | 'other';

const CANONICAL: { key: PolicyType; label: string; group: string }[] = [
  { key: 'cancellation_refundable',    label: 'Cancellation — Refundable rate',    group: 'Cancellation' },
  { key: 'cancellation_nonrefundable', label: 'Cancellation — Non-refundable',     group: 'Cancellation' },
  { key: 'cancellation_group',         label: 'Cancellation — Group / retreat',    group: 'Cancellation' },
  { key: 'no_show',                    label: 'No-show',                            group: 'Cancellation' },
  { key: 'deposit_prepay',             label: 'Deposit / prepayment',               group: 'Payment' },
  { key: 'payment_methods_fees',       label: 'Payment methods & card fees',        group: 'Payment' },
  { key: 'currency_fx',                label: 'Currency & FX',                      group: 'Payment' },
  { key: 'modification',               label: 'Modification / date change',         group: 'Booking' },
  { key: 'group_booking',              label: 'Group booking (>N rooms)',           group: 'Booking' },
  { key: 'checkin_checkout_flex',      label: 'Early check-in / late check-out',    group: 'Booking' },
  { key: 'overbooking_relocation',     label: 'Overbooking / relocation',           group: 'Booking' },
  { key: 'child_age',                  label: 'Child / age (min age, extras)',      group: 'Guest rules' },
  { key: 'extra_bed',                  label: 'Extra bed / cot',                    group: 'Guest rules' },
  { key: 'pet',                        label: 'Pet',                                group: 'Guest rules' },
  { key: 'smoking',                    label: 'Smoking',                            group: 'Guest rules' },
  { key: 'housekeeping',               label: 'Housekeeping (opt-out, turnover)',   group: 'Guest rules' },
  { key: 'photo_video_consent',        label: 'Photo & video consent',              group: 'Privacy & compliance' },
  { key: 'data_privacy_gdpr',          label: 'Data privacy / GDPR',                group: 'Privacy & compliance' },
  { key: 'guest_id_registration',      label: 'Guest ID / registration',            group: 'Privacy & compliance' },
  { key: 'damage_lost',                label: 'Damage & lost items',                group: 'Property & safety' },
  { key: 'fire_safety',                label: 'Fire / safety',                      group: 'Property & safety' },
  { key: 'emergency_evacuation',       label: 'Emergency & evacuation',             group: 'Property & safety' },
  { key: 'complaint_handling',         label: 'Complaint handling',                 group: 'Service' },
  { key: 'other',                      label: 'Other',                              group: 'Service' },
];

const GROUP_ORDER = ['Cancellation', 'Payment', 'Booking', 'Guest rules', 'Privacy & compliance', 'Property & safety', 'Service'];

const labelFor = (t: string) => CANONICAL.find((c) => c.key === t)?.label ?? t;

type PolicyItem = {
  id: number;
  property_id: number;
  policy_type: PolicyType;
  title: string;
  body: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

interface ItemDraft {
  id: number | null;
  policy_type: PolicyType;
  title: string;
  body: string;
  active: boolean;
}

// ============================================================================
export default function PoliciesPanel({ data, propertyId }: { data: Row; propertyId: number }) {
  const router = useRouter();

  // ---- LEGACY single-row edit state (untouched behaviour) ----
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(data));
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const setF = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function saveLegacy() {
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_policies', {
        p_property_id: propertyId,
        p_check_in_time: draft.check_in_time || null,
        p_check_out_time: draft.check_out_time || null,
        p_cancellation_policy: draft.cancellation_policy.trim() || null,
        p_no_show_policy: draft.no_show_policy.trim() || null,
        p_modification_policy: draft.modification_policy.trim() || null,
        p_early_departure_policy: draft.early_departure_policy.trim() || null,
        p_fit_payment_terms: draft.fit_payment_terms.trim() || null,
        p_group_payment_terms: draft.group_payment_terms.trim() || null,
        p_accepted_payment_methods:
          draft.accepted_payment_methods.length > 0 ? draft.accepted_payment_methods : null,
        p_group_booking_terms: draft.group_booking_terms.trim() || null,
        p_recommended_min_nights: draft.recommended_min_nights ? Number(draft.recommended_min_nights) : null,
        p_selling_approach: draft.selling_approach.trim() || null,
        p_final_note: draft.final_note.trim() || null,
      });
      if (e) {
        setError(e.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  // ---- NEW multi-row policy_items state ----
  const [items, setItems] = useState<PolicyItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [addingType, setAddingType] = useState<PolicyType | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [itemBusy, setItemBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GROUP_ORDER.map((g) => [g, true])),
  );

  async function loadItems() {
    setItemsLoading(true);
    const { data: rows, error: e } = await supabase
      .from('v_property_policy_items')
      .select('*')
      .eq('property_id', propertyId)
      .order('policy_type')
      .order('sort_order')
      .order('id');
    if (e) setItemsError(e.message);
    else {
      setItems((rows ?? []) as PolicyItem[]);
      setItemsError(null);
    }
    setItemsLoading(false);
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  function beginAdd(type: PolicyType) {
    setEditingItemId(null);
    setAddingType(type);
    setItemDraft({ id: null, policy_type: type, title: '', body: '', active: true });
  }

  function beginEdit(row: PolicyItem) {
    setAddingType(null);
    setEditingItemId(row.id);
    setItemDraft({
      id: row.id,
      policy_type: row.policy_type,
      title: row.title,
      body: row.body ?? '',
      active: row.active,
    });
  }

  function cancelEditItem() {
    setEditingItemId(null);
    setAddingType(null);
    setItemDraft(null);
  }

  async function saveItem() {
    if (!itemDraft) return;
    setItemBusy(true);
    setItemsError(null);
    const { error: e } = await supabase.rpc('fn_policy_item_upsert', {
      p_id: itemDraft.id ?? 0,
      p_property_id: propertyId,
      p_policy_type: itemDraft.policy_type,
      p_title: itemDraft.title.trim() || 'Untitled',
      p_body: itemDraft.body,
      p_active: itemDraft.active,
    });
    setItemBusy(false);
    if (e) {
      setItemsError(e.message);
      return;
    }
    cancelEditItem();
    await loadItems();
  }

  async function toggleActive(row: PolicyItem) {
    setItemBusy(true);
    setItemsError(null);
    const { error: e } = await supabase.rpc('fn_policy_item_upsert', {
      p_id: row.id,
      p_property_id: propertyId,
      p_policy_type: row.policy_type,
      p_title: row.title,
      p_body: row.body ?? '',
      p_active: !row.active,
    });
    setItemBusy(false);
    if (e) {
      setItemsError(e.message);
      return;
    }
    await loadItems();
  }

  async function deleteItem(id: number) {
    setItemBusy(true);
    setItemsError(null);
    const { error: e } = await supabase.rpc('fn_policy_item_delete', { p_id: id });
    setItemBusy(false);
    if (e) {
      setItemsError(e.message);
      return;
    }
    setConfirmDelete(null);
    await loadItems();
  }

  // group items by canonical group name
  const itemsByType = new Map<string, PolicyItem[]>();
  for (const r of items) {
    const arr = itemsByType.get(r.policy_type) ?? [];
    arr.push(r);
    itemsByType.set(r.policy_type, arr);
  }

  return (
    <div>
      <PanelHeader
        title="Policies"
        subtitle="Bookings & terms · check-in/out · cancellation · payment · full canonical set"
        action={
          editing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={saveLegacy}
                disabled={busy}
                style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(toDraft(data));
                  setError(null);
                }}
                disabled={busy}
                style={btnGhost}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} style={btnPrimary}>
              Edit core terms
            </button>
          )
        }
      />
      <ErrorBanner error={error} />

      {/* ---------------- CORE BOOKING TERMS (legacy single-row) ---------------- */}
      {!editing ? (
        <div>
          <Section title="Check-in / out">
            <F label="Check-in time" value={data?.check_in_time?.slice(0, 5)} />
            <F label="Check-out time" value={data?.check_out_time?.slice(0, 5)} />
            <F label="Min nights recommended" value={data?.recommended_min_nights?.toString()} />
          </Section>
          <Section title="Cancellation & modification (summary)">
            <F label="Cancellation policy" value={data?.cancellation_policy} span={3} />
            <F label="No-show policy" value={data?.no_show_policy} span={3} />
            <F label="Modification policy" value={data?.modification_policy} span={3} />
            <F label="Early departure policy" value={data?.early_departure_policy} span={3} />
          </Section>
          <Section title="Payment (summary)">
            <F label="FIT payment terms" value={data?.fit_payment_terms} span={3} />
            <F label="Group payment terms" value={data?.group_payment_terms} span={3} />
            <F
              label="Accepted payment methods"
              value={(data?.accepted_payment_methods ?? []).join(', ') || null}
              span={3}
            />
          </Section>
          <Section title="Groups & approach">
            <F label="Group booking terms" value={data?.group_booking_terms} span={3} />
            <F label="Selling approach" value={data?.selling_approach} span={3} />
            <F label="Final note" value={data?.final_note} span={3} />
          </Section>
        </div>
      ) : (
        <div style={{ padding: 20, background: '#FAFAF7' }}>
          <FormSection title="Check-in / out">
            <LabeledInput label="Check-in time" value={draft.check_in_time} onChange={(v) => setF('check_in_time', v)} type="time" />
            <LabeledInput label="Check-out time" value={draft.check_out_time} onChange={(v) => setF('check_out_time', v)} type="time" />
            <LabeledInput label="Min nights" value={draft.recommended_min_nights} onChange={(v) => setF('recommended_min_nights', v)} type="number" />
          </FormSection>
          <FormSection title="Cancellation & modification">
            <LabeledTextarea label="Cancellation policy" value={draft.cancellation_policy} onChange={(v) => setF('cancellation_policy', v)} span={3} />
            <LabeledTextarea label="No-show policy" value={draft.no_show_policy} onChange={(v) => setF('no_show_policy', v)} span={3} />
            <LabeledTextarea label="Modification policy" value={draft.modification_policy} onChange={(v) => setF('modification_policy', v)} span={3} />
            <LabeledTextarea label="Early departure policy" value={draft.early_departure_policy} onChange={(v) => setF('early_departure_policy', v)} span={3} />
          </FormSection>
          <FormSection title="Payment">
            <LabeledTextarea label="FIT payment terms" value={draft.fit_payment_terms} onChange={(v) => setF('fit_payment_terms', v)} span={3} />
            <LabeledTextarea label="Group payment terms" value={draft.group_payment_terms} onChange={(v) => setF('group_payment_terms', v)} span={3} />
            <ArrayInput label="Accepted payment methods (comma-sep)" value={draft.accepted_payment_methods} onChange={(v) => setF('accepted_payment_methods', v)} span={3} />
          </FormSection>
          <FormSection title="Groups & approach">
            <LabeledTextarea label="Group booking terms" value={draft.group_booking_terms} onChange={(v) => setF('group_booking_terms', v)} span={3} />
            <LabeledTextarea label="Selling approach" value={draft.selling_approach} onChange={(v) => setF('selling_approach', v)} span={3} />
            <LabeledTextarea label="Final note" value={draft.final_note} onChange={(v) => setF('final_note', v)} span={3} />
          </FormSection>
        </div>
      )}

      {/* ---------------- ADDITIONAL POLICIES (multi-row typed) ---------------- */}
      <div style={{ borderTop: '4px solid #E6DFCC', marginTop: 8 }}>
        <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ ...sectionTitle, color: '#1B1B1B', margin: 0 }}>Full policy set</h3>
            <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 4 }}>
              One entry per policy · grouped by canonical type · markdown supported in body
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#5A5A5A' }}>
            {items.length} {items.length === 1 ? 'policy' : 'policies'} on file
          </div>
        </div>

        {itemsError && <ErrorBanner error={itemsError} />}

        {itemsLoading ? (
          <div style={{ padding: 20, fontSize: 12, color: '#5A5A5A' }}>Loading policies…</div>
        ) : (
          GROUP_ORDER.map((groupName) => {
            const groupTypes = CANONICAL.filter((c) => c.group === groupName);
            const groupItemCount = groupTypes.reduce(
              (n, c) => n + (itemsByType.get(c.key)?.length ?? 0),
              0,
            );
            const isOpen = openGroups[groupName] ?? true;
            return (
              <section
                key={groupName}
                style={{ borderTop: '1px solid #E6DFCC' }}
              >
                <button
                  type="button"
                  onClick={() => setOpenGroups((g) => ({ ...g, [groupName]: !isOpen }))}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    background: '#FAFAF7',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1F3A2E' }}>
                    {isOpen ? '▾' : '▸'} {groupName}
                  </span>
                  <span style={{ fontSize: 11, color: '#5A5A5A' }}>
                    {groupItemCount} {groupItemCount === 1 ? 'entry' : 'entries'} · {groupTypes.length} types
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 20px 12px' }}>
                    {groupTypes.map((c) => {
                      const rows = itemsByType.get(c.key) ?? [];
                      const isAdding = addingType === c.key;
                      return (
                        <div key={c.key} style={{ borderBottom: '1px dashed #E6DFCC', padding: '10px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: rows.length ? 8 : 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#1B1B1B' }}>{c.label}</div>
                            {!isAdding && editingItemId === null && (
                              <button type="button" onClick={() => beginAdd(c.key)} style={btnGhost}>
                                {rows.length === 0 ? 'Add first policy →' : '+ Add another'}
                              </button>
                            )}
                          </div>

                          {rows.length === 0 && !isAdding && (
                            <div style={{ fontSize: 12, color: '#8A8A8A', fontStyle: 'italic' }}>No policy on file.</div>
                          )}

                          {rows.map((r) => {
                            const isEditingRow = editingItemId === r.id;
                            if (isEditingRow && itemDraft) {
                              return (
                                <PolicyItemEditor
                                  key={r.id}
                                  draft={itemDraft}
                                  onChange={setItemDraft}
                                  onSave={saveItem}
                                  onCancel={cancelEditItem}
                                  busy={itemBusy}
                                  hideTypeSelect
                                />
                              );
                            }
                            return (
                              <div
                                key={r.id}
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px solid #E6DFCC',
                                  borderRadius: 4,
                                  padding: '10px 12px',
                                  marginBottom: 6,
                                  opacity: r.active ? 1 : 0.55,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B' }}>
                                      {r.title}
                                      {!r.active && (
                                        <span style={{ marginLeft: 8, fontSize: 10, color: '#8A8A8A', fontWeight: 500 }}>(inactive)</span>
                                      )}
                                    </div>
                                    {r.body && (
                                      <div style={{ fontSize: 12, color: '#333', marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {r.body}
                                      </div>
                                    )}
                                    <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 6 }}>
                                      Updated {new Date(r.updated_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      onClick={() => toggleActive(r)}
                                      disabled={itemBusy}
                                      style={{ ...btnGhost, fontSize: 11 }}
                                      title={r.active ? 'Deactivate' : 'Activate'}
                                    >
                                      {r.active ? 'Active' : 'Inactive'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => beginEdit(r)}
                                      disabled={itemBusy || editingItemId !== null || addingType !== null}
                                      style={{ ...btnGhost, fontSize: 11 }}
                                    >
                                      Edit
                                    </button>
                                    {confirmDelete === r.id ? (
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button
                                          type="button"
                                          onClick={() => deleteItem(r.id)}
                                          disabled={itemBusy}
                                          style={{ ...btnDanger, fontSize: 11 }}
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDelete(null)}
                                          disabled={itemBusy}
                                          style={{ ...btnGhost, fontSize: 11 }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDelete(r.id)}
                                        disabled={itemBusy || editingItemId !== null || addingType !== null}
                                        style={{ ...btnGhost, fontSize: 11, color: '#B03826' }}
                                        title="Delete"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {isAdding && itemDraft && (
                            <PolicyItemEditor
                              draft={itemDraft}
                              onChange={setItemDraft}
                              onSave={saveItem}
                              onCancel={cancelEditItem}
                              busy={itemBusy}
                              hideTypeSelect
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------- helpers ----------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: '16px 20px', borderBottom: '1px solid #E6DFCC' }}>
      <h3 style={sectionTitle}>{title}</h3>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px 24px', margin: 0 }}>
        {children}
      </dl>
    </section>
  );
}

function F({ label, value, span = 1 }: { label: string; value: string | null | undefined; span?: 1 | 2 | 3 }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <dt style={fieldLabel}>{label}</dt>
      <dd
        style={{
          fontSize: 13,
          margin: 0,
          color: empty ? '#8A8A8A' : '#1B1B1B',
          fontStyle: empty ? 'italic' : 'normal',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {empty ? '—' : value}
      </dd>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>{children}</div>
    </div>
  );
}

function PolicyItemEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
  hideTypeSelect,
}: {
  draft: ItemDraft;
  onChange: (d: ItemDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  hideTypeSelect?: boolean;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #1F3A2E',
        borderRadius: 4,
        padding: 12,
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: hideTypeSelect ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 10 }}>
        {!hideTypeSelect && (
          <div>
            <div style={fieldLabel}>Policy type</div>
            <select
              value={draft.policy_type}
              onChange={(e) => onChange({ ...draft, policy_type: e.target.value as PolicyType })}
              style={inputStyle}
            >
              {CANONICAL.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <LabeledInput
          label="Title"
          value={draft.title}
          onChange={(v) => onChange({ ...draft, title: v })}
          placeholder={hideTypeSelect ? `e.g. ${labelFor(draft.policy_type)}` : 'Short label'}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={fieldLabel}>Body (markdown ok)</div>
        <textarea
          value={draft.body}
          onChange={(e) => onChange({ ...draft, body: e.target.value })}
          rows={5}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LabeledCheckbox
          label="Active"
          checked={draft.active}
          onChange={(v) => onChange({ ...draft, active: v })}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}
          >
            {busy ? 'Saving…' : 'Save policy'}
          </button>
          <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
