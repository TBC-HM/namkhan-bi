'use client';

// app/_components/ModuleDocsPanel.tsx
// PBS 2026-07-24: rebuilt as full-width 3-column card grid.
// Each card: type pill · status · goal (done-state) · key gap · Preview link.

import { useMemo, useState } from 'react';
import TenantLink from '@/components/nav/TenantLink';

export interface ModuleDocRow {
  doc_type: string;
  title: string;
  version: number;
  status: string;
  last_updated_at: string;
  md_length: number;
}

interface Props { docs: ModuleDocRow[] }

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

const GOAL: Record<string, string> = {
  bug_agent_module:    'Every filed bug attempted automatically; ~20% resolved & merged within 1h of filing — no PBS touch required.',
  compiler_module:     'PBS selects date range + content type; system pulls from PMS/KPIs/media; ready-to-use copy blocks in one click.',
  gbp_module:          'PBS reviews, responds to Q&A, publishes posts, and reads impressions — all without logging into Google.',
  inventory_module:    'Kitchen manager enters daily counts; system shows what is running low and auto-generates a purchase order.',
  media_module:        'PBS approves a photo, clicks "Use for Booking.com", and the correct spec uploads to the OTA without leaving the app.',
  newsletter_module:   'AI proposes the weekly email; PBS approves in 5 min; it sends to the right audience group automatically.',
  proposals_module:    'Staff generates a branded PDF proposal + email pitch for any DMC or retreat client in under 5 minutes.',
  sales_module:        'Every lead tracked from enquiry to won deal; proposals linked to pipeline; revenue attributed when booking lands.',
  socials_module:      'Staff schedules one post for Instagram and Facebook from one form; it publishes at the set time without logging into Meta.',
  spec_builder_module: 'PBS describes any module goal in 15 min; fires an agent; receives a shipped build without further back-and-forth.',
  university_module:   'Every staff question answered in under 30 seconds from the help widget — no need to call a manager.',
  youtube_module:      'Channel performance visible in app; content planned from trends; weekly analytics summary lands in inbox automatically.',
};

const GAP: Record<string, string> = {
  bug_agent_module:    'GitHub token lacks PR scope; no code index; cron deactivated.',
  compiler_module:     'Still on legacy design; no spec for what it reads or outputs — needs PBS input.',
  gbp_module:          'Google API allowlist pending (case 7-4375000040952) — blocked on Google approval.',
  inventory_module:    'Count entry screen not built; low-stock alerts missing; procurement flow at 0 POs.',
  media_module:        'End-to-end OTA auto-upload not wired; Analytics 403 on brand channel.',
  newsletter_module:   'Open/click rate analytics not fed back into app; Director cadence field not auto-filling.',
  proposals_module:    'No PDF export; proposals not saved to pipeline; no open/response tracking.',
  sales_module:        'No deal stages / Kanban; no follow-up reminders; no booking attribution.',
  socials_module:      'Not built — authoring + scheduling UI is entire scope; Meta publish API access pending.',
  spec_builder_module: 'Fire-agent button (to cockpit_ticket, email when done) not built.',
  university_module:   'Article coverage thin; ask-window unanswered-log not reviewed regularly.',
  youtube_module:      'Analytics OAuth 403 (brand channel); Lens audit returns no result; Spy Agent not built.',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  published: { bg: '#E8F5E9', text: '#2E7D32' },
  draft:     { bg: '#FFF8E1', text: '#F57F17' },
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

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function ModuleDocsPanel({ docs }: Props) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter((d) =>
      d.doc_type.toLowerCase().includes(needle) ||
      (TYPE_LABEL[d.doc_type] ?? '').toLowerCase().includes(needle) ||
      (GOAL[d.doc_type] ?? '').toLowerCase().includes(needle)
    );
  }, [docs, q]);

  return (
    <div>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter modules…"
        style={{ fontSize: 12, padding: '7px 10px', border: '1px solid #E6DFCC', borderRadius: 4,
          background: '#FFFFFF', color: '#1B1B1B', outline: 'none', width: 260, marginBottom: 14 }}
      />

      {filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No modules match &quot;{q}&quot;.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {filtered.map((d) => {
            const pill = PILL_COLOR[d.doc_type] ?? { bg: '#F4EFE2', text: '#5A5A5A' };
            const sc = STATUS_COLOR[d.status] ?? { bg: '#F4EFE2', text: '#5A5A5A' };
            return (
              <div key={d.doc_type} style={{
                background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
                padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', padding: '2px 9px', borderRadius: 99,
                    background: pill.bg, color: pill.text, whiteSpace: 'nowrap' }}>
                    {TYPE_LABEL[d.doc_type] ?? d.doc_type}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: sc.bg, color: sc.text, flexShrink: 0 }}>
                    v{d.version} · {d.status}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: '#1F3A2E', marginBottom: 3 }}>GOAL</div>
                  <div style={{ fontSize: 12, color: '#1B1B1B', lineHeight: 1.45 }}>
                    {GOAL[d.doc_type] ?? 'Goal not defined — open spec to set.'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: '#B8542A', marginBottom: 3 }}>KEY GAP</div>
                  <div style={{ fontSize: 11, color: '#5A5A5A', lineHeight: 1.4 }}>
                    {GAP[d.doc_type] ?? '—'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #F0EBE0' }}>
                  <span style={{ fontSize: 10, color: '#8A8A8A' }}>
                    updated {shortDate(d.last_updated_at)}
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
