'use client';
// Interactive content pipeline: proposed slots → accept/skip → draft post → inbox.
// Converted from static RSC to client component so proposed cards have Accept/Skip
// buttons that call the API directly. Optimistic updates — no page reload needed.

import { useState, useTransition, type ReactNode } from 'react';
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

const PLATFORM_COLOR: Record<string, string> = {
  x: '#1DA1F2', google_business: '#4285F4', instagram: '#C13584',
  facebook: '#1877F2', tiktok: '#000000', pinterest: '#E60023',
  linkedin: '#0A66C2', youtube: '#FF0000',
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

  // Default to All so proposed slots (non-X) are visible
  const [filterPlatform, setFilterPlatform] = useState<string>('all');

  const [slotStates, setSlotStates] = useState<Record<number, SlotState>>({});
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({});

  // Collapsed state per column per platform group: key = `${column}:${platform}`
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const isCollapsed = (key: string) => collapsed[key] ?? false;

  const setSlotState = (id: number, state: SlotState) =>
    setSlotStates((prev) => ({ ...prev, [id]: state }));

  const activePlatforms = Array.from(new Set(initialSlots.map((s) => s.platform))).sort();

  const filterSlots = (ss: SocialCalendarSlot[]) =>
    filterPlatform === 'all' ? ss : ss.filter((s) => s.platform === filterPlatform);
  const filterPosts = (ps: SocialPostRow[]) =>
    filterPlatform === 'all' ? ps : ps.filter((p) => p.platform === filterPlatform);

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
    .filter((s) => slotStates[s.slot_id] !== 'rejected' && slotStates[s.slot_id] !== 'accepted');

  const optimisticDrafting = filterSlots(
    initialSlots.filter((s) => s.status === 'proposed' && slotStates[s.slot_id] === 'accepted')
  );

  const drafting  = filterPosts(posts.filter((p) => p.status === 'draft'));
  const ready     = filterPosts(posts.filter((p) => p.status === 'ready'));
  const scheduled = filterPosts(posts.filter((p) => p.status === 'scheduled'));
  const pushed    = filterPosts(posts.filter((p) => p.status === 'pushed'));
  const failed    = filterPosts(posts.filter((p) => p.status === 'failed' || p.status === 'cancelled'));

  // ── Group helpers ──────────────────────────────────────────────

  function groupByPlatform<T extends { platform: string }>(items: T[]): [string, T[]][] {
    const map = new Map<string, T[]>();
    for (const item of items) {
      if (!map.has(item.platform)) map.set(item.platform, []);
      map.get(item.platform)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function groupSlotsByPlatform(items: SocialCalendarSlot[]): [string, SocialCalendarSlot[]][] {
    const map = new Map<string, SocialCalendarSlot[]>();
    for (const item of items) {
      if (!map.has(item.platform)) map.set(item.platform, []);
      map.get(item.platform)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  // ── Channel group header ───────────────────────────────────────

  function ChannelGroup({ colKey, platform, count, children }: {
    colKey: string; platform: string; count: number; children: ReactNode;
  }) {
    const key = `${colKey}:${platform}`;
    const open = !isCollapsed(key);
    const color = PLATFORM_COLOR[platform] ?? FOREST;
    return (
      <div style={{ marginBottom: 4 }}>
        <button
          onClick={() => toggleCollapse(key)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 4px',
            borderRadius: 3,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: WHITE, background: color,
              padding: '1px 5px', borderRadius: 2,
            }}>
              {GLYPH[platform] ?? platform.toUpperCase()}
            </span>
            <span style={{ fontSize: 10, color: INK_M }}>{count}</span>
          </div>
          <span style={{ fontSize: 10, color: INK_M }}>{open ? '▾' : '▸'}</span>
        </button>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}>
            {children}
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Content flow · slot → post → published</div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>

          {/* PROPOSED */}
          <Column title="Proposed" note="click Accept to draft" count={proposed.length} color={AMBER}>
            {proposed.length === 0
              ? <Empty text="No proposed slots — generate a plan on the channel page" />
              : groupSlotsByPlatform(proposed).map(([platform, slots]) => (
                <ChannelGroup key={platform} colKey="proposed" platform={platform} count={slots.length}>
                  {slots.slice(0, 20).map((s) => {
                    const state = slotStates[s.slot_id] ?? 'idle';
                    const accepting = state === 'accepting';
                    const accepted  = state === 'accepted';
                    const err       = slotErrors[s.slot_id];
                    return (
                      <div key={s.slot_id} style={{ background: WHITE, border: `1px solid ${accepted ? GREEN : HAIR}`, borderRadius: 3, padding: '6px 8px' }}>
                        <div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>{s.slot_date}</div>
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
                  {slots.length > 20 && (
                    <div style={{ fontSize: 10, color: INK_M, textAlign: 'center' }}>+{slots.length - 20} more</div>
                  )}
                </ChannelGroup>
              ))
            }
          </Column>

          {/* DRAFTING */}
          <Column title="Drafting" note="AI-drafted · edit in Inbox" count={drafting.length + optimisticDrafting.length} color={AMBER}>
            {drafting.length === 0 && optimisticDrafting.length === 0
              ? <Empty text="Accept a slot →" />
              : <>
                {optimisticDrafting.length > 0 && groupSlotsByPlatform(optimisticDrafting).map(([platform, slots]) => (
                  <ChannelGroup key={platform} colKey="drafting-opt" platform={platform} count={slots.length}>
                    {slots.map((s) => (
                      <div key={`opt:${s.slot_id}`} style={{ background: WHITE, border: `1px solid ${AMBER}`, borderRadius: 3, padding: '6px 8px', opacity: 0.7 }}>
                        <div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>{s.slot_date}</div>
                        <div style={{ fontSize: 11, color: INK, lineHeight: 1.4, marginBottom: 4 }}>{s.title ?? s.hook ?? s.program_label ?? '(drafting…)'}</div>
                        <div style={{ fontSize: 9, color: AMBER, fontWeight: 600 }}>AI writing…</div>
                      </div>
                    ))}
                  </ChannelGroup>
                ))}
                {groupByPlatform(drafting).map(([platform, ps]) => (
                  <ChannelGroup key={platform} colKey="drafting" platform={platform} count={ps.length}>
                    {ps.slice(0, 12).map((p) => (
                      <PostCard key={p.post_id} label={p.title ?? p.caption ?? '(untitled)'}
                        sub={`draft · ${p.created_at?.slice(0, 10) ?? ''}`} linkHref="?view=inbox" />
                    ))}
                  </ChannelGroup>
                ))}
              </>
            }
          </Column>

          {/* QUEUED (ready + scheduled merged, grouped by platform) */}
          <Column title="Queued" note="approved · queued for publish" count={ready.length + scheduled.length} color={GREEN}>
            {ready.length === 0 && scheduled.length === 0
              ? <Empty text="Approve drafts in Inbox →" />
              : (() => {
                const all = [...ready, ...scheduled].sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
                return groupByPlatform(all).map(([platform, ps]) => (
                  <ChannelGroup key={platform} colKey="queued" platform={platform} count={ps.length}>
                    {ps.map((p) => (
                      <PostCard key={p.post_id}
                        label={p.title ?? p.caption?.slice(0, 70) ?? '(untitled)'}
                        sub={p.scheduled_at ? p.scheduled_at.slice(0, 10) : 'no date'}
                        linkHref="?view=inbox" />
                    ))}
                  </ChannelGroup>
                ));
              })()
            }
          </Column>

          {/* PUBLISHED */}
          <Column title="Published" note="live on channel" count={pushed.length} color={FOREST}>
            {pushed.length === 0
              ? <Empty text="—" />
              : groupByPlatform(pushed).map(([platform, ps]) => (
                <ChannelGroup key={platform} colKey="published" platform={platform} count={ps.length}>
                  {ps.slice(0, 12).map((p) => (
                    <PostCard key={p.post_id} label={p.title ?? p.caption?.slice(0, 70) ?? '(untitled)'}
                      sub={p.pushed_at?.slice(0, 10) ?? ''} />
                  ))}
                </ChannelGroup>
              ))
            }
          </Column>

          {/* FAILED */}
          <Column title="Failed" note="needs attention" count={failed.length} color={RED}>
            {failed.length === 0
              ? <Empty text="—" />
              : groupByPlatform(failed).map(([platform, ps]) => (
                <ChannelGroup key={platform} colKey="failed" platform={platform} count={ps.length}>
                  {ps.map((p) => (
                    <PostCard key={p.post_id} label={p.title ?? p.caption?.slice(0, 70) ?? '(untitled)'}
                      sub={p.last_error?.slice(0, 50) ?? p.status} linkHref="?view=inbox" />
                  ))}
                </ChannelGroup>
              ))
            }
          </Column>

        </div>
      </div>
    </div>
  );
}

function Column({ title, note, count, color, children }: {
  title: string; note: string; count: number; color: string; children: ReactNode;
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

function PostCard({ label, sub, linkHref }: {
  label: string; sub: string; linkHref?: string;
}) {
  const inner = (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 3, padding: '5px 8px' }}>
      <div style={{ fontSize: 11, color: INK, lineHeight: 1.4 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: INK_M, marginTop: 2 }}>{sub}</div>}
      {linkHref && <div style={{ fontSize: 9, color: FOREST, marginTop: 3, fontWeight: 600 }}>→ Inbox</div>}
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
