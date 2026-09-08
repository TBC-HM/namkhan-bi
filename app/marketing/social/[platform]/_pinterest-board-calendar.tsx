'use client';
// Pinterest-specific calendar panel: board-centric instead of program-centric.
// Each board gets a social_programs row (seeded via /api/marketing/social/seed-pinterest-programs).
// Standard generate-plan then creates slots per board using those programs.

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const RED    = '#B04A2F';
const AMBER  = '#A06020';

interface Board {
  board_id: string;
  board_name: string | null;
  pin_count: number | null;
}

interface Program {
  id: number;
  label: string;
  notes: string | null;   // board_id stored here
  weekday_slots: number[] | null;
  posts_per_week: number;
  active: boolean;
}

interface Props {
  propertyId: number;
  boards: Board[];
  programs: Program[];  // pre-filtered: pinterest + category_code=board
}

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

export default function PinterestBoardCalendar({ propertyId, boards, programs: initialPrograms }: Props) {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>(initialPrograms);
  useEffect(() => { setPrograms(initialPrograms); }, [initialPrograms]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const boardsSeeded = programs.filter((p) => p.notes && boards.some((b) => b.board_id === p.notes)).length;
  const boardsTotal  = boards.length;
  const noBoards     = boardsTotal === 0;
  const needsSeeding = boardsSeeded < boardsTotal;

  async function syncBoards() {
    setBusy('sync'); setStatus(null);
    const res = await fetch('/api/marketing/social/sync-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId, platforms: ['pinterest'] }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || !j.ok) {
      setStatus(`Sync error: ${j.error ?? 'unknown'} — fix Upload Post API key in vault first.`);
    } else {
      setStatus('✓ Boards synced from Pinterest');
      startTransition(() => router.refresh());
    }
  }

  async function seedPrograms() {
    setBusy('seed'); setStatus(null);
    const res = await fetch('/api/marketing/social/seed-pinterest-programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || !j.ok) {
      setStatus(`Seed error: ${j.error ?? 'unknown'}`);
    } else {
      setStatus(`✓ Seeded ${j.seeded} board program${j.seeded !== 1 ? 's' : ''} (${j.existing} already existed)`);
      startTransition(() => router.refresh());
    }
  }

  async function generatePlan() {
    setBusy('plan'); setStatus(null);
    const start = ymd(new Date());
    const end   = ymd(new Date(Date.now() + 28 * 86400000));
    const res = await fetch('/api/marketing/social/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId, start_date: start, end_date: end, regenerate_empty_only: true, platform: 'pinterest' }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || !j.ok) {
      setStatus(`Generate error: ${j.error ?? j.errors?.[0] ?? 'unknown'}`);
    } else {
      setStatus(`✓ Created ${j.created} slots (${j.skipped} skipped) for ${start} → ${end}`);
      startTransition(() => router.refresh());
    }
  }

  const isError = (s: string | null) => s?.startsWith('Sync error') || s?.startsWith('Seed error') || s?.startsWith('Generate error');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: INK_M }}>
          {noBoards
            ? 'No boards synced yet — click Sync to pull from Pinterest (requires valid Upload Post API key)'
            : `${boardsTotal} boards · ${boardsSeeded} seeded as programs · drives the content calendar`}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={syncBoards} disabled={busy !== null}
            style={{ ...btnSm, background: WHITE, color: INK_S, border: `1px solid ${HAIR}`, opacity: busy ? 0.6 : 1 }}>
            {busy === 'sync' ? 'Syncing…' : '↻ Sync boards'}
          </button>
          {!noBoards && needsSeeding && (
            <button onClick={seedPrograms} disabled={busy !== null}
              style={{ ...btnSm, background: CREAM, color: FOREST, border: `1px solid ${FOREST}`, opacity: busy ? 0.6 : 1 }}>
              {busy === 'seed' ? 'Seeding…' : `Seed ${boardsTotal - boardsSeeded} program${(boardsTotal - boardsSeeded) !== 1 ? 's' : ''} →`}
            </button>
          )}
          <button onClick={generatePlan} disabled={busy !== null || programs.length === 0}
            style={{ ...btnSm, background: FOREST, color: WHITE, opacity: (busy !== null || programs.length === 0) ? 0.5 : 1 }}>
            {busy === 'plan' ? 'Generating…' : 'Generate plan +28d'}
          </button>
        </div>
      </div>

      {status && (
        <div style={{ marginBottom: 10, fontSize: 12, padding: '6px 8px', borderRadius: 4,
          color: isError(status) ? RED : FOREST,
          background: isError(status) ? '#FFF5F2' : CREAM,
          border: `1px solid ${isError(status) ? RED : FOREST}` }}>
          {status}
        </div>
      )}

      {/* Step guide when no boards */}
      {noBoards && (
        <div style={{ fontSize: 12, color: INK_M, padding: '10px 12px', background: CREAM, borderRadius: 4, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>Setup steps:</strong>
          <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            <li>Fix the Upload Post API key in Supabase vault → <code>UPDATE vault.secrets SET secret='NEW_KEY' WHERE name='upload_post'</code></li>
            <li>Click <strong>↻ Sync boards</strong> to pull your Pinterest boards</li>
            <li>Click <strong>Seed programs</strong> to create one content program per board</li>
            <li>Click <strong>Generate plan +28d</strong> to fill the calendar</li>
          </ol>
        </div>
      )}

      {/* Boards table */}
      {boards.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
              <th style={thSt}>Board</th>
              <th style={{ ...thSt, textAlign: 'right' }}>Pins</th>
              <th style={thSt}>Program</th>
              <th style={thSt}>Days</th>
            </tr>
          </thead>
          <tbody>
            {boards.map((b) => {
              const prog = programs.find((p) => p.notes === b.board_id);
              return (
                <tr key={b.board_id} style={{ borderBottom: `1px solid ${HAIR}` }}>
                  <td style={tdSt}>
                    <div style={{ fontWeight: 500 }}>{b.board_name ?? b.board_id}</div>
                    <div style={{ fontSize: 10, color: INK_M, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      {b.board_id.slice(0, 12)}…
                    </div>
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right', color: INK_M }}>{b.pin_count ?? '—'}</td>
                  <td style={tdSt}>
                    {prog
                      ? <span style={{ fontSize: 11, padding: '2px 6px', background: '#E8F2EE', color: FOREST, borderRadius: 3 }}>seeded ✓</span>
                      : <span style={{ fontSize: 11, color: AMBER }}>not seeded</span>}
                  </td>
                  <td style={tdSt}>
                    {prog ? (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {WEEKDAY.map((wd, i) => {
                          const on = (prog.weekday_slots ?? []).includes(i + 1);
                          return (
                            <span key={wd} style={{
                              fontSize: 10, padding: '1px 4px', borderRadius: 2,
                              background: on ? FOREST : HAIR,
                              color: on ? WHITE : INK_M,
                            }}>{wd}</span>
                          );
                        })}
                      </div>
                    ) : <span style={{ color: INK_M, fontSize: 11 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {isPending && <div style={{ fontSize: 11, color: AMBER }}>Refreshing data…</div>}

      <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
        Default schedule: Mon · Wed · Fri (3 pins/week/board). Edit individual programs on the Social Calendar page.
      </div>
    </div>
  );
}

const thSt: React.CSSProperties = { textAlign: 'left', padding: '8px 6px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M, fontWeight: 600 };
const tdSt: React.CSSProperties = { padding: '8px 6px', color: INK, verticalAlign: 'middle' };
const btnSm: React.CSSProperties = { padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer' };
