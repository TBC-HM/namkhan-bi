'use client';

// app/operations/qa/generate/_components/GenerateSopForm.tsx
// PBS 2026-07-07 · 2026-07-08: Client-only form. No function props from server.
// Paper-white + hairlines per feedback_paper_white_default_for_tables +
// feedback_namkhan_token_ladder_paper_warm_dark (hardcoded #FFF / #E6DFCC).
// 2026-07-08: Accepts optional prefill from /operations/qa/proposals — via
// props (deptPrefill / purposePrefill / proposalId) to avoid RSC function-prop
// leaks. On save, if proposalId is present the server-side save call flips the
// proposal to 'accepted' via /api/sop/proposals/mark.
// 2026-07-08 (bug-2): accepts propertyContextText (pre-rendered ground-truth
// facts) as a plain-string prop and embeds it into the POST body sent to
// /api/sop/generate. Also shows a small collapsible "Context the AI sees"
// panel so PBS can confirm what facts drive the draft.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// ── design tokens (hardcoded, do NOT use var(--paper-warm)) ────────────
const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const CREAM = '#F5F0E1';
const INK   = '#1B1B1B';
const INK_S = '#3A3A3A';
const INK_M = '#5A5A5A';
const INK_L = '#8A8A8A';
const ACCENT = '#0F5B4A';   // sober forest — matches Namkhan brand

const PROPERTIES: { id: number; label: string }[] = [
  { id: 260955,  label: 'Namkhan' },
  { id: 1000001, label: 'Donna Portals' },
];

// Dept codes match knowledge.sop_meta.dept_code convention (lowercase snake).
// Labels use the PBS-friendly display strings from the SOP catalog task.
const DEPARTMENTS: { code: string; label: string }[] = [
  { code: 'housekeeping',  label: 'Housekeeping' },
  { code: 'kitchen',       label: 'F&B' },
  { code: 'front_office',  label: 'Front Office' },
  { code: 'maintenance',   label: 'Engineering' },
  { code: 'governance',    label: 'Governance' },
  { code: 'procurement',   label: 'Procurement' },
  { code: 'hr',            label: 'HR' },
  { code: 'spa',           label: 'Spa' },
  { code: 'marketing',     label: 'Marketing' },
  { code: 'revenue',       label: 'Revenue' },
  { code: 'sales',         label: 'Sales' },
  { code: 'finance',       label: 'Finance' },
  { code: 'it',            label: 'IT' },
  { code: 'activities',    label: 'Activities' },
  { code: 'retail',        label: 'Retail' },
  { code: 'transport',     label: 'Transport' },
  { code: 'reception',     label: 'Reception' },
  { code: 'security',      label: 'Security' },
  { code: 'wellness',      label: 'Wellness' },
  { code: 'sustainability',label: 'Sustainability' },
  { code: 'safety',        label: 'Safety' },
  { code: 'laundry',       label: 'Laundry' },
  { code: 'purchasing',    label: 'Purchasing' },
  { code: 'guest_relations', label: 'Guest Relations' },
];

interface Draft {
  title: string;
  short_summary: string;
  author: string;
  sop_date: string;      // YYYY-MM-DD
  bullets: string[];
  primary_audience: string;
}

interface GenerateResp {
  ok?: boolean;
  draft?: Draft;
  ai_stub?: boolean;
  error?: string;
}

interface SaveResp {
  ok?: boolean;
  row?: { id: number; sop_code: string; property_id: number };
  error?: string;
}

const control: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid ' + HAIR, borderRadius: 4,
  fontSize: 13, fontFamily: 'inherit', color: INK, background: WHITE,
};

const label: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: INK_S, marginBottom: 6,
};

const btn = (primary: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  border: '1px solid ' + (primary ? ACCENT : HAIR),
  background: primary ? ACCENT : WHITE,
  color: primary ? WHITE : INK,
  borderRadius: 4, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
});

const card: React.CSSProperties = {
  background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6,
  padding: 20, marginBottom: 12,
};

interface Props {
  defaultPropertyId: number;
  deptPrefill?: string;
  purposePrefill?: string;
  proposalId?: number | null;
  // Pre-rendered property context block (from server component via
  // lib/propertyContext.renderPropertyContextForLLM). Plain string only.
  propertyContextText?: string;
  propertyName?: string;
  propertyRoomCount?: number;
  propertyKeyCount?: number;
  propertyFacilityCount?: number;
}

export default function GenerateSopForm({
  defaultPropertyId,
  deptPrefill,
  purposePrefill,
  proposalId,
  propertyContextText = '',
  propertyName = '',
  propertyRoomCount = 0,
  propertyKeyCount = 0,
  propertyFacilityCount = 0,
}: Props) {
  const router = useRouter();

  // Ensure the default is in the list; else fall back to Namkhan.
  const initialPid = useMemo(() => {
    return PROPERTIES.find((p) => p.id === defaultPropertyId)?.id ?? 260955;
  }, [defaultPropertyId]);

  const initialDept = useMemo(() => {
    if (deptPrefill && DEPARTMENTS.some((d) => d.code === deptPrefill)) return deptPrefill;
    return 'housekeeping';
  }, [deptPrefill]);

  const [propertyId, setPropertyId] = useState<number>(initialPid);
  const [deptCode,   setDeptCode]   = useState<string>(initialDept);
  const [purpose,    setPurpose]    = useState<string>(purposePrefill ?? '');

  const [busy, setBusy]       = useState(false);
  const [status, setStatus]   = useState<string | null>(null);
  const [stubMode, setStubMode] = useState<boolean>(false);
  const [draft, setDraft]     = useState<Draft | null>(null);
  const [autoGenAttempted, setAutoGenAttempted] = useState(false);
  const [ctxOpen, setCtxOpen] = useState(false);

  // Auto-generate when arriving with a purpose prefill (from a Proposal row).
  useEffect(() => {
    if (!autoGenAttempted && purposePrefill && purposePrefill.trim() && !draft && !busy) {
      setAutoGenAttempted(true);
      onGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposePrefill, autoGenAttempted]);

  async function onGenerate() {
    if (!purpose.trim()) { setStatus('Enter a purpose first.'); return; }
    setBusy(true); setStatus(null);
    try {
      const res = await fetch('/api/sop/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          dept_code: deptCode,
          purpose: purpose.trim(),
          propertyContext: propertyContextText,
        }),
      });
      const j: GenerateResp = await res.json();
      if (!res.ok || !j.draft) throw new Error(j.error ?? `HTTP ${res.status}`);
      setDraft(j.draft);
      setStubMode(!!j.ai_stub);
      setStatus(j.ai_stub
        ? 'Draft generated (deterministic stub — Anthropic key not yet in vault).'
        : 'Draft generated by Claude with property-specific context.');
      // If we came from a proposal, mark it 'generated' (best-effort, non-blocking).
      if (proposalId) {
        fetch('/api/sop/proposals/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: proposalId, status: 'generated' }),
        }).catch(() => {});
      }
    } catch (err) {
      setStatus(`Generate failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!draft) return;
    if (!draft.title.trim()) { setStatus('Title is required.'); return; }
    setBusy(true); setStatus(null);
    try {
      const res = await fetch('/api/sop/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          dept_code: deptCode,
          title: draft.title.trim(),
          short_summary: draft.short_summary.trim(),
          bullets: draft.bullets.map((b) => b.trim()).filter(Boolean),
          author: draft.author.trim(),
          sop_date: draft.sop_date,
          primary_audience: draft.primary_audience.trim() || 'staff',
          source: stubMode ? 'ai_stub' : 'ai_generated',
        }),
      });
      const j: SaveResp = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error ?? `HTTP ${res.status}`);

      // If we came from a proposal, flip it to 'accepted' with the new sop_code.
      if (proposalId && j.row?.sop_code) {
        fetch('/api/sop/proposals/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: proposalId, status: 'accepted', linked_sop_code: j.row.sop_code }),
        }).catch(() => {});
      }

      setStatus(`Saved as ${j.row?.sop_code}. Redirecting…`);
      // If proposal-driven, go back to proposals list; else to the register.
      const to = proposalId
        ? (propertyId === 260955 ? '/operations/qa/proposals' : `/h/${propertyId}/operations/qa/proposals`)
        : (propertyId === 260955 ? '/operations/sops'        : `/h/${propertyId}/operations/sops`);
      setTimeout(() => { router.push(to); }, 700);
    } catch (err) {
      setStatus(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Prefill breadcrumb */}
      {proposalId && (
        <div style={{
          background: '#FFF7E5', border: '1px solid #E5D4A0', borderRadius: 6,
          padding: '8px 14px', marginBottom: 12, fontSize: 11, color: '#5C4A15',
        }}>
          Drafting from proposal #{proposalId}. Editing the fields will not change the proposal — only the saved SOP.
        </div>
      )}

      {/* Property context awareness strip */}
      {propertyContextText && (
        <div style={{
          background: '#F0F5F2', border: '1px solid ' + HAIR, borderRadius: 6,
          padding: '10px 14px', marginBottom: 12, fontSize: 11, color: INK_S,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: ACCENT, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10 }}>
              Grounded on {propertyName || 'property'} facts
            </span>
            <span>{propertyRoomCount} rooms · {propertyKeyCount} keys · {propertyFacilityCount} on-site facilities</span>
            <button
              type="button"
              onClick={() => setCtxOpen((v) => !v)}
              style={{
                marginLeft: 'auto',
                padding: '2px 10px',
                border: '1px solid ' + HAIR,
                background: WHITE,
                color: INK_S,
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {ctxOpen ? 'Hide context' : 'Show context'}
            </button>
          </div>
          {ctxOpen && (
            <pre style={{
              marginTop: 10,
              padding: 12,
              background: WHITE,
              border: '1px solid ' + HAIR,
              borderRadius: 4,
              fontSize: 11,
              lineHeight: 1.5,
              color: INK,
              maxHeight: 320,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}>
              {propertyContextText}
            </pre>
          )}
        </div>
      )}

      {/* ─── Input form ────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 12 }}>
          1. Inputs
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>Property</label>
            <select style={control} value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))}>
              {PROPERTIES.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.id}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Department</label>
            <select style={control} value={deptCode} onChange={(e) => setDeptCode(e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Purpose</label>
          <textarea
            style={{ ...control, minHeight: 60, resize: 'vertical' }}
            placeholder="e.g. Turn-down service for double-occupancy guest rooms, including chocolate placement and music selection."
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={btn(true)} disabled={busy} onClick={onGenerate}>
            {busy && !draft ? 'Generating…' : 'Generate'}
          </button>
          {status && <span style={{ fontSize: 11, color: INK_M }}>{status}</span>}
        </div>
      </div>

      {/* ─── Editable preview ─────────────────────────────────── */}
      {draft && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M }}>
              2. Preview &amp; edit
            </div>
            {stubMode && (
              <span style={{ fontSize: 10, color: INK_M, padding: '2px 8px', background: CREAM, border: '1px solid ' + HAIR, borderRadius: 99 }}>
                stub AI · deterministic
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label}>Title</label>
              <input style={control} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div>
              <label style={label}>Author</label>
              <input style={control} value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
            </div>
            <div>
              <label style={label}>Date</label>
              <input type="date" style={control} value={draft.sop_date} onChange={(e) => setDraft({ ...draft, sop_date: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={label}>Subject (1-line synopsis)</label>
            <input style={control} value={draft.short_summary} onChange={(e) => setDraft({ ...draft, short_summary: e.target.value })} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={label}>Primary audience</label>
            <input style={control} value={draft.primary_audience} onChange={(e) => setDraft({ ...draft, primary_audience: e.target.value })} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={label}>Bullet points (one per line)</label>
            <textarea
              style={{ ...control, minHeight: 200, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, lineHeight: 1.5 }}
              value={draft.bullets.join('\n')}
              onChange={(e) => setDraft({ ...draft, bullets: e.target.value.split('\n') })}
            />
            <div style={{ fontSize: 10, color: INK_L, marginTop: 4 }}>
              {draft.bullets.filter((b) => b.trim()).length} action step(s)
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid ' + CREAM }}>
            <button style={btn(true)} disabled={busy} onClick={onSave}>
              {busy ? 'Saving…' : (proposalId ? 'Accept & Save SOP' : 'Save SOP')}
            </button>
            <button style={btn(false)} disabled={busy} onClick={onGenerate}>
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
