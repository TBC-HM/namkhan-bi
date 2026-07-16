'use client';
// app/sales/leads/_components/LeadsCMSClient.tsx
// PBS 2026-07-14 (Sales CRM upgrade) — the CMS heart:
//   - filter bar: stage chips (multi-select), search, priority
//   - lead table (paper white + hairlines)
//   - row click -> right-side profile drawer with 4 tabs:
//       Overview (edit form) / Timeline / Emails / Notes
//   - + New Lead button -> empty drawer in create mode
//   - Sticky drawer header: back/advance stage buttons + delete
//
// All writes go through /api/sales/leads/* (SECURITY DEFINER RPCs).

import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── tokens (PBS 2026-07-01 hardcoded, no var(--paper-warm)) ─────────────
const T = {
  WHITE:  '#FFFFFF',
  PAPER:  '#FFFFFF',
  HAIR:   '#E6DFCC',
  INK:    '#1B1B1B',
  INK_M:  '#5A5A5A',
  INK_S:  '#3A3A3A',
  FOREST: '#084838',
  CREAM:  '#F5F0E1',
  RED:    '#B03826',
  AMBER:  '#B48A3A',
  MOSS:   '#4C7A5E',
};

// ─── types ────────────────────────────────────────────────────────────────
export interface LeadRow {
  id: number;
  property_id: number;
  lead_id: string | null;
  company_name: string | null;
  category: string | null;
  subcategory: string | null;
  country: string | null;
  city: string | null;
  language: string | null;
  website: string | null;
  instagram_url: string | null;
  decision_maker_name: string | null;
  decision_maker_role: string | null;
  email: string | null;
  phone_whatsapp: string | null;
  icp_score: number | null;
  intent_score: number | null;
  final_priority: string | null;
  status: string | null;
  notes: string | null;
  source: string | null;
  source_ref: string | null;
  origin: string | null;
  deal_type: string | null;
  account_id: string | null;
  stage: string | null;
  stage_display_name: string | null;
  stage_order: number | null;
  is_won: boolean | null;
  is_lost: boolean | null;
  account_name: string | null;
  stage_changed_at: string | null;
  next_touch_at: string | null;
  converted_value_eur: number | null;
  email_thread_id: string | null;
  first_message_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}
export interface StageRow {
  stage_key: string;
  stage_order: number;
  display_name: string;
  is_won: boolean;
  is_lost: boolean;
}
// PBS 2026-07-15 — Proposal template row (public.v_sales_proposal_templates).
export interface ProposalTemplateRow {
  id: string;
  property_id: number;
  kind: string;
  name: string;
  slug: string;
  brand_voice_lang: string | null;
  is_active: boolean;
}
// PBS 2026-07-15 — per-lead proposal count (public.v_lead_proposal_counts).
export interface LeadProposalCountRow {
  lead_id: number;
  proposal_count: number;
}
interface TimelineEntry {
  lead_id: number;
  at: string;
  kind: 'event' | 'email';
  direction: 'in' | 'out' | null;
  summary: string;
  metadata: Record<string, unknown> | null;
}
interface Props {
  initialLeads: LeadRow[];
  stages: StageRow[];
  propertyId: number;
  highlightId: number | null;
  // PBS 2026-07-15 — proposals wiring (both optional so older mounts still compile).
  templates?: ProposalTemplateRow[];
  proposalCounts?: LeadProposalCountRow[];
}

// ─── helpers ──────────────────────────────────────────────────────────────
function relTime(iso: string | null): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.round(hrs / 24);
  if (days < 30) return days + 'd ago';
  const d = new Date(then);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}
function stageColor(stage: string | null): string {
  switch (stage) {
    case 'new':         return T.INK_M;
    case 'contacted':   return T.AMBER;
    case 'engaged':     return T.MOSS;
    case 'qualified':   return T.FOREST;
    case 'proposal':    return T.FOREST;
    case 'negotiation': return T.FOREST;
    case 'won':         return T.FOREST;
    case 'lost':        return T.RED;
    default:            return T.INK_M;
  }
}
function priorityColor(p: string | null): string {
  switch ((p ?? '').toLowerCase()) {
    case 'high':   return T.RED;
    case 'medium': return T.AMBER;
    case 'low':    return T.INK_M;
    default:       return T.INK_M;
  }
}

// ─── component ────────────────────────────────────────────────────────────
export default function LeadsCMSClient({
  initialLeads, stages, propertyId, highlightId,
  templates = [], proposalCounts = [],
}: Props) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<number | null>(highlightId ?? null);
  const [createMode, setCreateMode] = useState<boolean>(false);
  const [stageFilter, setStageFilter] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // PBS 2026-07-15 — proposal wiring.
  const [proposalLeadId, setProposalLeadId] = useState<number | null>(null);   // opens template picker
  const proposalCountMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of proposalCounts) m.set(r.lead_id, r.proposal_count);
    return m;
  }, [proposalCounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter.size > 0 && (!l.stage || !stageFilter.has(l.stage))) return false;
      if (priorityFilter && (l.final_priority ?? '').toLowerCase() !== priorityFilter.toLowerCase()) return false;
      if (q) {
        const hay = [l.company_name, l.email, l.decision_maker_name, l.country, l.city]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, stageFilter, priorityFilter, search]);

  const activeLead = useMemo(
    () => (selectedId != null ? leads.find((l) => l.id === selectedId) ?? null : null),
    [leads, selectedId],
  );

  const refresh = useCallback(async () => {
    const r = await fetch('/api/sales/leads?limit=500&property_id=' + propertyId);
    if (!r.ok) return;
    const j = await r.json();
    setLeads((j.leads ?? []) as LeadRow[]);
  }, [propertyId]);

  function toggleStage(k: string) {
    setStageFilter((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k); else s.add(k);
      return s;
    });
  }

  const openCreate = () => { setCreateMode(true); setSelectedId(null); };
  const closeDrawer = () => { setCreateMode(false); setSelectedId(null); };
  const openLead = (id: number) => { setCreateMode(false); setSelectedId(id); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ─── header ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '8px 0',
      }}>
        <div style={{ fontSize: 12, color: T.INK_M }}>
          {filtered.length} of {leads.length} leads
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => alert('CSV import coming soon.')}
            style={btnStyleGhost()}>Import CSV</button>
          <button type="button" onClick={openCreate} style={btnStylePrimary()}>+ New Lead</button>
        </div>
      </div>

      {/* ─── filter bar ─── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        padding: 12, background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4,
      }}>
        <div style={{ fontSize: 11, color: T.INK_M, marginRight: 4 }}>Stage:</div>
        {stages.map((s) => {
          const on = stageFilter.has(s.stage_key);
          return (
            <button key={s.stage_key} type="button" onClick={() => toggleStage(s.stage_key)} style={chipStyle(on)}>
              {s.display_name}
            </button>
          );
        })}
        <div style={{ width: 1, height: 20, background: T.HAIR, margin: '0 8px' }} />
        <div style={{ fontSize: 11, color: T.INK_M, marginRight: 4 }}>Priority:</div>
        {['', 'high', 'medium', 'low'].map((p) => (
          <button key={p || 'any'} type="button" onClick={() => setPriorityFilter(p)} style={chipStyle(priorityFilter === p)}>
            {p || 'any'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input type="text" placeholder="Search company / email / name" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 10px', fontSize: 12, background: T.WHITE,
            border: '1px solid ' + T.HAIR, borderRadius: 4, color: T.INK, minWidth: 220,
          }} />
      </div>

      {/* ─── table ─── */}
      <div style={{ background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: T.INK }}>
          <thead>
            <tr style={{ background: T.CREAM }}>
              {['Company','Contact','Email','Country','Stage','Priority','Changed','Next touch','Actions'].map((h) => (
                <th key={h} style={thStyle()}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: T.INK_M }}>
                No leads match the current filter.
              </td></tr>
            ) : filtered.map((l) => {
              const proposalCount = proposalCountMap.get(l.id) ?? 0;
              return (
              <tr key={l.id} onClick={() => openLead(l.id)} style={{ cursor: 'pointer', background: selectedId === l.id ? T.CREAM : T.WHITE }}>
                <td style={tdStyle()}><span style={{ fontWeight: 600 }}>{l.company_name ?? '—'}</span></td>
                <td style={tdStyle()}>{l.decision_maker_name ?? ''}<span style={{ color: T.INK_M }}>{l.decision_maker_role ? ' · ' + l.decision_maker_role : ''}</span></td>
                <td style={tdStyle()}>{l.email ?? ''}</td>
                <td style={tdStyle()}>{[l.city, l.country].filter(Boolean).join(', ')}</td>
                <td style={tdStyle()}>
                  <span style={pillStyle(stageColor(l.stage))}>{l.stage_display_name ?? l.stage ?? '—'}</span>
                </td>
                <td style={tdStyle()}>
                  {l.final_priority ? <span style={pillStyle(priorityColor(l.final_priority))}>{l.final_priority}</span> : ''}
                </td>
                <td style={{ ...tdStyle(), color: T.INK_M, whiteSpace: 'nowrap' }}>{relTime(l.stage_changed_at)}</td>
                <td style={{ ...tdStyle(), color: T.INK_M, whiteSpace: 'nowrap' }}>{l.next_touch_at ? new Date(l.next_touch_at).toLocaleDateString() : ''}</td>
                {/* PBS 2026-07-15 — Create proposal + jump-to-proposals cell. */}
                <td style={{ ...tdStyle(), whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button type="button"
                      onClick={() => setProposalLeadId(l.id)}
                      title="Create a proposal pre-filled from this lead"
                      style={rowActionBtn()}>
                      + Proposal
                    </button>
                    {proposalCount > 0 && (
                      <a href={'/sales/proposals?lead_id=' + l.id}
                        onClick={(e) => e.stopPropagation()}
                        title={proposalCount + ' existing proposal' + (proposalCount === 1 ? '' : 's')}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 999,
                          background: T.CREAM, color: T.FOREST, textDecoration: 'none',
                          border: '1px solid ' + T.HAIR, fontWeight: 600,
                        }}>
                        → {proposalCount}
                      </a>
                    )}
                    {/* PBS 2026-07-16 — icon CTAs. Email opens in-app compose at /mail, Archive sets status=archived, Delete soft-deletes. */}
                    {l.email && (
                      <a href={'/mail?compose=1&to=' + encodeURIComponent(l.email) + (l.company_name ? '&subject=' + encodeURIComponent('The Namkhan · ' + l.company_name) : '')}
                        onClick={(e) => e.stopPropagation()}
                        title={'Compose to ' + l.email + ' (opens /mail)'}
                        style={iconBtnStyle()}>
                        ✉
                      </a>
                    )}
                    <button type="button"
                      onClick={async () => {
                        if (!confirm('Archive lead "' + (l.company_name || l.email || 'this') + '"?')) return;
                        const r = await fetch('/api/sales/leads/' + l.id, {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'archived' }),
                        });
                        if (r.ok) refresh(); else alert('Archive failed');
                      }}
                      title="Archive lead (hide from active pipeline)"
                      style={iconBtnStyle()}>
                      📦
                    </button>
                    <button type="button"
                      onClick={async () => {
                        if (!confirm('Delete lead "' + (l.company_name || l.email || 'this') + '"? (soft delete — recoverable)')) return;
                        const r = await fetch('/api/sales/leads/' + l.id, { method: 'DELETE' });
                        if (r.ok) refresh(); else alert('Delete failed');
                      }}
                      title="Delete lead (soft delete — status='deleted')"
                      style={{ ...iconBtnStyle(), color: '#B04A2F' }}>
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── drawer ─── */}
      {(createMode || activeLead) && (
        <LeadProfileDrawer
          lead={createMode ? null : activeLead}
          stages={stages}
          propertyId={propertyId}
          templates={templates}
          onClose={closeDrawer}
          onSaved={async (id) => { await refresh(); setCreateMode(false); setSelectedId(id); }}
          onDeleted={async () => { await refresh(); closeDrawer(); }}
          onStageChanged={refresh}
          onCreateProposal={(id) => setProposalLeadId(id)}
        />
      )}

      {/* PBS 2026-07-15 — proposal template picker modal. */}
      {proposalLeadId != null && (
        <CreateProposalModal
          leadId={proposalLeadId}
          lead={leads.find((l) => l.id === proposalLeadId) ?? null}
          templates={templates}
          onClose={() => setProposalLeadId(null)}
        />
      )}
    </div>
  );
}

// ─── proposal template picker modal ─────────────────────────────────────
// PBS 2026-07-15. Small, focused: pick a template + confirm dates, POST to
// /api/sales/proposals/create-from-lead, navigate to the composer on success.
function CreateProposalModal({ leadId, lead, templates, onClose }: {
  leadId: number;
  lead: LeadRow | null;
  templates: ProposalTemplateRow[];
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? '');
  const [dateIn, setDateIn] = useState<string>('');
  const [dateOut, setDateOut] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!templateId) { setErr('Pick a template first.'); return; }
    setSubmitting(true); setErr(null);
    try {
      const r = await fetch('/api/sales/proposals/create-from-lead', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lead_id:  leadId,
          template_id: templateId,
          date_in:  dateIn  || null,
          date_out: dateOut || null,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.id) throw new Error(j.error || 'create_failed');
      window.location.href = '/sales/proposals/' + j.id + '/edit';
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 60, cursor: 'pointer',
      }} />
      <div role="dialog" aria-modal="true" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 460, maxWidth: '92vw', background: T.WHITE, border: '1px solid ' + T.HAIR,
        borderRadius: 6, boxShadow: '0 24px 48px rgba(0,0,0,0.28)', zIndex: 61,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid ' + T.HAIR,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.INK }}>
            Create proposal · {lead?.company_name ?? 'lead #' + leadId}
          </div>
          <button type="button" onClick={onClose} style={btnStyleGhost()}>✕</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, color: T.INK_M, textTransform: 'uppercase', letterSpacing: 0.5 }}>Template</span>
            {templates.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: T.RED, background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 3 }}>
                No active templates for this property. Seed some in sales.proposal_templates.
              </div>
            ) : (
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                style={{
                  padding: '8px 10px', fontSize: 13, background: T.WHITE,
                  border: '1px solid ' + T.HAIR, borderRadius: 3, color: T.INK,
                }}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} · {t.kind}</option>
                ))}
              </select>
            )}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, color: T.INK_M, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date in (optional)</span>
              <input type="date" value={dateIn} onChange={(e) => setDateIn(e.target.value)}
                style={{ padding: '6px 8px', fontSize: 12, background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 3, color: T.INK }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, color: T.INK_M, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date out (optional)</span>
              <input type="date" value={dateOut} onChange={(e) => setDateOut(e.target.value)}
                style={{ padding: '6px 8px', fontSize: 12, background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 3, color: T.INK }} />
            </label>
          </div>
          <div style={{ fontSize: 11, color: T.INK_M }}>
            The composer will open with the lead's guest name pre-filled. Dates can be edited later.
          </div>
          {err && <div style={{ color: T.RED, fontSize: 12 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={btnStyleGhost()}>Cancel</button>
            <button type="button" onClick={submit} disabled={submitting || templates.length === 0}
              style={btnStylePrimary()}>
              {submitting ? 'Creating…' : 'Create + open composer →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── drawer ──────────────────────────────────────────────────────────────
interface DrawerProps {
  lead: LeadRow | null;
  stages: StageRow[];
  propertyId: number;
  templates: ProposalTemplateRow[];        // PBS 2026-07-15
  onClose: () => void;
  onSaved: (id: number) => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
  onStageChanged: () => void | Promise<void>;
  onCreateProposal: (leadId: number) => void;  // PBS 2026-07-15
}

function LeadProfileDrawer({
  lead, stages, propertyId, templates,
  onClose, onSaved, onDeleted, onStageChanged, onCreateProposal,
}: DrawerProps) {
  const [tab, setTab] = useState<'overview' | 'timeline' | 'emails' | 'notes'>('overview');
  const [form, setForm] = useState<Record<string, string>>(() => ({
    company_name: lead?.company_name ?? '',
    decision_maker_name: lead?.decision_maker_name ?? '',
    decision_maker_role: lead?.decision_maker_role ?? '',
    email: lead?.email ?? '',
    phone_whatsapp: lead?.phone_whatsapp ?? '',
    website: lead?.website ?? '',
    country: lead?.country ?? '',
    city: lead?.city ?? '',
    language: lead?.language ?? '',
    category: lead?.category ?? '',
    subcategory: lead?.subcategory ?? '',
    final_priority: lead?.final_priority ?? '',
    icp_score: lead?.icp_score != null ? String(lead.icp_score) : '',
    intent_score: lead?.intent_score != null ? String(lead.intent_score) : '',
    deal_type: lead?.deal_type ?? '',
    notes: lead?.notes ?? '',
    converted_value_eur: lead?.converted_value_eur != null ? String(lead.converted_value_eur) : '',
    next_touch_at: lead?.next_touch_at ? String(lead.next_touch_at).slice(0, 10) : '',
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [tlLoading, setTlLoading] = useState(false);

  const isCreate = lead == null;

  useEffect(() => {
    if (isCreate || tab === 'overview' || tab === 'notes') return;
    if (!lead) return;
    setTlLoading(true);
    fetch('/api/sales/leads/' + lead.id).then((r) => r.json()).then((j) => {
      setTimeline(((j.timeline ?? []) as TimelineEntry[]));
    }).catch(() => {}).finally(() => setTlLoading(false));
  }, [lead, tab, isCreate]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const body: Record<string, unknown> = { property_id: propertyId };
      for (const [k, v] of Object.entries(form)) {
        if (v === '' && !['notes','converted_value_eur','next_touch_at','icp_score','intent_score'].includes(k)) continue;
        body[k] = v;
      }
      const url = isCreate ? '/api/sales/leads' : '/api/sales/leads/' + lead!.id;
      const method = isCreate ? 'POST' : 'PATCH';
      const r = await fetch(url, {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'save failed');
      await onSaved(Number(j.lead_id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function advance() {
    if (isCreate || !lead) return;
    await fetch('/api/sales/leads/' + lead.id + '/advance', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    await onStageChanged();
  }
  async function setStage(stage_key: string) {
    if (isCreate || !lead) return;
    await fetch('/api/sales/leads/' + lead.id + '/stage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage_key, reason: 'manual_drawer' }),
    });
    await onStageChanged();
  }
  async function del() {
    if (isCreate || !lead) return;
    if (!confirm('Soft-delete this lead? It can be restored via SQL.')) return;
    await fetch('/api/sales/leads/' + lead.id, { method: 'DELETE' });
    await onDeleted();
  }

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 49, cursor: 'pointer',
      }} />
      {/* drawer */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, width: 600, maxWidth: '96vw', height: '100vh',
        background: T.WHITE, boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
        borderLeft: '1px solid ' + T.HAIR, zIndex: 50,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* sticky header */}
        <div style={{
          borderBottom: '1px solid ' + T.HAIR, padding: '12px 16px', display: 'flex',
          flexDirection: 'column', gap: 8, background: T.WHITE, flex: '0 0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isCreate ? 'New lead' : (lead?.company_name ?? '(untitled lead)')}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!isCreate && (
                <>
                  <span style={pillStyle(stageColor(lead?.stage ?? null))}>{lead?.stage_display_name ?? lead?.stage ?? '—'}</span>
                  {/* PBS 2026-07-15 — jump to the template-picker modal from within the drawer. */}
                  <button type="button"
                    onClick={() => lead && onCreateProposal(lead.id)}
                    disabled={templates.length === 0}
                    title={templates.length === 0 ? 'No active proposal templates for this property.' : 'Create a proposal pre-filled from this lead'}
                    style={{ ...btnStyleGhost(), borderColor: T.FOREST, color: T.FOREST, fontWeight: 600 }}>
                    + Proposal
                  </button>
                  <button type="button" onClick={advance} style={btnStyleGhost()}>Advance →</button>
                  <button type="button" onClick={del} style={{ ...btnStyleGhost(), color: T.RED, borderColor: T.RED }}>Delete</button>
                </>
              )}
              <button type="button" onClick={onClose} style={btnStyleGhost()}>✕</button>
            </div>
          </div>
          {!isCreate && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {stages.map((s) => (
                <button key={s.stage_key} type="button" onClick={() => setStage(s.stage_key)}
                  style={{
                    ...chipStyle(lead?.stage === s.stage_key),
                    fontSize: 10, padding: '3px 8px',
                  }}>
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, borderTop: '1px solid ' + T.HAIR, paddingTop: 8, marginTop: 4 }}>
            {(['overview', 'timeline', 'emails', 'notes'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} style={tabBtnStyle(tab === t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* body */}
        <div style={{ padding: 16, overflowY: 'auto', flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Company" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} full />
              <Field label="Contact name" value={form.decision_maker_name} onChange={(v) => setForm({ ...form, decision_maker_name: v })} />
              <Field label="Contact role" value={form.decision_maker_role} onChange={(v) => setForm({ ...form, decision_maker_role: v })} />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Phone / WhatsApp" value={form.phone_whatsapp} onChange={(v) => setForm({ ...form, phone_whatsapp: v })} />
              <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
              <Field label="Language" value={form.language} onChange={(v) => setForm({ ...form, language: v })} />
              <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
              <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
              <Field label="Subcategory" value={form.subcategory} onChange={(v) => setForm({ ...form, subcategory: v })} />
              <Field label="Priority (high/medium/low)" value={form.final_priority} onChange={(v) => setForm({ ...form, final_priority: v })} />
              <Field label="ICP score (0-100)" value={form.icp_score} onChange={(v) => setForm({ ...form, icp_score: v })} />
              <Field label="Intent score (0-100)" value={form.intent_score} onChange={(v) => setForm({ ...form, intent_score: v })} />
              <SelectField
                label="Deal type"
                value={form.deal_type}
                onChange={(v) => setForm({ ...form, deal_type: v })}
                options={[
                  { value: '', label: '(none)' },
                  { value: 'fit', label: 'FIT' },
                  { value: 'group', label: 'Group' },
                  { value: 'btb_dmc', label: 'B2B · DMC' },
                  { value: 'btb_corporate', label: 'B2B · Corporate' },
                  { value: 'retreat_lead', label: 'Retreat lead' },
                  { value: 'wholesale', label: 'Wholesale' },
                  { value: 'influencer', label: 'Influencer' },
                ]}
              />
              <Field label="Next touch (YYYY-MM-DD)" value={form.next_touch_at} onChange={(v) => setForm({ ...form, next_touch_at: v })} />
              <Field label="Converted value (EUR)" value={form.converted_value_eur} onChange={(v) => setForm({ ...form, converted_value_eur: v })} />
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} multiline />
              </div>
              {err && (
                <div style={{
                  gridColumn: '1 / -1',
                  color: T.RED,
                  fontSize: 12,
                  padding: '8px 10px',
                  background: '#FBEEE8',
                  border: '1px solid ' + T.RED,
                  borderRadius: 3,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  <strong>Save failed:</strong> {err}
                </div>}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={btnStyleGhost()}>Cancel</button>
                <button type="button" onClick={save} disabled={saving} style={btnStylePrimary()}>{saving ? 'Saving…' : (isCreate ? 'Create lead' : 'Save changes')}</button>
              </div>
            </div>
          )}

          {tab === 'timeline' && (
            <TimelineList entries={timeline} loading={tlLoading} />
          )}

          {tab === 'emails' && (
            <EmailsList entries={timeline.filter((t) => t.kind === 'email')} loading={tlLoading} />
          )}

          {tab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={12} style={{
                  width: '100%', padding: 10, fontSize: 13, background: T.WHITE,
                  border: '1px solid ' + T.HAIR, borderRadius: 4, color: T.INK, resize: 'vertical',
                }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={save} disabled={saving} style={btnStylePrimary()}>{saving ? 'Saving…' : 'Save notes'}</button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function TimelineList({ entries, loading }: { entries: TimelineEntry[]; loading: boolean }) {
  if (loading) return <div style={{ color: T.INK_M, fontSize: 12 }}>Loading timeline…</div>;
  if (entries.length === 0) return <div style={{ color: T.INK_M, fontSize: 12 }}>No activity yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map((e, i) => (
        <div key={i} style={{ padding: '10px 12px', background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: T.INK, fontWeight: 600 }}>
              {e.kind === 'email' ? (e.direction === 'in' ? '↓ ' : '↑ ') : ''}{e.summary}
            </div>
            <div style={{ fontSize: 10, color: T.INK_M, whiteSpace: 'nowrap' }}>{new Date(e.at).toLocaleString()}</div>
          </div>
          {e.metadata && (e.metadata.snippet as string | undefined) && (
            <div style={{ fontSize: 11, color: T.INK_M, marginTop: 4, whiteSpace: 'pre-wrap' }}>
              {String(e.metadata.snippet).slice(0, 400)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function EmailsList({ entries, loading }: { entries: TimelineEntry[]; loading: boolean }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (loading) return <div style={{ color: T.INK_M, fontSize: 12 }}>Loading emails…</div>;
  if (entries.length === 0) return <div style={{ color: T.INK_M, fontSize: 12 }}>No linked email messages yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map((e, i) => {
        const meta = e.metadata ?? {};
        const from = String(meta.from_email ?? meta.from_name ?? '');
        const mailbox = String(meta.mailbox ?? '');
        const snippet = String(meta.snippet ?? '');
        return (
          <div key={i} style={{ border: '1px solid ' + T.HAIR, borderRadius: 4, background: T.WHITE }}>
            <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{
              width: '100%', textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer', padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <div style={{ fontSize: 12, color: T.INK, fontWeight: 600 }}>
                  {e.direction === 'in' ? '↓ ' : '↑ '}{e.summary}
                </div>
                <div style={{ fontSize: 10, color: T.INK_M }}>{new Date(e.at).toLocaleString()}</div>
              </div>
              <div style={{ fontSize: 11, color: T.INK_M, marginTop: 2 }}>
                {from}{mailbox ? ' · ' + mailbox : ''}
              </div>
            </button>
            {openIdx === i && (
              <div style={{ padding: '0 12px 12px 12px', fontSize: 12, color: T.INK_S, whiteSpace: 'pre-wrap' }}>
                {snippet || '(no body preview)'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── field primitives ────────────────────────────────────────────────────
function Field({ label, value, onChange, full, multiline }: {
  label: string; value: string; onChange: (v: string) => void; full?: boolean; multiline?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 10, color: T.INK_M, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      {multiline
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4}
            style={{ padding: '6px 8px', fontSize: 12, background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 3, color: T.INK, resize: 'vertical' }} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
            style={{ padding: '6px 8px', fontSize: 12, background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 3, color: T.INK }} />}
    </label>
  );
}

// PBS 2026-07-16 — SelectField for enum-constrained columns (deal_type, etc.)
// so users can't send garbage that trips a CHECK constraint.
function SelectField({ label, value, onChange, options, full }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; full?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 10, color: T.INK_M, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ padding: '6px 8px', fontSize: 12, background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 3, color: T.INK }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// ─── style helpers ───────────────────────────────────────────────────────
function thStyle(): React.CSSProperties {
  return { padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase',
    letterSpacing: 0.5, color: T.INK_M, fontWeight: 600, borderBottom: '1px solid ' + T.HAIR };
}
function tdStyle(): React.CSSProperties {
  return { padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR };
}
function pillStyle(bg: string): React.CSSProperties {
  return { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10,
    background: bg, color: T.WHITE, fontWeight: 600, textTransform: 'capitalize' };
}
function chipStyle(on: boolean): React.CSSProperties {
  return { padding: '4px 10px', fontSize: 11, borderRadius: 999,
    border: '1px solid ' + (on ? T.FOREST : T.HAIR),
    background: on ? T.FOREST : T.WHITE,
    color: on ? T.WHITE : T.INK, cursor: 'pointer', fontWeight: on ? 600 : 400 };
}
function btnStylePrimary(): React.CSSProperties {
  return { padding: '6px 14px', fontSize: 12, borderRadius: 4, border: '1px solid ' + T.FOREST,
    background: T.FOREST, color: T.WHITE, cursor: 'pointer', fontWeight: 600 };
}
function btnStyleGhost(): React.CSSProperties {
  return { padding: '6px 12px', fontSize: 12, borderRadius: 4, border: '1px solid ' + T.HAIR,
    background: T.WHITE, color: T.INK, cursor: 'pointer' };
}
// PBS 2026-07-15 — compact row-action button (Create Proposal in the leads table).
function rowActionBtn(): React.CSSProperties {
  return { padding: '3px 8px', fontSize: 10, borderRadius: 3, border: '1px solid ' + T.FOREST,
    background: T.WHITE, color: T.FOREST, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };
}
// PBS 2026-07-16 — square icon-only row action (email · archive · delete).
function iconBtnStyle(): React.CSSProperties {
  return { padding: '3px 6px', fontSize: 13, lineHeight: 1, borderRadius: 3, border: '1px solid ' + T.HAIR,
    background: T.WHITE, color: T.INK, cursor: 'pointer', fontWeight: 500, textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
}
function tabBtnStyle(on: boolean): React.CSSProperties {
  return { padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid ' + (on ? T.FOREST : 'transparent'),
    background: on ? T.CREAM : 'transparent', color: T.INK, cursor: 'pointer', textTransform: 'uppercase',
    letterSpacing: 0.5, fontWeight: on ? 600 : 400 };
}
