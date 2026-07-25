'use client';
// app/marketing/social/_components/SocialCalendar.tsx
// spec-social-media-module (2026-07-25, run 2) · A3/A6 — DB-backed content
// calendar. Slots come from public.v_social_calendar_slots (server-fetched by
// the page); per-channel weekly programs drive generation. Actions:
//   Generate plan → POST /api/marketing/social/generate-plan (rule-based v1)
//   Accept slot   → POST /api/marketing/social/accept-slot (→ draft post, inbox)
//   Reject slot   → POST /api/marketing/social/reject-slot
// Replaces the Phase-1 hardcoded buildProposedPosts() calendar.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SocialProgram } from '@/lib/marketing';
import type { SocialCalendarSlot } from '@/lib/marketing-social';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B03826';
const AMBER  = '#C28F2C';
const CREAM  = '#F5F0E1';

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function slotColor(status: SocialCalendarSlot['status']): string {
  switch (status) {
    case 'accepted':  return '#3E8DBE';
    case 'drafted':   return '#3E8DBE';
    case 'scheduled': return FOREST;
    case 'published': return '#5DA46B';
    case 'rejected':  return RED;
    default:          return AMBER; // proposed
  }
}

const GLYPH: Record<string, string> = {
  google_business: 'GBP', instagram: 'IG', pinterest: 'PI', tiktok: 'TT',
  facebook: 'FB', linkedin: 'LI', x: 'X',
};

export default function SocialCalendar({ propertyId, slots, programs, todayIso, windowDays, channelFilter, platforms }: {
  propertyId: number;
  slots: SocialCalendarSlot[];
  programs: SocialProgram[];
  todayIso: string;
  windowDays: number;
  channelFilter: string;   // 'all' or platform
  platforms: string[];     // active roster (from channel rules)
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); // 'plan' | `slot-${id}`
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<SocialCalendarSlot | null>(null);

  const visible = slots.filter((s) =>
    s.status !== 'rejected' && (channelFilter === 'all' || s.platform === channelFilter));
  const byDate = new Map<string, SocialCalendarSlot[]>();
  for (const s of visible) {
    const arr = byDate.get(s.slot_date) ?? [];
    arr.push(s);
    byDate.set(s.slot_date, arr);
  }
  const days: string[] = Array.from({ length: windowDays }, (_, i) => addDaysIso(todayIso, i));

  async function call(path: string, body: Record<string, unknown>, key: string) {
    setBusy(key); setErr(null);
    try {
      const res = await fetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'request failed');
      setDetail(null);
      router.refresh();
    } catch (ex: any) {
      setErr(ex?.message ?? 'request failed');
    } finally {
      setBusy(null);
    }
  }

  const generatePlan = () => call('/api/marketing/social/generate-plan', {
    property_id: propertyId, start_date: todayIso, end_date: addDaysIso(todayIso, windowDays),
  }, 'plan');
  const acceptSlot = (id: number) => call('/api/marketing/social/accept-slot', { slot_id: id }, `slot-${id}`);
  const rejectSlot = (id: number) => call('/api/marketing/social/reject-slot', { slot_id: id }, `slot-${id}`);

  const proposed = visible.filter((s) => s.status === 'proposed').length;

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Content calendar</div>
            <div style={{ fontSize: 10, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {visible.length} slots · {proposed} proposed · {windowDays}-day window
              {channelFilter !== 'all' ? ` · ${channelFilter}` : ''} · {programs.length} weekly programs
            </div>
          </div>
          <button type="button" onClick={generatePlan} disabled={busy !== null} style={btnPrimary}>
            {busy === 'plan' ? 'Generating…' : `Generate plan · ${windowDays}d`}
          </button>
        </div>

        {err && (
          <div style={{ marginBottom: 8, padding: '6px 8px', border: `1px solid ${RED}`, borderRadius: 3, color: RED, fontSize: 11 }}>{err}</div>
        )}

        {/* Filters (server-rendered links keep the page shareable) */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={filterGroupSt}>
            <span style={filterLabelSt}>Window</span>
            {[14, 28, 60].map((w) => (
              <a key={w} href={`?view=calendar&w=${w}&ch=${channelFilter}`}
                 style={{ ...chipSt, ...(w === windowDays ? chipActiveSt : {}) }}>{w}d</a>
            ))}
          </span>
          <span style={filterGroupSt}>
            <span style={filterLabelSt}>Channel</span>
            <a href={`?view=calendar&w=${windowDays}&ch=all`} style={{ ...chipSt, ...(channelFilter === 'all' ? chipActiveSt : {}) }}>All</a>
            {platforms.map((p) => (
              <a key={p} href={`?view=calendar&w=${windowDays}&ch=${p}`}
                 style={{ ...chipSt, ...(channelFilter === p ? chipActiveSt : {}) }}>
                {GLYPH[p] ?? p}
              </a>
            ))}
          </span>
        </div>

        {visible.length === 0 && (
          <div style={{ padding: '18px 12px', textAlign: 'center', color: INK_M, fontSize: 12, background: CREAM, borderRadius: 4, marginBottom: 10 }}>
            No slots in this window yet. <strong>Generate plan</strong> expands the weekly programs
            (Channels tab → programs) into proposed slots for review.
          </div>
        )}

        {/* Day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
          {days.map((iso) => {
            const daySlots = byDate.get(iso) ?? [];
            const d = new Date(iso + 'T00:00:00Z');
            const isToday = iso === todayIso;
            return (
              <div key={iso} style={{
                background: WHITE, border: `1px solid ${isToday ? FOREST : HAIR}`, borderRadius: 4,
                padding: '6px 8px', minHeight: 68, display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{d.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'UTC' })}</span>
                  <span style={{ fontSize: 9, color: INK_M }}>{d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })} · {d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</span>
                </div>
                {daySlots.length === 0 ? (
                  <div style={{ color: INK_M, fontSize: 10 }}>—</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {daySlots.map((s) => (
                      <button key={s.slot_id} type="button" onClick={() => setDetail(s)}
                              title={`${s.platform} · ${s.program_label ?? ''}\n${s.title ?? ''}`}
                              style={{ ...slotChipSt, borderColor: slotColor(s.status), color: slotColor(s.status) }}>
                        <span style={{ fontSize: 9, fontWeight: 700 }}>{GLYPH[s.platform] ?? s.platform}</span>
                        <span style={{ fontSize: 9 }}>{s.format ?? s.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Slot detail drawer (inline panel) */}
        {detail && (
          <div style={{ marginTop: 12, background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
              <div>
                <span style={{ fontSize: 10, color: INK_M, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {detail.slot_date} · {detail.platform} · {detail.program_label ?? detail.category_code ?? 'no program'} · {detail.status}
                </span>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{detail.title ?? detail.hook ?? '(untitled)'}</div>
              </div>
              <button type="button" onClick={() => setDetail(null)} style={btnSecondary}>Close</button>
            </div>
            {detail.brief_md && (
              <div style={{ fontSize: 11, color: '#3A3A3A', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{detail.brief_md}</div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              {detail.status === 'proposed' && (
                <>
                  <button type="button" disabled={busy !== null} onClick={() => acceptSlot(detail.slot_id)} style={btnPrimary}>
                    {busy === `slot-${detail.slot_id}` ? 'Working…' : '✓ Accept → draft post'}
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => rejectSlot(detail.slot_id)} style={btnSecondary}>Reject</button>
                </>
              )}
              {detail.status !== 'proposed' && detail.linked_post_id && (
                <a href={`?view=inbox`} style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  View draft in inbox →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const filterGroupSt: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const filterLabelSt: React.CSSProperties = { fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: FOREST, fontWeight: 700 };
const chipSt: React.CSSProperties = { padding: '3px 9px', fontSize: 11, letterSpacing: '0.06em', color: INK, background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 999, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' };
const chipActiveSt: React.CSSProperties = { color: WHITE, background: FOREST, borderColor: FOREST, fontWeight: 700 };
const slotChipSt: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 5px',
  border: '1px solid', borderRadius: 2, whiteSpace: 'nowrap', background: WHITE, cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 500, background: WHITE, color: '#3A3A3A', border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
