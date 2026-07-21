'use client';
// app/guest/newsletters/_components/MonthlyCalendar.tsx
// PBS 2026-07-22 · 7-col × 5-6-row monthly calendar with click-through slot preview drawer.
//
// Chips:
//   * broadcast (green)   — scheduled/sent
//   * director slot       — proposed (amber) / refined (blue) / approved (slate)
//   * lifecycle count icon — small chip "N lifecycle" (aggregate)
//
// Clicking a chip opens SlotPreviewDrawer with hero + subject + body + audience estimate + buttons.

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CSSProperties } from 'react';
import SlotPreviewDrawer, { type PreviewTarget } from './SlotPreviewDrawer';

export interface CalCampaign {
  campaign_id: string;
  name: string;
  subject: string | null;
  day_iso: string;              // 'YYYY-MM-DD'
  status: string;
  audience_type: string;
}

export interface CalSlot {
  slot_id: number;
  slot_date: string;
  title: string;
  subject: string | null;
  body_md: string | null;
  hero_asset_id: string | null;
  status: string;               // proposed | refined | approved | scheduled | sent | skipped
  audience_type: string;
  goal_tag: string;
  linked_campaign_id: string | null;
}

export interface CalLifecycle {
  funnel_id: string;
  name: string;
  day_iso: string;              // aggregated per-day (may be empty for now — placeholder)
}

interface Props {
  year: number;
  month: number;                // 1-12
  campaigns: CalCampaign[];
  slots: CalSlot[];
  lifecycle: CalLifecycle[];
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';

const CHIP_COLOR: Record<string, { bg: string; fg: string; brd: string }> = {
  broadcast_scheduled: { bg: '#E4F1E0', fg: '#1F5C2C', brd: '#A9CFA0' },
  broadcast_sent:      { bg: '#EEEEEE', fg: '#3A3A3A', brd: '#DDDDDD' },
  broadcast_draft:     { bg: '#FFFFFF', fg: '#5A5A5A', brd: HAIR },
  slot_proposed:       { bg: '#F5EAD9', fg: '#8B5A1C', brd: '#E8C89B' },
  slot_refined:        { bg: '#E4EAF1', fg: '#1F3A5C', brd: '#A0B4CF' },
  slot_approved:       { bg: '#DDEAD8', fg: '#2F5A2C', brd: '#B4CFA9' },
  slot_scheduled:      { bg: '#E4F1E0', fg: '#1F5C2C', brd: '#A9CFA0' },
  slot_sent:           { bg: '#EEEEEE', fg: '#3A3A3A', brd: '#DDDDDD' },
  slot_skipped:        { bg: '#FBE8E4', fg: '#8A2419', brd: '#E8B7AB' },
  lifecycle:           { bg: '#F5F0E1', fg: '#8B6A1C', brd: '#E8D89B' },
};

function chipStyle(kind: string, status: string): { bg: string; fg: string; brd: string } {
  const k = `${kind}_${status}`;
  return CHIP_COLOR[k] ?? CHIP_COLOR[kind] ?? { bg: WHITE, fg: INK_M, brd: HAIR };
}

function buildMonthGrid(year: number, month: number): Array<Array<Date | null>> {
  // month is 1-12
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startDow = first.getUTCDay();          // 0=Sun ... 6=Sat
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(year, month - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<Date | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function fmtMonthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function MonthlyCalendar({ year, month, campaigns, slots, lifecycle }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [target, setTarget] = useState<PreviewTarget | null>(null);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // Aggregate lookups by ISO day
  const byDayBroadcast = useMemo(() => {
    const m = new Map<string, CalCampaign[]>();
    for (const c of campaigns) {
      if (!m.has(c.day_iso)) m.set(c.day_iso, []);
      m.get(c.day_iso)!.push(c);
    }
    return m;
  }, [campaigns]);

  const byDaySlot = useMemo(() => {
    const m = new Map<string, CalSlot[]>();
    for (const s of slots) {
      if (!m.has(s.slot_date)) m.set(s.slot_date, []);
      m.get(s.slot_date)!.push(s);
    }
    return m;
  }, [slots]);

  const lifecycleCount = lifecycle.length;  // aggregate — shown as small badge under the header

  function navMonth(delta: number) {
    let y = year, m = month + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    sp.set('cal', `${y}-${String(m).padStart(2, '0')}`);
    router.push('?' + sp.toString(), { scroll: false });
  }

  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden' }}>
      {/* Navigator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#FAFAF7', borderBottom: `1px solid ${HAIR}` }}>
        <button type="button" onClick={() => navMonth(-1)} style={navBtn}>‹ Prev</button>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
          {fmtMonthLabel(year, month)}
          {lifecycleCount > 0 && (
            <span style={{ marginLeft: 12, fontSize: 10, fontWeight: 600, color: INK_M }}>· {lifecycleCount} active lifecycle sequence{lifecycleCount === 1 ? '' : 's'}</span>
          )}
        </div>
        <button type="button" onClick={() => navMonth(+1)} style={navBtn}>Next ›</button>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', borderBottom: `1px solid ${HAIR}`, background: WHITE }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
          <div key={d} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, borderLeft: i > 0 ? `1px solid ${HAIR}` : undefined }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))' }}>
        {grid.map((week, wi) => (
          week.map((d, di) => {
            const isBorderTop = wi > 0;
            const isBorderLeft = di > 0;
            if (!d) {
              return (
                <div key={`e-${wi}-${di}`} style={{ minHeight: 108, background: '#FAFAF7', borderTop: isBorderTop ? `1px solid ${HAIR}` : undefined, borderLeft: isBorderLeft ? `1px solid ${HAIR}` : undefined }} />
              );
            }
            const iso = d.toISOString().slice(0, 10);
            const broadcasts = byDayBroadcast.get(iso) ?? [];
            const daySlots   = byDaySlot.get(iso) ?? [];
            const isToday    = iso === new Date().toISOString().slice(0, 10);
            return (
              <div key={iso} style={{
                minHeight: 108, padding: 6, background: isToday ? '#F5F0E1' : WHITE,
                borderTop: isBorderTop ? `1px solid ${HAIR}` : undefined,
                borderLeft: isBorderLeft ? `1px solid ${HAIR}` : undefined,
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#084838' : INK_M, marginBottom: 2 }}>{d.getUTCDate()}</div>

                {broadcasts.map((c) => {
                  const s = chipStyle('broadcast', c.status);
                  return (
                    <button
                      key={'b-' + c.campaign_id}
                      type="button"
                      title={c.subject ?? c.name}
                      onClick={() => setTarget({ kind: 'broadcast', id: c.campaign_id, title: c.name, subject: c.subject ?? undefined, day_iso: iso })}
                      style={chipBtn(s)}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>B</span>
                      <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.name}</span>
                    </button>
                  );
                })}

                {daySlots.map((s) => {
                  const c = chipStyle('slot', s.status);
                  return (
                    <button
                      key={'s-' + s.slot_id}
                      type="button"
                      title={`${s.title} · ${s.status} · ${s.goal_tag}`}
                      onClick={() => setTarget({
                        kind: 'director', id: String(s.slot_id), title: s.title, subject: s.subject ?? undefined,
                        body_md: s.body_md ?? undefined, hero_asset_id: s.hero_asset_id ?? undefined,
                        goal_tag: s.goal_tag, audience_type: s.audience_type, status: s.status,
                        day_iso: iso,
                      })}
                      style={chipBtn(c)}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>D</span>
                      <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.title}</span>
                    </button>
                  );
                })}
              </div>
            );
          })
        ))}
      </div>

      {/* Legend */}
      <div style={{ padding: '8px 14px', background: '#FAFAF7', borderTop: `1px solid ${HAIR}`, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, color: INK_M }}>
        <LegendChip label="Broadcast · scheduled" c={CHIP_COLOR.broadcast_scheduled} />
        <LegendChip label="Slot · proposed"       c={CHIP_COLOR.slot_proposed} />
        <LegendChip label="Slot · refined"        c={CHIP_COLOR.slot_refined} />
        <LegendChip label="Slot · approved"       c={CHIP_COLOR.slot_approved} />
        <LegendChip label="Sent"                  c={CHIP_COLOR.slot_sent} />
      </div>

      {target && <SlotPreviewDrawer target={target} onClose={() => setTarget(null)} />}
    </div>
  );
}

function LegendChip({ label, c }: { label: string; c: { bg: string; fg: string; brd: string } }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.brd}` }} />
      {label}
    </span>
  );
}

function chipBtn(c: { bg: string; fg: string; brd: string }): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '2px 5px', fontSize: 10, fontWeight: 600,
    background: c.bg, color: c.fg, border: `1px solid ${c.brd}`,
    borderRadius: 3, cursor: 'pointer', textAlign: 'left',
    fontFamily: 'inherit',
    maxWidth: '100%',
  };
}

const navBtn: CSSProperties = { padding: '4px 12px', fontSize: 11, fontWeight: 600, background: WHITE, color: INK, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
