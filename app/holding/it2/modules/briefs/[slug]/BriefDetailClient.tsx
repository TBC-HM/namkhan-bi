// app/holding/it2/modules/briefs/[slug]/BriefDetailClient.tsx
// goal-editor-v1: wraps the brief detail content, adds "✎ Goal" button + modal.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GoalEditorModal from '../_components/GoalEditorModal';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import BriefActions from '../_components/BriefActions';
import { BriefQuestionInline } from '../_components/BriefQuestionPanel';
import LiveActivityPanel from '../_components/LiveActivityPanel';

type BriefDetail = {
  id: string; slug: string; title: string; content_md: string; status: string;
  version: number; assigned_to: string | null; tags: string[] | null;
  last_updated_at: string | null; shipped_at: string | null;
  shipped_commit: string | null; target_repo: string | null; target_branch: string | null;
};

type OpenQuestion = {
  question: string;
  options: { label: string; consequence: string; recommended?: boolean }[];
} | null;

const STATUS_TOKEN: Record<string, string> = {
  draft:       'var(--status-red)',
  ready:       'var(--status-amber)',
  in_progress: 'var(--status-green)',
  shipped:     'var(--status-green)',
  archived:    'var(--status-grey)',
};

function renderMd(md: string): string {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;color:#1B1B1B;border-bottom:1px solid #E6DFCC;padding-bottom:6px">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:13px;font-weight:600;margin:14px 0 5px;color:#1B1B1B">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:12px;font-weight:600;margin:10px 0 3px;color:#5A5A5A">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`\n]+)`/g, '<code style="background:#F4EFE2;padding:1px 5px;border-radius:3px;font-size:11px;font-family:JetBrains Mono,monospace">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0;padding-left:4px">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:2px 0;list-style-type:decimal;padding-left:4px">$2</li>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 8px">')
    .replace(/\n/g, '<br/>');
}

interface Props {
  brief: BriefDetail;
  openQuestion: OpenQuestion;
}

export default function BriefDetailClient({ brief, openQuestion }: Props) {
  const [showGoalModal, setShowGoalModal] = useState(false);
  const router = useRouter();

  return (
    <div style={{ padding: '20px 24px', maxWidth: 900, color: TOKENS.ink }}>
      {/* Back */}
      <a href="/holding/it2/modules/briefs" style={{ fontSize: 11.5, color: TOKENS.text2, textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>
        ← All briefs
      </a>

      {/* Live activity */}
      {['research', 'in_progress', 'verifying'].includes(brief.status) && (
        <div style={{ marginBottom: 18 }}>
          <LiveActivityPanel slug={brief.slug} />
        </div>
      )}

      {/* Open question */}
      {brief.status === 'needs_input' && (
        <div style={{ marginBottom: 18 }}>
          <BriefQuestionInline slug={brief.slug} question={openQuestion} />
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 6px', color: TOKENS.ink }}>{brief.title}</h1>
            <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>{brief.slug}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowGoalModal(true)}
              style={{
                fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 4,
                border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#1B1B1B',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              ✎ Refine Goal
            </button>
            <BriefActions slug={brief.slug} currentStatus={brief.status} />
          </div>
        </div>

        {/* Metadata row */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11.5, color: TOKENS.text2, flexWrap: 'wrap' }}>
          <span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_TOKEN[brief.status] ?? 'var(--status-grey)', display: 'inline-block' }} />
              <span style={{ fontFamily: MONO, color: STATUS_TOKEN[brief.status] ?? TOKENS.text2 }}>{brief.status}</span>
            </span>
          </span>
          <span style={{ fontFamily: MONO }}>v{brief.version}</span>
          {brief.assigned_to && <span>→ {brief.assigned_to}</span>}
          {brief.last_updated_at && <span>edited {brief.last_updated_at.slice(0, 10)}</span>}
          {brief.shipped_at && <span style={{ color: 'var(--status-green)' }}>shipped {brief.shipped_at.slice(0, 10)}</span>}
          {brief.shipped_commit && (
            <span style={{ fontFamily: MONO, fontSize: 10 }}>
              commit {brief.shipped_commit.slice(0, 8)}
            </span>
          )}
        </div>

        {/* Tags */}
        {(brief.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {(brief.tags ?? []).map((t) => (
              <span key={t} style={{
                fontSize: 10, padding: '1px 6px', background: TOKENS.bg,
                borderRadius: 4, color: TOKENS.text2, border: `1px solid ${TOKENS.border}`,
                fontFamily: MONO,
              }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`,
          borderRadius: 8, padding: '20px 24px', fontSize: 13, lineHeight: 1.65,
        }}
        dangerouslySetInnerHTML={{ __html: `<p style="margin:0 0 8px">${renderMd(brief.content_md ?? '')}</p>` }}
      />

      {/* Goal editor modal */}
      {showGoalModal && (
        <GoalEditorModal
          briefSlug={brief.slug}
          onClose={() => setShowGoalModal(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
