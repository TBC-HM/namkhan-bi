'use client';
// Interactive content pipeline: proposed slots → accept/skip → draft post → inbox.
// Converted from static RSC to client component so proposed cards have Accept/Skip
// buttons that call the API directly. Optimistic updates — no page reload needed.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { SocialCalendarSlot, SocialPostRow } from '@/lib/marketing-social';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const RED    = '#B04A2F';
const AMBER  = '#A06020';
const GREEN  = '#1A7A4A';

const GLYPH: Record<string, string> = {
  google_business: 'GBP', instagram: 'IG', pinterest: 'PI',
  tiktok: 'TT', facebook: 'FB', linkedin: 'LI', x: 'X',
};

type SlotState = 'idle' | 'accepting' | 'accepted' | 'rejecting' | 'rejected' | 'error';

export default function SocialFlow({
  slots: initialSlots,
  posts,
}: {
  slots: SocialCalendarSlot[];
  posts: SocialPostRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Platform filter — default to X if any X slots exist
  const hasX = initialSlots.some((s) => s.platform === 'x');
  const [filterPlatform, setFilterPlatform] = useState<string>(hasX ? 'x' : 'all');

  // Track per-slot action state for optimistic UI
  const [slotStates, setSlotStates] = useState<Record<number, SlotState>>({});
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({});

  const setSlotState = (id: number, state: SlotState) =>
    setSlotStates((prev) => ({ ...prev, [id]: state }));

  // Active platforms in the current window
  const activePlatforms = Array.from(new Set(initialSlots.map((s) => s.platform))).sort();

  // Filter helpers
  const filterSlots = (ss: SocialCalendarSlot[]) =>
    filterPlatform === 'all' ? ss : ss.filter((s) => s.platform === filterPlatform);
  const filterPosts = (ps: SocialPostRow[]) =>
    filterPlatform === 'all' ? ps : ps.filter((p) => p.platform === filterPlatform);

  // ── API actions ────────────────────────────────────────────────

  async function acceptSlot(slot: SocialCalendarSlot) {
    setSlotState(slot.slot_id, 'accepting');
    setSlotErrors((e) => { const n = { ...e }; delete n[slot.slot_id]; return n; });
    try {
      const res = await fetch('/api/marketing/social/accept-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slot.slot_id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSlotState(slot.slot_id, 'error');
        setSlotErrors((e) => ({ ...e, [slot.slot_id]: json.error ?? 'Accept failed' }));
      } else {
        setSlotState(slot.slot_id, 'accepted');
        startTransition(() => router.refresh());
      }
    } catch (err: unknown) {
      setSlotState(slot.slot_id, 'error');
      setSlotErrors((e) => ({ ...e, [slot.slot_id]: String((err as Error)?.message ?? err) }));
    }
  }

  async function skipSlot(slot: SocialCalendarSlot) {
    setSlotState(slot.slot_id, 'rejecting');
    try {
      const res = await fetch('/api/marketing/social/reject-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slot.slot_id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSlotState(slot.slot_id, 'error');
        setSlotErrors((e) => ({ ...e, [slot.slot_id]: json.error ?? 'Skip failed' }));
      } else {
        setSlotState(slot.slot_id, 'rejected');
        startTransition(() => router.refresh());
      }
    } catch (err: unknown) {
      setSlotState(slot.slot_id, 'error');
      setSlotErrors((e) => ({ ...e, [slot.slot_id]: String((err as Error)?.message ?? err) }));
    }
  }

  // ── Column data ────────────────────────────────────────────────

  const proposed = filterSlots(initialSlots.filter((s) => s.status === 'proposed'))
    .filter((s) => slotStates[s.slot_id] !== 'rejected');

  const drafting = filterPosts(posts.filter((p) => p.status === 'draft'));
  const ready    = filterPosts(posts.filter((p) => p.status === 'ready'));
  const scheduled = filterPosts(posts.filter((p) => p.status === 'scheduled'));
  const pushed   = filterPosts(posts.filter((p) => p.status === 'pushed'));
  const failed   = filterPosts(posts.filter((p) => p.status === 'failed' || p.status === 'cancelled'));

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Content flow · slot → post → published</div>
          {/* Platform filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['all', ...activePlatforms].map((p) => (
              <button key={p} onClick={() => setFilterPlatform(p)}
                style={{
                  padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 3, cursor: 'pointer', border: 'none',
                  background: filterPlatform === p ? FOREST : HAIR,
                  color: filterPlatform === p ? WHITE : INK_M,
                }}>
                {p === 'all' ? 'All' : (GLYPH[p] ?? p.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        {/* Kanban */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>

          {/* PROPOSED — interactive */}
          <Column title="Proposed" note="click Accept to draft" count={proposed.length} color={AMBER}>
            {proposed.slice(0, 20).map((s) => {
              const state = slotStates[s.slot_id] ?? 'idle';
              const accepting = state === 'accepting';
              const accepted  = state === 'accepted';
              const err       = slotErrors[s.slot_id];
              return (
                <div key={s.slot_id} style={{ background: WHITE, border: `1px solid ${accepted ? GREEN : HAIR}`, borderRadius: 3, padding: '6px 8px' }}>
                  <div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>
                    {GLYPH[s.platform] ?? s.platform} · {s.slot_date}
                  </div>
                  <div style={{ fontSize: 11, color: INK, lineHeight: 1.4, marginBottom: 4 }}>
                    {s.title ?? s.hook ?? s.program_label ?? '(untitled)'}
                  </div>
                  {s.program_label && (
                    <div style={{ fontSize: 9, color: INK_M, marginBottom: 4 }}>{s.program_label}</div>
                  )}
                  {accepted ? (
                    <div style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>✓ Drafting — check Inbox</div>
                  ) : err ? (
                    <div style={{ fontSize: 9, color: RED, marginBottom: 2 }}>{err}</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => acceptSlot(s)} disabled={accepting}
                        style={{ flex: 1, padding: '3px 0', fontSize: 10, fontWeight: 700, background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: accepting ? 'wait' : 'pointer', opacity: accepting ? 0.7 : 1 }}>
                        {accepting ? '…' : '✓ Accept'}
                      </button>
                      <button onClick={() => skipSlot(s)} disabled={accepting}
                        style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, background: WHITE, color: INK_M, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' }}>
                        ✗
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {proposed.length > 20 && (
              <div style={{ fontSize: 10, color: INK_M, textAlign: 'center' }}>+{proposed.length - 20} more</div>
            )}
            {proposed.length === 0 && <Empty text="No proposed slots — generate a plan on the channel page" />}
          </Column>

          {/* DRAFTING */}
          <Column title="Drafting" note="AI-drafted · edit in Inbox" count={drafting.length} color={AMBER}>
            {drafting.slice(0, 12).map((p) => (
              <PostCard key={p.post_id} platform={p.platform} label={p.title ?? '(untitled)'}
                sub={`draft · ${p.created_at?.slice(0, 10) ?? ''}`} linkHref="?view=inbox" />
            ))}
            {drafting.length === 0 && <Empty text="Accept a slot →" />}
          </Column>

          {/* READY */}
          <Column title="Ready" note="approved · set schedule" count={ready.length} color={GREEN}>
            {ready.slice(0, 12).map((p) => (
              <PostCard key={p.post_id} platform={p.platform} label={p.title ?? '(untitled)'}
                sub={p.scheduled_at ? `target ${p.scheduled_at.slice(0, 10)}` : 'no date'} linkHref="?view=inbox" />
            ))}
            {ready.length === 0 && <Empty text="Approve drafts in Inbox →" />}
          </Column>

          {/* SCHEDULED */}
          <Column title="Scheduled" note="queued for publish" count={scheduled.length} color={FOREST}>
            {scheduled.slice(0, 12).map((p) => (
              <PostCard key={p.post_id} platform={p.platform} label={p.title ?? '(untitled)'}
                sub={p.scheduled_at?.slice(0, 16).replace('T', ' ') ?? 'no date'} linkHref="?view=inbox" />
            ))}
            {scheduled.length === 0 && <Empty text="—" />}
          </Column>

          {/* PUBLISHED */}
          <Column title="Published" note="live on channel" count={pushed.length} color={FOREST}>
            {pushed.slice(0, 12).map((p) => (
              <PostCard key={p.post_id} platform={p.platform} label={p.title ?? '(untitled)'}
                sub={p.pushed_at?.slice(0, 10) ?? ''} />
            ))}
            {pushed.length === 0 && <Empty text="—" />}
          </Column>

          {/* FAILED */}
          <Column title="Failed" note="needs attention" count={failed.length} color={RED}>
            {failed.slice(0, 12).map((p) => (
              <PostCard key={p.post_id} platform={p.platform} label={p.title ?? '(untitled)'}
                sub={p.last_error?.slice(0, 50) ?? p.status} linkHref="?view=inbox" />
            ))}
            {failed.length === 0 && <Empty text="—" />}
          </Column>

        </div>
      </div>
    </div>
  );
}

function Column({ title, note, count, color, children }: {
  title: string; note: string; count: number; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color, fontWeight: 700, marginBottom: 2 }}>
        <span>{title}</span>
        <span style={{ color: INK_M }}>{count}</span>
      </div>
      <div style={{ fontSize: 9, color: INK_M, marginBottom: 6 }}>{note}</div>
      {children}
    </div>
  );
}

function PostCard({ platform, label, sub, linkHref }: {
  platform: string; label: string; sub: string; linkHref?: string;
}) {
  const inner = (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 3, padding: '6px 8px' }}>
      <div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>{GLYPH[platform] ?? platform}</div>
      <div style={{ fontSize: 11, color: INK, lineHeight: 1.4 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: INK_M, marginTop: 2 }}>{sub}</div>}
      {linkHref && <div style={{ fontSize: 9, color: FOREST, marginTop: 4, fontWeight: 600 }}>→ Inbox</div>}
    </div>
  );
  if (!linkHref) return inner;
  return <a href={linkHref} style={{ textDecoration: 'none' }}>{inner}</a>;
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, color: INK_M, fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
      {text}
    </div>
  );
}
