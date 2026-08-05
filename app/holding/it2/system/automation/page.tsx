// app/holding/it2/system/automation/page.tsx
// ADR-230 §5 — THE KILL SWITCH, with a surface.
//
// PBS 2026-08-05: ~EUR430 + prior grants burned in hours by duplicate builder
// sessions (475 over 7 days) while costs.ai_usage_events recorded $2.23 and
// cost_burn_alarm watched a table the builders never wrote to. There was no
// global stop anywhere in the app — only a per-brief Pause. This page is that stop.
//
// Reads : public.v_automation_state, public.v_spend_today (bridge views, claude_md §0.5)
// Writes: public.fn_automation_set(), public.fn_spend_limits_set()
// Enforced by governance.fn_spend_guard() on cron spend-guard-5min — the dials below
// are real, not intentions.

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function setAutomationAction(formData: FormData) {
  'use server';
  const enabled = String(formData.get('enabled')) === 'true';
  const sb = getSupabaseAdmin();
  await (sb as any).rpc('fn_automation_set', { p_enabled: enabled, p_actor: 'PBS' });
  revalidatePath('/holding/it2/system/automation');
}

async function setLimitsAction(formData: FormData) {
  'use server';
  const num = (k: string, d: number) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v >= 0 ? v : d;
  };
  const sb = getSupabaseAdmin();
  await (sb as any).rpc('fn_spend_limits_set', {
    p_max_day: num('max_day', 400),
    p_warn_day: num('warn_day', 250),
    p_max_brief: num('max_brief', 40),
    p_max_module: num('max_module', 150),
    p_actor: 'PBS',
  });
  revalidatePath('/holding/it2/system/automation');
}

const card: React.CSSProperties = {
  background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`,
  borderRadius: 8, padding: '14px 16px',
};
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase' as const, color: TOKENS.text2,
};
const big: React.CSSProperties = { fontSize: 22, fontWeight: 700, fontFamily: MONO, margin: '2px 0', color: TOKENS.ink };
const input: React.CSSProperties = {
  width: 110, padding: '6px 8px', fontFamily: MONO, fontSize: 13,
  border: `1px solid ${TOKENS.border}`, borderRadius: 4, background: '#FFFFFF', color: TOKENS.ink,
};

export default async function AutomationPage() {
  const sb = getSupabaseAdmin();
  const [{ data: stateRows }, { data: spendRows }] = await Promise.all([
    (sb as any).from('v_automation_state').select('*').limit(1),
    (sb as any).from('v_spend_today').select('*').limit(1),
  ]);
  const s: any = stateRows?.[0] ?? {};
  const sp: any = spendRows?.[0] ?? {};

  const on = s.automation_enabled === true;
  const total = Number(sp.total_est_usd ?? 0);
  const maxDay = Number(sp.max_usd_per_day ?? s.max_usd_per_day ?? 400);
  const warnDay = Number(sp.warn_usd_per_day ?? s.warn_usd_per_day ?? 250);
  const pct = maxDay > 0 ? Math.min(100, Math.round((total / maxDay) * 100)) : 0;
  const tone = total >= maxDay ? '#B71C1C' : total >= warnDay ? '#B26A00' : '#2E7D32';

  return (
    <div style={{ maxWidth: 1000, color: TOKENS.ink }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 2px' }}>Automation &amp; spend control</h1>
      <p style={{ fontSize: 12, color: TOKENS.text2, margin: '0 0 20px' }}>
        The global stop. Every dispatcher and every builder checks this flag before it starts.
        Limits below are enforced by <code>fn_spend_guard()</code> every 5 minutes — over the daily
        ceiling it turns automation off by itself.
      </p>

      {/* ── MASTER SWITCH ─────────────────────────────────────────── */}
      <div style={{ ...card, borderColor: on ? '#2E7D3244' : '#B71C1C44', background: on ? '#E8F5E9' : '#FFEBEE', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={lbl}>Automation</div>
            <div style={{ ...big, color: on ? '#2E7D32' : '#B71C1C', fontSize: 26 }}>
              {on ? 'RUNNING' : 'STOPPED'}
            </div>
            <div style={{ fontSize: 11, color: TOKENS.text2, maxWidth: 620 }}>{s.last_note ?? '—'}</div>
          </div>
          <form action={setAutomationAction}>
            <input type="hidden" name="enabled" value={on ? 'false' : 'true'} />
            <button type="submit" style={{
              fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 5, cursor: 'pointer',
              border: 'none', color: '#FFFFFF', background: on ? '#B71C1C' : '#1F3A2E',
            }}>
              {on ? 'STOP EVERYTHING' : 'START AUTOMATION'}
            </button>
          </form>
        </div>
      </div>

      {/* ── TODAY ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 8 }}>
        <div style={card}>
          <div style={lbl}>Spend today (est.)</div>
          <div style={{ ...big, color: tone }}>${total.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: TOKENS.text2 }}>{pct}% of ${maxDay} ceiling</div>
        </div>
        <div style={card}>
          <div style={lbl}>Metered</div>
          <div style={big}>${Number(sp.metered_usd ?? 0).toFixed(2)}</div>
          <div style={{ fontSize: 11, color: TOKENS.text2 }}>costs.ai_usage_events</div>
        </div>
        <div style={card}>
          <div style={lbl}>Builder sessions</div>
          <div style={big}>{sp.builder_sessions ?? 0}</div>
          <div style={{ fontSize: 11, color: TOKENS.text2 }}>today · &gt;60s only</div>
        </div>
        <div style={card}>
          <div style={lbl}>Briefs ready</div>
          <div style={big}>{s.briefs_ready ?? 0}</div>
          <div style={{ fontSize: 11, color: TOKENS.text2 }}>waiting for a slot</div>
        </div>
        <div style={card}>
          <div style={lbl}>In progress</div>
          <div style={big}>{s.briefs_in_progress ?? 0}</div>
          <div style={{ fontSize: 11, color: TOKENS.text2 }}>claimed by a builder</div>
        </div>
        <div style={card}>
          <div style={lbl}>Verifying</div>
          <div style={{ ...big, color: Number(s.briefs_verifying ?? 0) > 5 ? '#B26A00' : TOKENS.ink }}>
            {s.briefs_verifying ?? 0}
          </div>
          <div style={{ fontSize: 11, color: TOKENS.text2 }}>awaiting a verifier</div>
        </div>
      </div>

      {/* burn bar */}
      <div style={{ height: 8, borderRadius: 4, background: TOKENS.border, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: tone }} />
      </div>

      {/* ── LIMITS ────────────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...lbl, marginBottom: 4 }}>Spend limits — enforced, not advisory</div>
        <p style={{ fontSize: 11, color: TOKENS.text2, margin: '0 0 12px', maxWidth: 720 }}>
          Day ceiling turns automation off automatically. Per-brief ceiling parks the brief at
          <code> needs_input</code> with a question instead of retrying it — that is the one that
          catches a single brief burning session after session without shipping.
        </p>
        <form action={setLimitsAction} style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>Max USD / day</span>
            <input style={input} type="number" step="1" min="0" name="max_day" defaultValue={maxDay} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>Warn USD / day</span>
            <input style={input} type="number" step="1" min="0" name="warn_day" defaultValue={warnDay} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>Max USD / brief</span>
            <input style={input} type="number" step="1" min="0" name="max_brief" defaultValue={Number(s.max_usd_per_brief ?? 40)} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>Max USD / module</span>
            <input style={input} type="number" step="1" min="0" name="max_module" defaultValue={Number(s.max_usd_per_module ?? 150)} />
          </label>
          <button type="submit" style={{
            fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 4, cursor: 'pointer',
            border: 'none', background: '#1F3A2E', color: '#FFFFFF',
          }}>Save limits</button>
        </form>
        <p style={{ fontSize: 10.5, color: TOKENS.text3, margin: '12px 0 0' }}>
          Estimate basis: ${Number(s.est_usd_per_session ?? 5)} per builder session, until
          cost-governance-v2 lands real <code>task_runs</code>. Auto-kill: {String(s.auto_kill ?? true)} ·
          active cron jobs: {s.active_cron_jobs ?? '—'} · limits saved {s.limits_updated_at ?? '—'}.
        </p>
      </div>
    </div>
  );
}
