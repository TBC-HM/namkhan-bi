// app/holding/it/cockpit/briefs/[slug]/page.tsx
// Bug #83 — brief detail: renders content_md + metadata + status actions.

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '../../_components/tokens';
import BriefActions from '../_components/BriefActions';
import { BriefQuestionInline } from '../_components/BriefQuestionPanel';

export const dynamic = 'force-dynamic';

type BriefDetail = {
  id: string; slug: string; title: string; content_md: string; status: string;
  version: number; assigned_to: string | null; tags: string[] | null;
  last_updated_at: string | null; shipped_at: string | null;
  shipped_commit: string | null; target_repo: string | null; target_branch: string | null;
};

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

export default async function BriefDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = getSupabaseAdmin();
  const { data } = await sb.rpc('fn_get_build_brief', { p_slug: slug });
  if (!data) notFound();
  const brief = data as BriefDetail;

  // PBS 2026-07-27: the open question must be IMPOSSIBLE to miss on the detail
  // page — pinned above the content, never buried in the brief text.
  const { data: qRow } = await (sb as any)
    .from('v_build_briefs_index')
    .select('open_question')
    .eq('slug', slug)
    .maybeSingle();
  const openQuestion = (qRow?.open_question ?? null) as
    { question: string; options: { label: string; consequence: string; recommended?: boolean }[] } | null;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 900, color: TOKENS.ink }}>
      {/* Back */}
      <a href="/holding/it/cockpit/briefs" style={{ fontSize: 11.5, color: TOKENS.text2, textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>
        ← All briefs
      </a>

      {/* Open question — pinned at the very top, above everything */}
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
          <BriefActions slug={brief.slug} currentStatus={brief.status} />
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
    </div>
  );
}
