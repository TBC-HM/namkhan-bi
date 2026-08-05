// app/holding/it2/modules/queue/page.tsx
// PBS 2026-08-04 (modules-queue-eta-v1) — THE work queue: every pending brief +
// bug in real pick order, with ETAs computed from OBSERVED 24h throughput
// (public.v_queue_eta_model) — never a hardcoded rate — plus an expected-delivery
// column with an honest confidence range and a per-row "build now" dispatch CTA.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

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
  content_len: number | null;
  queue_position: number;
};

type EtaModel = {
  briefs_started_24h: number;
  briefs_advanced_24h: number;
  bugs_closed_24h: number;
  dur_samples_7d: number;
  build_p50_min: number | null;
  build_p90_min: number | null;
  build_p50_min_small: number | null;
  build_p90_min_small: number | null;
  build_p50_min_large: number | null;
  build_p90_min_large: number | null;
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
  const { data, error } = await (sb as any).rpc('fn_set_work_priority', { p_kind: kind, p_ref: ref, p_priority: next });
  if (error) {
    redirect(`/holding/it2/modules/queue?err=${encodeURIComponent(error.message ?? 'Priority change failed')}`);
  }
  revalidatePath('/holding/it2/modules/queue');
}

async function dispatchNow(formData: FormData) {
  'use server';
  const kind = String(formData.get('kind') ?? '');
  const ref = String(formData.get('ref') ?? '');
  if (!kind || !ref) return;
  const sb = getSupabaseAdmin();
  // writes governance.owner_action_signals (kind=dispatch_requested) + priority=1
  const { data, error } = await (sb as any).rpc('fn_queue_dispatch_now', { p_kind: kind, p_ref: ref, p_actor: 'pbs' });
  if (error) {
    redirect(`/holding/it2/modules/queue?err=${encodeURIComponent(error.message ?? 'Dispatch failed')}`);
  }
  // check for function-level {ok:false} returns
  if (data && typeof data === 'object' && data.ok === false) {
    redirect(`/holding/it2/modules/queue?err=${encodeURIComponent(data.error ?? 'Dispatch rejected')}`);
  }
  revalidatePath('/holding/it2/modules/queue');
}

// ---------- deterministic UTC formatting (hydration-safe by construction) ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtUTC(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${hh}:${mm}Z`;
}

function num(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// Duration estimate (minutes) for a brief by size class, observed over last 7d.
// Falls back to the all-sizes percentile when the class has no samples.
function durationRange(m: EtaModel, contentLen: number | null): { p50: number; p90: number } | null {
  const small = contentLen !== null && contentLen < 15000;
  const p50 = num(small ? m.build_p50_min_small : m.build_p50_min_large) ?? num(m.build_p50_min);
  const p90 = num(small ? m.build_p90_min_small : m.build_p90_min_large) ?? num(m.build_p90_min);
  if (p50 === null || p90 === null) return null;
  return { p50, p90 };
}

type Eta = { start: string; delivery: string };

// Observed-throughput ETA model (A1/A2): expected start = position ÷ observed
// 24h pick rate; expected delivery = start + observed claim→verifying duration
// for the brief's size class. Wide variance (p90 ≥ 2×p50) → show a range,
// never a fake-precise timestamp.
function computeEta(row: QueueRow, briefAhead: number, bugAhead: number, m: EtaModel, now: Date): Eta {
  if (row.status === 'needs_input') {
    return { start: 'blocked — answer the question first', delivery: '—' };
  }
  if (row.owner_loop.includes('battery')) {
    return { start: 'tonight 20:30Z (battery)', delivery: 'after battery run' };
  }

  if (row.kind === 'brief') {
    const dur = durationRange(m, row.content_len);
    const wide = dur !== null && dur.p90 >= 2 * dur.p50;

    const deliveryFrom = (startMs: number): string => {
      if (!dur) return 'no duration data yet (7d)';
      const lo = new Date(startMs + dur.p50 * 60000);
      const hi = new Date(startMs + dur.p90 * 60000);
      return wide ? `${fmtUTC(lo)} – ${fmtUTC(hi)}` : `${fmtUTC(lo)} ±${Math.round((dur.p90 - dur.p50) / 60)}h`;
    };

    if (row.status === 'in_progress') {
      const claimedAt = row.last_updated_at ? new Date(row.last_updated_at).getTime() : now.getTime();
      if (dur && claimedAt + dur.p90 * 60000 < now.getTime()) {
        return { start: 'running now', delivery: 'past the 7d p90 norm — check /holding/it2/system/live' };
      }
      return { start: 'running now', delivery: deliveryFrom(claimedAt) };
    }
    if (row.status === 'verifying') {
      return { start: 'with verifier — next sweep :56', delivery: 'this hour if A-criteria pass' };
    }
    if (row.status === 'research') {
      return { start: 'spec-runner — next sweep :56', delivery: 'after intake completes' };
    }
    // ready: position ÷ observed pick rate (picks of last 24h, parallel fleet)
    const picks24h = num(m.briefs_started_24h) ?? 0;
    if (picks24h === 0) {
      return { start: 'no picks observed in 24h — next sweep or ▶', delivery: dur ? deliveryFrom(now.getTime()) : '—' };
    }
    const startHours = (briefAhead + 1) / (picks24h / 24);
    const startAt = new Date(now.getTime() + startHours * 3600000);
    return {
      start: `~${fmtUTC(startAt)} (pos ${briefAhead + 1} · ${picks24h} picks/24h)`,
      delivery: deliveryFrom(startAt.getTime()),
    };
  }

  // bug: observed close rate over last 24h
  const closes24h = num(m.bugs_closed_24h) ?? 0;
  if (closes24h === 0) {
    return { start: '0 closes in 24h — press ▶ or fire the drain', delivery: 'at drain run' };
  }
  const hours = (bugAhead + 1) / (closes24h / 24);
  return { start: `~${fmtUTC(new Date(now.getTime() + hours * 3600000))} (${closes24h} closes/24h)`, delivery: 'at drain run' };
}

const KIND_TONE: Record<string, { bg: string; fg: string }> = {
  brief: { bg: '#E3F2FD', fg: '#1565C0' },
  bug:   { bg: '#FDECE4', fg: '#B04A2F' },
};

export default async function QueuePage({ searchParams }: { searchParams: { err?: string } }) {
  const sb = getSupabaseAdmin();
  const [{ data }, { data: modelRows }] = await Promise.all([
    (sb as any).from('v_work_queue').select('*').order('queue_position'),
    (sb as any).from('v_queue_eta_model').select('*'),
  ]);
  const rows = (data ?? []) as QueueRow[];
  const model = ((modelRows ?? [])[0] ?? {
    briefs_started_24h: 0, briefs_advanced_24h: 0, bugs_closed_24h: 0, dur_samples_7d: 0,
    build_p50_min: null, build_p90_min: null, build_p50_min_small: null, build_p90_min_small: null,
    build_p50_min_large: null, build_p90_min_large: null,
  }) as EtaModel;
  const now = new Date();

  // Per-loop ahead-counters feed the observed-throughput ETA
  let briefsSeen = 0, bugsSeen = 0;
  const enriched = rows.map((r) => {
    const eta = computeEta(r, briefsSeen, bugsSeen, model, now);
    if (r.kind === 'brief' && r.status === 'ready') briefsSeen += 1;
    if (r.kind === 'bug' && !r.owner_loop.includes('battery')) bugsSeen += 1;
    return { ...r, eta };
  });

  const picks = num(model.briefs_started_24h) ?? 0;
  const advances = num(model.briefs_advanced_24h) ?? 0;
  const samples = num(model.dur_samples_7d) ?? 0;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, color: TOKENS.ink }}>
      {searchParams.err && (
        <div style={{ background: '#FEE', border: '1px solid #C33', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#933' }}>
          <strong>Action failed:</strong> {searchParams.err}
        </div>
      )}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Work Queue ({rows.length})</div>
        <p style={{ fontSize: 12, color: TOKENS.text2, margin: '4px 0 0' }}>
          Every pending brief and bug, in real pick order. Work runs in PARALLEL, not one-per-hour:
          unstick-sweep hourly :56 (1 build + 1 verify per pass) · signal-responder on owner actions ·
          CCR single-task fires · orchestrator fleets. ⬆ moves an item sooner (lower number first);
          ▶ dispatches it to the front of the very next cycle.
        </p>
        <p style={{ fontSize: 11, color: TOKENS.text3, margin: '4px 0 0', fontFamily: MONO }}>
          ETA model — observed, not assumed: {picks} picks + {advances} briefs advanced in the last 24h ·
          delivery from {samples} measured claim→verify runs (7d). Wide variance shows a range, never fake precision.
        </p>
      </div>
      <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.bg }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>#</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500, width: '32%' }}>Item</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Status</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Which loop</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Expected start</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Expected delivery</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Priority</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((r) => {
              const kt = KIND_TONE[r.kind];
              const href = r.kind === 'brief' ? `/holding/it2/modules/briefs/${r.ref}` : '/holding/bugs';
              const dispatchable = r.kind === 'bug' || ['ready', 'research', 'needs_input'].includes(r.status);
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
                  <td style={{ padding: '8px 10px', fontSize: 11, color: TOKENS.text2 }}>{r.eta.start}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: MONO, color: TOKENS.text2 }}>{r.eta.delivery}</td>
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
                    {dispatchable && (
                      <form action={dispatchNow} style={{ display: 'inline', margin: 0 }}>
                        <input type="hidden" name="kind" value={r.kind} />
                        <input type="hidden" name="ref" value={r.ref} />
                        <button type="submit" title="Build now — signals the next cycle to pick this first" style={{
                          border: `1px solid ${TOKENS.forest}`, background: TOKENS.forest, borderRadius: 4,
                          padding: '2px 8px', fontSize: 10, cursor: 'pointer', color: '#fff', fontWeight: 700,
                        }}>▶ build now</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {enriched.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: TOKENS.text2 }}>Queue empty — everything shipped.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}