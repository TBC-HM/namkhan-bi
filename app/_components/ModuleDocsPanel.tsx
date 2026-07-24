'use client';

// app/_components/ModuleDocsPanel.tsx
// PBS 2026-07-24 v3: 3-col cards + traffic lights (Live · Goal · Signed off)
// + % completion bar + Claude chip + inline goal editor.

import { useMemo, useState, useTransition } from 'react';
import TenantLink from '@/components/nav/TenantLink';

export interface ModuleDocRow {
  doc_type: string;
  title: string;
  version: number;
  status: string;
  last_updated_at: string;
  md_length: number;
}

export interface ModuleStatusRow {
  doc_type: string;
  goal_precise: string | null;
  completion_pct: number;
  is_live: boolean;
  claude_integrated: boolean;
  signed_off_at: string | null;
  signed_off_by: string | null;
}

interface Props {
  docs: ModuleDocRow[];
  statuses?: ModuleStatusRow[];
}

const TYPE_LABEL: Record<string, string> = {
  bug_agent_module:    'Bug Agent',
  compiler_module:     'Compiler',
  gbp_module:          'Google Business Profile',
  inventory_module:    'Inventory',
  media_module:        'Media',
  newsletter_module:   'Newsletter',
  proposals_module:    'Proposals & Composer',
  sales_module:        'Sales & CRM',
  socials_module:      'Socials',
  spec_builder_module: 'Spec Builder',
  university_module:   'University',
  youtube_module:      'YouTube',
};

const DEFAULT_GOAL: Record<string, string> = {
  bug_agent_module:    'Every filed bug attempted automatically; ~20% resolved & merged within 1h of filing — no PBS touch required.',
  compiler_module:     'PBS selects date range + content type; system pulls from PMS/KPIs/media; ready-to-use copy blocks in one click.',
  gbp_module:          'PBS reviews, responds to Q&A, publishes posts, and reads impressions — all without logging into Google.',
  inventory_module:    'Kitchen manager enters daily counts; system shows what is running low and auto-generates a purchase order.',
  media_module:        'PBS approves a photo, clicks Use for Booking.com, and the correct spec uploads to the OTA without leaving the app.',
  newsletter_module:   'AI proposes the weekly email; PBS approves in 5 min; it sends to the right audience group automatically.',
  proposals_module:    'Staff generates a branded PDF proposal + email pitch for any DMC or retreat client in under 5 minutes.',
  sales_module:        'Every lead tracked from enquiry to won deal; proposals linked to pipeline; revenue attributed when booking lands.',
  socials_module:      'Staff schedules one post for Instagram and Facebook from one form; it publishes at the set time without logging into Meta.',
  spec_builder_module: 'PBS describes any module goal in 15 min; fires an agent; receives a shipped build without further back-and-forth.',
  university_module:   'Every staff question answered in under 30 seconds from the help widget — no need to call a manager.',
  youtube_module:      'Channel performance visible in app; content planned from trends; weekly analytics summary lands in inbox automatically.',
};

const PILL_COLOR: Record<string, { bg: string; text: string }> = {
  bug_agent_module:    { bg: '#EDE7F6', text: '#4527A0' },
  compiler_module:     { bg: '#E8EAF6', text: '#283593' },
  gbp_module:          { bg: '#FCE4EC', text: '#880E4F' },
  inventory_module:    { bg: '#E8F5E9', text: '#1B5E20' },
  media_module:        { bg: '#E3F2FD', text: '#0D47A1' },
  newsletter_module:   { bg: '#FFF3E0', text: '#E65100' },
  proposals_module:    { bg: '#F3E5F5', text: '#6A1B9A' },
  sales_module:        { bg: '#E0F7FA', text: '#006064' },
  socials_module:      { bg: '#FFEBEE', text: '#B71C1C' },
  spec_builder_module: { bg: '#E0F2F1', text: '#004D40' },
  university_module:   { bg: '#F1F8E9', text: '#33691E' },
  youtube_module:      { bg: '#FFEBEE', text: '#C62828' },
};

function Light({ on, label }: { on: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#5A5A5A' }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: on ? '#2E7D32' : '#D32F2F',
        boxShadow: on ? '0 0 4px #81C78466' : '0 0 4px #EF9A9A66',
      }} />
      {label}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: '#F0EBE0', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99,
          background: pct >= 80 ? '#2E7D32' : pct >= 50 ? '#F57F17' : '#D32F2F',
          transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#5A5A5A', flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

function GoalEditor({ docType, initial, onSaved }: { docType: string; initial: string; onSaved: (g: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(initial);
  const [pct, setPct] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      const body: Record<string, unknown> = { doc_type: docType, goal_precise: val };
      if (pct !== '') body.completion_pct = parseInt(pct, 10);
      const res = await fetch('/api/modules/goal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { onSaved(val); setSaved(true); setTimeout(() => { setSaved(false); setOpen(false); }, 1200); }
    });
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
        background: 'transparent', color: '#1F3A2E', border: '1px solid #1F3A2E',
      }}>
        {open ? 'Cancel' : '✏ Refine goal'}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            value={val}
            onChange={e => setVal(e.target.value)}
            rows={4}
            style={{ fontSize: 12, padding: '7px 9px', border: '1px solid #E6DFCC', borderRadius: 4,
              background: '#FAFAF7', color: '#1B1B1B', resize: 'vertical', lineHeight: 1.5, width: '100%',
              boxSizing: 'border-box' }}
            placeholder="Write a precise, testable goal. Start with 'When I…' or 'The system…'. Include the acceptance test."
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="number" min={0} max={100} value={pct} onChange={e => setPct(e.target.value)}
              placeholder="% done"
              style={{ width: 72, fontSize: 11, padding: '4px 6px', border: '1px solid #E6DFCC',
                borderRadius: 3, background: '#FFFFFF', color: '#1B1B1B' }} />
            <button type="button" onClick={save} disabled={isPending}
              style={{ fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 3,
                background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer',
                opacity: isPending ? 0.6 : 1 }}>
              {saved ? 'Saved ✓' : isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function ModuleDocsPanel({ docs, statuses = [] }: Props) {
  const [q, setQ] = useState('');
  const [goalOverrides, setGoalOverrides] = useState<Record<string, string>>({});

  const statusMap = useMemo(() => {
    const m: Record<string, ModuleStatusRow> = {};
    for (const s of statuses) m[s.doc_type] = s;
    return m;
  }, [statuses]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter(d =>
      d.doc_type.toLowerCase().includes(needle) ||
      (TYPE_LABEL[d.doc_type] ?? '').toLowerCase().includes(needle)
    );
  }, [docs, q]);

  return (
    <div>
      <input type="text" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Filter modules…"
        style={{ fontSize: 12, padding: '7px 10px', border: '1px solid #E6DFCC', borderRadius: 4,
          background: '#FFFFFF', color: '#1B1B1B', outline: 'none', width: 260, marginBottom: 14 }} />

      {filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No modules match &quot;{q}&quot;.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {filtered.map(d => {
            const st = statusMap[d.doc_type];
            const pill = PILL_COLOR[d.doc_type] ?? { bg: '#F4EFE2', text: '#5A5A5A' };
            const currentGoal = goalOverrides[d.doc_type] ?? st?.goal_precise ?? DEFAULT_GOAL[d.doc_type] ?? '';
            const goalSet = currentGoal.trim().length > 40;
            const pct = st?.completion_pct ?? 0;

            return (
              <div key={d.doc_type} style={{
                background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
                padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', padding: '2px 9px', borderRadius: 99,
                    background: pill.bg, color: pill.text, whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis', maxWidth: 160 }}>
                    {TYPE_LABEL[d.doc_type] ?? d.doc_type}
                  </span>
                  {st?.claude_integrated && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                      background: '#E8F4FD', color: '#1565C0', letterSpacing: '0.06em',
                      textTransform: 'uppercase', flexShrink: 0 }}>
                      Claude
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <ProgressBar pct={pct} />

                {/* Traffic lights */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <Light on={st?.is_live ?? false} label="Live" />
                  <Light on={goalSet} label="Goal set" />
                  <Light on={!!st?.signed_off_at} label="Signed off" />
                </div>

                {/* Goal */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: '#1F3A2E', marginBottom: 4 }}>GOAL</div>
                  <div style={{ fontSize: 12, color: '#1B1B1B', lineHeight: 1.45, marginBottom: 6 }}>
                    {currentGoal || <span style={{ color: '#B8A878', fontStyle: 'italic' }}>Not defined — click Refine goal</span>}
                  </div>
                  <GoalEditor
                    docType={d.doc_type}
                    initial={currentGoal}
                    onSaved={g => setGoalOverrides(prev => ({ ...prev, [d.doc_type]: g }))}
                  />
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #F0EBE0' }}>
                  <span style={{ fontSize: 10, color: '#8A8A8A' }}>
                    v{d.version} · {shortDate(d.last_updated_at)}
                    {st?.signed_off_at && (
                      <span style={{ color: '#2E7D32', marginLeft: 6 }}>
                        · signed {shortDate(st.signed_off_at)}
                      </span>
                    )}
                  </span>
                  <TenantLink
                    href={`/holding/it/module/${encodeURIComponent(d.doc_type)}`}
                    style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', padding: '4px 10px', borderRadius: 3,
                      background: '#1F3A2E', color: '#FFFFFF', textDecoration: 'none' }}>
                    Spec →
                  </TenantLink>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
