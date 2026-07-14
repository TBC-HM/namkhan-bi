// app/marketing/media/_client/LibraryOtaProposer.tsx
// PBS 2026-07-14 · #197 v1a — "Propose for OTA" button + inline gap report.
// Reads public.v_media_ota_proposal via /api/marketing/media/ota-proposal.
// v1 shows: eligible_total · rooms_covered · profile cap delta · aesthetic style.
// v2 (later): actual per-photo picks with drag-to-reorder + reject buttons.
'use client';

import { useEffect, useState } from 'react';

interface Row {
  channel: string;
  display_name: string;
  pref_per_room: number | null;
  profile_max: number | null;
  aesthetic_style: string | null;
  min_q: number;
  min_dims: string;
  eligible_total: number;
  eligible_room_photos: number;
  rooms_covered: number;
  eligible_facility_photos: number;
  eligible_lifestyle: number;
  eligible_exterior: number;
  profile_delta: number | null;
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';
const AMBER = '#B77A2A';
const RED   = '#B23A2E';

export default function LibraryOtaProposer({ propertyId, totalRooms }: { propertyId: number; totalRooms: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || rows) return;
    setLoading(true);
    fetch(`/api/marketing/media/ota-proposal?property_id=${propertyId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(j => setRows(j.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open, rows, propertyId]);

  return (
    <div style={{ display: 'inline-block', width: '100%' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        padding: '6px 14px', fontSize: 12, fontWeight: 600, background: open ? FOREST : WHITE,
        color: open ? WHITE : INK, border: '1px solid ' + FOREST, borderRadius: 4, cursor: 'pointer',
      }}>Propose for OTA {open ? '▾' : '▸'}</button>

      {open && (
        <div style={{ marginTop: 8, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 11, color: INK_M, marginBottom: 10 }}>
            Eligibility per OTA — photos meeting <strong>min quality score</strong> AND <strong>min dimensions</strong>.
            Target ≈ preferred_photos_per_room × {totalRooms} rooms · capped at profile max. Fine-tune under Photo & Settings → Output channels.
          </div>
          {loading ? (
            <div style={{ fontSize: 11, color: INK_M, padding: 12 }}>Loading…</div>
          ) : !rows || rows.length === 0 ? (
            <div style={{ fontSize: 11, color: INK_M, padding: 12 }}>No OTA channels configured.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: INK_M }}>
                  <th style={th}>Channel</th>
                  <th style={th}>Style</th>
                  <th style={th}>Min ≥</th>
                  <th style={th}>Eligible</th>
                  <th style={th}>Room photos</th>
                  <th style={th}>Rooms</th>
                  <th style={th}>Room target</th>
                  <th style={th}>Profile cap</th>
                  <th style={th}>Gap</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const roomTarget = (r.pref_per_room ?? 0) * totalRooms;
                  const roomGap = roomTarget - r.eligible_room_photos;
                  const chip = roomGap <= 0
                    ? { text: 'ok · +' + (-roomGap),   fg: FOREST, bg: FOREST + '11' }
                    : roomGap <= (roomTarget * 0.2 || 5)
                      ? { text: 'short ' + roomGap,    fg: AMBER,  bg: AMBER  + '11' }
                      : { text: 'short ' + roomGap,    fg: RED,    bg: RED    + '11' };
                  return (
                    <tr key={r.channel} style={{ borderTop: '1px solid ' + HAIR }}>
                      <td style={{ ...td, fontWeight: 600 }}>{r.display_name}</td>
                      <td style={td}>{r.aesthetic_style ?? '—'}</td>
                      <td style={td}>{r.min_q}% · {r.min_dims}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.eligible_total.toLocaleString()}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.eligible_room_photos}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.rooms_covered}/{totalRooms}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{roomTarget}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.profile_max ?? '—'}</td>
                      <td style={td}>
                        <span style={{ padding: '2px 8px', borderRadius: 99, background: chip.bg, color: chip.fg, fontWeight: 600, fontSize: 10 }}>{chip.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A' };
const td: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: 11, color: '#1B1B1B' };
