// app/holding/it/cockpit/queue/page.tsx
// PBS 2026-07-27 — THE work queue: every pending brief + bug, in the exact
// order the loops will pick them, with owner-changeable priority and an
// honest expected-start estimate derived from each loop's real cadence.

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '../_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type QueueRow = {
  kind: 'brief' | 'bug';
  ref: string;
  title: string;
  status: string;
  priority: number;
  created_at: string;
  last_updated_at: string | null;
  owner_loop: string;
  queue_position: number;
};

async function setPriority(formData: FormData) {
  'use server';
  const kind = String(formData.get('kind') ?? '');
  const ref = String(formData.get('ref') ?? '');
  const dir = String(formData.get('dir') ?? '');
  const current = Number(formData.get('current') ?? 100);
  if (!kind || !ref) return;
  // bump: top = 1 (front of queue), up = -10, down = +10
  const next = dir === 'top' ? 1 : dir === 'up' ? Math.max(1, current - 10) : current + 10;
  const sb = getSupabaseAdmin();
  await (sb as any).rpc('fn_set_work_priority', { p_kind: kind, p_ref: ref, p_priority: next });
  revalidatePath('/holding/it/cockpit/queue');
}

// Honest ETA: builder pulls ONE ready brief per hourly tick (:15); bug drain
// processes up to 3 per hourly tick; battery runs nightly 20:30Z.
function expectedStart(row: QueueRow, briefAhead: number, bugAhead: number): string {
  if (row.status === 'needs_input') return 'blocked — answer the question first';
  if (row.owner_loop.includes('battery')) return 'tonight 20:30 UTC (battery)';
  if (row.kind === 'brief') {
    if (['research', 'in_progress', 'verifying'].includes(row.status)) return 'running now / next tick';
    const hours = briefAhead + 1; // one ready brief per builder tick
    return `~${hours}h (position ${briefAhead + 1} for the builder, 1/tick)`;
  }
  const ticks = Math.floor(bugAhead / 3) + 1; // up to 3 bugs per drain tick
  return `~${ticks}h (drain does 3/tick) · or fire now`;
}

const KIND_TONE: Record<string, { bg: string; fg: string }> = {
  brief: { bg: '#E3F2FD', fg: '#1565C0' },
  bug:   { bg: '#FDECE4', fg: '#B04A2F' },
};

export default async function QueuePage() {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('v_work_queue').select('*').order('queue_position');
  const rows = (data ?? []) as QueueRow[];

  // Per-loop ahead-counters for honest ETAs
  let briefsSeen = 0, bugsSeen = 0;
  const enriched = rows.map((r) => {
    const eta = expectedStart(r, briefsSeen, bugsSeen);
    if (r.kind === 'brief' && r.status === 'ready') briefsSeen += 1;
    if (r.kind === 'bug' && !r.owner_loop.includes('battery')) bugsSeen += 1;
    return { ...r, eta };
  });

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, color: TOKENS.ink }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Work Queue ({rows.length})</div>
        <p style={{ fontSize: 12, color: TOKENS.text2, margin: '4px 0 0' }}>
          Every pending brief and bug, in real pick order. ⬆ moves it sooner — the loops obey priority (lower number first), then age.
          Loops: builder hourly :15 (1 brief/tick) · runner+verifier hourly :45 · bug drain hourly (3/tick, or fire) · battery nightly 20:30Z.
        </p>
      </div>
      <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.bg }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>#</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500, width: '38%' }}>Item</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Status</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Which loop</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Expected start</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Priority</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((r) => {
              const kt = KIND_TONE[r.kind];
              const href = r.kind === 'brief' ? `/holding/it/cockpit/briefs/${r.ref}` : '/holding/bugs';
              return (
                <tr key={`${r.kind}-${r.ref}`} style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                  <td style={{ padding: '8px 10px', fontFamily: MONO, color: TOKENS.text2 }}>{r.queue_position}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: kt.bg, color: kt.fg, marginRight: 6, textTransform: 'uppercase' }}>{r.kind}</span>
                    <a href={href} style={{ color: TOKENS.forest, textDecoration: 'none', fontWeight: 600 }}>{r.title}</a>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3, marginLeft: 6 }}>{r.kind === 'bug' ? `#${r.ref}` : r.ref}</span>
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: MONO, fontSize: 11, color: r.status === 'needs_input' ? 'var(--status-red)' : TOKENS.text2 }}>{r.status}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: TOKENS.text2 }}>{r.owner_loop}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: TOKENS.text2 }}>{r.eta}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: MONO, marginRight: 6 }}>{r.priority}</span>
                    {(['top', 'up', 'down'] as const).map((dir) => (
                      <form key={dir} action={setPriority} style={{ display: 'inline', margin: 0 }}>
                        <input type="hidden" name="kind" value={r.kind} />
                        <input type="hidden" name="ref" value={r.ref} />
                        <input type="hidden" name="dir" value={dir} />
                        <input type="hidden" name="current" value={r.priority} />
                        <button type="submit" title={dir === 'top' ? 'Front of queue' : dir === 'up' ? 'Sooner' : 'Later'} style={{
                          border: `1px solid ${TOKENS.border}`, background: TOKENS.bg, borderRadius: 4,
                          padding: '2px 7px', fontSize: 10, cursor: 'pointer', marginRight: 3, color: TOKENS.ink,
                        }}>{dir === 'top' ? '⏫' : dir === 'up' ? '⬆' : '⬇'}</button>
                      </form>
                    ))}
                  </td>
                </tr>
              );
            })}
            {enriched.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: TOKENS.text2 }}>Queue empty — everything shipped.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
