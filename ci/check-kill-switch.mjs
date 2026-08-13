#!/usr/bin/env node
/**
 * ci/check-kill-switch.mjs — first-act kill-switch guard for scheduled
 * GitHub Actions workflows (brief cost-gov-findings-slice-kill-switch-coverage,
 * WORK step e, 2026-08-13).
 *
 * Contract (mirrors the pg_cron CASE gate and Vercel route guards):
 *   exit 0  → automation is ON: caller proceeds.
 *   exit 1  → STOP: automation is OFF, or the switch is UNREACHABLE.
 *             Fails CLOSED per brief ASSUMPTIONS ("no cheap way to read the
 *             switch → fail CLOSED (does nothing) rather than open").
 *
 * On STOP it logs a skipped-run record via the PostgREST bridge
 * public.fn_scheduled_run_skip_log (service_role only) so the run is visible
 * in governance.scheduled_run_skipped instead of vanishing.
 *
 * Usage in a workflow step (single line, first act of the token-spending step):
 *   node ci/check-kill-switch.mjs || { echo "kill-switch: stop"; exit 0; }
 *
 * ENV (already present in agent-runner.yml's Run agent step):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   KILL_SWITCH_IDENTIFIER (optional; defaults to GITHUB_WORKFLOW)
 *
 * No npm dependencies — global fetch (Node >= 18; runner uses Node 22).
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IDENTIFIER =
  process.env.KILL_SWITCH_IDENTIFIER ||
  process.env.GITHUB_WORKFLOW ||
  'unknown-gha-workflow';
const TIMEOUT_MS = 10_000;

function headers() {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
  };
}

async function rpc(fn, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${fn} HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function logSkip(reason, notes) {
  try {
    await rpc('fn_scheduled_run_skip_log', {
      p_scheduler: 'github_actions',
      p_identifier: IDENTIFIER,
      p_reason: reason,
      p_notes: notes ?? null,
    });
    console.log(`kill-switch: skipped-run logged (${reason})`);
  } catch (e) {
    // Logging failure must not flip the decision — still STOP.
    console.error(`kill-switch: could not log skipped run: ${e.message}`);
  }
}

(async () => {
  if (!URL_BASE || !KEY) {
    // No credentials → cannot read the switch → fail CLOSED.
    console.error('kill-switch: missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — failing CLOSED');
    process.exit(1);
  }
  try {
    const enabled = await rpc('fn_automation_enabled');
    if (enabled === true) {
      console.log('kill-switch: automation ON — proceed');
      process.exit(0);
    }
    console.log('kill-switch: automation OFF — stopping before any provider call');
    await logSkip('automation_disabled');
    process.exit(1);
  } catch (e) {
    console.error(`kill-switch: unreachable (${e.message}) — failing CLOSED`);
    await logSkip('kill_switch_unreachable', String(e.message).slice(0, 500));
    process.exit(1);
  }
})();
