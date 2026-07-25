// app/marketing/social/_components/SocialFlow.tsx
// spec-social-media-module (2026-07-25, run 2) · A6 — DB-backed pipeline view.
// Replaces the hardcoded ConceptFlowView Kanban. Columns are derived from the
// real slot/post lifecycle: proposed slots → accepted (draft post exists) →
// ready → scheduled → pushed. Server component — no interactivity here;
// actions live in the calendar (accept/reject) and inbox (post status).

import type { SocialCalendarSlot, SocialPostRow } from '@/lib/marketing-social';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';

const GLYPH: Record<string, string> = {
  google_business: 'GBP', instagram: 'IG', pinterest: 'PI', tiktok: 'TT',
  facebook: 'FB', linkedin: 'LI', x: 'X',
};

interface FlowCard {
  key: string;
  platform: string;
  label: string;
  sub: string;
}

export default function SocialFlow({ slots, posts }: {
  slots: SocialCalendarSlot[];
  posts: SocialPostRow[];
}) {
  const linkedPostIds = new Set(slots.map((s) => s.linked_post_id).filter(Boolean) as string[]);

  const columns: { title: string; note: string; cards: FlowCard[] }[] = [
    {
      title: 'Proposed',
      note: 'calendar slots awaiting review',
      cards: slots.filter((s) => s.status === 'proposed').map((s) => ({
        key: `slot-${s.slot_id}`, platform: s.platform,
        label: s.title ?? s.hook ?? '(untitled)',
        sub: `${s.slot_date} · ${s.program_label ?? s.category_code ?? ''}`,
      })),
    },
    {
      title: 'Drafting',
      note: 'accepted → draft post in inbox',
      cards: posts.filter((p) => p.status === 'draft').map((p) => ({
        key: `post-${p.post_id}`, platform: p.platform,
        label: p.title ?? '(untitled)',
        sub: linkedPostIds.has(p.post_id) ? 'from calendar slot' : 'manual draft',
      })),
    },
    {
      title: 'Ready',
      note: 'approved · awaiting schedule/export',
      cards: posts.filter((p) => p.status === 'ready').map((p) => ({
        key: `post-${p.post_id}`, platform: p.platform,
        label: p.title ?? '(untitled)',
        sub: p.scheduled_at ? `target ${p.scheduled_at.slice(0, 10)}` : 'no date',
      })),
    },
    {
      title: 'Scheduled',
      note: 'queued for publish/export',
      cards: posts.filter((p) => p.status === 'scheduled').map((p) => ({
        key: `post-${p.post_id}`, platform: p.platform,
        label: p.title ?? '(untitled)',
        sub: p.scheduled_at ? p.scheduled_at.slice(0, 16).replace('T', ' ') : 'no date',
      })),
    },
    {
      title: 'Published',
      note: 'pushed to channel',
      cards: posts.filter((p) => p.status === 'pushed').map((p) => ({
        key: `post-${p.post_id}`, platform: p.platform,
        label: p.title ?? '(untitled)',
        sub: p.pushed_at ? p.pushed_at.slice(0, 10) : '',
      })),
    },
    {
      title: 'Failed / cancelled',
      note: 'needs attention',
      cards: posts.filter((p) => p.status === 'failed' || p.status === 'cancelled').map((p) => ({
        key: `post-${p.post_id}`, platform: p.platform,
        label: p.title ?? '(untitled)',
        sub: p.last_error ? p.last_error.slice(0, 60) : p.status,
      })),
    },
  ];

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Content flow · slot → post → published</div>
          <div style={{ fontSize: 10, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            live from social_calendar + social_posts
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
          {columns.map((col) => (
            <div key={col.title} style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST, fontWeight: 700, marginBottom: 2 }}>
                <span>{col.title}</span>
                <span style={{ color: INK_M }}>{col.cards.length}</span>
              </div>
              <div style={{ fontSize: 9, color: INK_M, marginBottom: 6 }}>{col.note}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {col.cards.slice(0, 12).map((c) => (
                  <div key={c.key} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 3, padding: '6px 8px' }}>
                    <div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>{GLYPH[c.platform] ?? c.platform}</div>
                    <div style={{ fontSize: 11, color: INK, lineHeight: 1.4 }}>{c.label}</div>
                    {c.sub && <div style={{ fontSize: 9, color: INK_M, marginTop: 2 }}>{c.sub}</div>}
                  </div>
                ))}
                {col.cards.length > 12 && (
                  <div style={{ fontSize: 10, color: INK_M, textAlign: 'center' }}>+{col.cards.length - 12} more</div>
                )}
                {col.cards.length === 0 && (
                  <div style={{ fontSize: 10, color: INK_M, fontStyle: 'italic', textAlign: 'center' }}>—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
