// lib/schedule/catalog.ts
// Scheduler Console (brief ops-scheduler-console-v1, goal 47).
// Single source for: CCR standing agents (read-only rows), business-group
// classification of every scheduled loop, and the kill-switch tier lists.
//
// TIERS (R1 verdict in the brief — mirrored in public.fn_automation_set):
//   SAFETY — never stopped by any kill preset (backups, alarms, audits, prune).
//   INGEST — data syncs & refreshes; survive preset 'agents', stopped by
//            preset 'everything' (with the stale-dashboards warning).
//   ACT    — agents, outbound, content pipelines; stopped by BOTH presets.
//            Unlisted/new jobs default to ACT (safe direction: new agent
//            loops get killed; add new ingest jobs to INGEST_JOBS on create).
// KEEP THE LISTS IN SYNC with fn_automation_set (migration
// fn_automation_set_scoped) — the DB function is the enforcement, this file
// is the UI preview.

export type ScheduleSystem = 'pg_cron' | 'vercel' | 'ccr';
export type KillTier = 'ACT' | 'INGEST' | 'SAFETY';

// ── CCR standing agents (Claude Code Remote account layer — the app cannot
//    read it; verified live 2026-07-27, brief §0.R R3: 4 standing agents). ──
export const CCR_AGENTS: {
  name: string; schedule: string; what: string; paused?: boolean;
}[] = [
  { name: 'spec-pipeline-runner', schedule: '45 * * * *', what: 'intake, research, verify stages of the standing spec pipeline' },
  { name: 'module-builder', schedule: '15 * * * *', what: 'builds ONE ready brief per tick' },
  { name: 'module-completion-auditor', schedule: '10 */2 * * *', what: 'independent drift sweep over module completion', paused: true },
  { name: 'platform-architect-gap-review', schedule: '0 1 * * 1', what: 'weekly architecture gap review' },
];

export const CCR_READONLY_NOTE =
  'Runs on Claude Code Remote — change it via the standing agent schedule (scheduled tasks), not here.';
export const VERCEL_READONLY_NOTE =
  'Defined in vercel.json in the repo — change the cadence there and redeploy.';

// ── Kill tiers ────────────────────────────────────────────────────────────
export const SAFETY_JOBS: string[] = [
  // regrown 2026-08-25 (round 3): 49 jobs, classified live from the 172-job cron.job
  // population — mirrors migration scheduler_tiers_regrow_and_actor_default_20260825.
  'ai-usage-staleness-alarm', 'alarms-sweep-15min', 'auto-purge-email-suppressions-15m',
  'backup_verify_daily', 'builder-heartbeat-reap-5min', 'canon-lint-sweep-weekly',
  'cleanup-vercel-noise', 'cockpit-deploy-health-hourly', 'cockpit_change_log_prune_daily',
  'commercial-assurance-daily', 'cost_burn_alarm', 'daily_advisor_snapshot',
  'daily_ops_brief_placeholder', 'doc-drift-audit-daily', 'doc-lint-daily',
  'docs-daily-backup', 'docs_expiry_alerts', 'dq-run-hourly',
  'efficiency-band-check-hourly', 'email-retention-purge-12mo-daily', 'feed-freshness-check-daily',
  'forecast-test-harness', 'gbp-allowlist-watch', 'gh-commit-audit-15min',
  'health-sweep-6h', 'it_window_v2_emergency_rules', 'job-outcome-collector-2min',
  'kpi-conformance-battery-nightly', 'kpi-freshness-check', 'lighthouse-data-retention-purge',
  'lighthouse-test-harness-daily', 'memory-lint-weekly', 'module-page-probe-settle',
  'module-page-probe-sweep', 'monetization-test-harness', 'monthly_close_placeholder',
  'nd-notifications-cleanup', 'parity-check-daily', 'probe-data-integrations-daily',
  'prospects-bounce-cleanup', 'provider-error-autotrip-5min', 'push-ledger-reconcile',
  'push-verify-5min', 'releases-cockpit-test-harness', 'repair-drift-check-daily',
  'runaway-guard-5min', 'security-anon-scan-4h', 'spend-guard-5min',
  'yt-token-refresh-30min',
];

export const INGEST_JOBS: string[] = [
  // regrown 2026-08-25 (round 3): 56 jobs — mirrors the same migration.
  'arrivals-board-refresh-daily', 'brain-governance-projection-hourly', 'capture-otb-snapshot-daily',
  'cb-sync-full-3h', 'cb-sync-rates-catalog-3h', 'cb-sync-reservations-30min',
  'cb-sync-transactions-30min', 'classify-cb-transactions-30min', 'container-intake-scan-3min-bulk',
  'costs-ingest-hourly', 'derive-extras-3h', 'docs-embed-refresh',
  'factorial_drain_document_files', 'factorial_drain_responses', 'factorial_poll_compensations',
  'factorial_poll_contracts', 'factorial_poll_employees', 'factorial_poll_leaves',
  'factorial_poll_planned_shifts', 'factorial_poll_policy_assignments', 'factorial_poll_shifts',
  'factorial_poll_supplements', 'ga4-daily-sync', 'gbp-daily-pull',
  'gsc-daily-sync', 'icp-weekly-snapshot', 'ingest-lighthouse-mails-daily',
  'ingest-qb-weekly', 'intake-container-scan-5min', 'inv-spa-deduct-daily',
  'kpi-daily-snapshot', 'memory-embed-refresh', 'module-testing-refresh-hourly',
  'parse_payslips_inbox', 'phase_1_3_kb_embed_refresh', 'proposals-expire-daily',
  'rate-action-journal-daily', 'rate-action-outcome-daily', 'recompute-daily-metrics-30min',
  'refresh-bi-views-hot', 'refresh-bi-views-warm', 'refresh-channel-economics-10min',
  'refresh-everyone-group-6h', 'refresh-gl-mv-usali-pl-monthly', 'refresh-guest-dmc-groups-6h',
  'refresh-guest-profile', 'refresh-mv-classified-transactions-hourly', 'refresh_v_leakage_action_pointers',
  'render-tenant-knowledge-nightly', 'sales-gmail-poll-15min', 'scheduled-work-refresh-6h',
  'social-analytics-pull-daily', 'social-followers-sync', 'university-refresh-nightly',
  'up-sync-analytics-daily', 'yt-analytics-pull-daily',
];

export function tierOf(jobname: string): KillTier {
  if (SAFETY_JOBS.includes(jobname)) return 'SAFETY';
  if (INGEST_JOBS.includes(jobname)) return 'INGEST';
  return 'ACT';
}

// ── Business groups (9) — display grouping, independent of kill tier. ─────
export type GroupDef = { key: string; label: string; what: string };

export const GROUPS: GroupDef[] = [
  { key: 'bookings', label: 'Bookings & PMS sync', what: 'Pulls reservations, rates and transactions from Cloudbeds. If stopped, availability and booking data go stale.' },
  { key: 'revenue', label: 'Revenue & forecasting', what: 'Daily revenue reports, forecasts, pace and KPI refreshes. If stopped, dashboards show yesterday’s truth.' },
  { key: 'finance', label: 'Finance & accounting', what: 'QuickBooks ingest, P&L refreshes, month-end placeholders.' },
  { key: 'marketing', label: 'Marketing & content', what: 'Newsletters, media rendering, YouTube and reviews pipelines. If stopped, nothing is sent or published.' },
  { key: 'sales', label: 'Sales & prospects', what: 'Prospect outreach batches, enrollment advances, mailbox scans.' },
  { key: 'people', label: 'People & HR', what: 'Factorial polling (shifts, leaves, contracts) and payslip parsing.' },
  { key: 'guest', label: 'Guest data quality', what: 'Guest profile repairs and refreshes (names, phones, DMC groups).' },
  { key: 'agents', label: 'Agents & build pipeline', what: 'Bug agents, brief pipeline, brain, documentarian and the standing CCR agents.' },
  { key: 'platform', label: 'Platform health & safety', what: 'Backups, audits, alarms, cleanups. NEVER stopped by the kill switch.' },
];

const GROUP_RULES: [RegExp, string][] = [
  [/^(cb-sync|capture-otb|derive-extras|classify-cb-transactions|recompute-daily-metrics)/, 'bookings'],
  [/^(revenue-report|forecast-daily|briefing_score|refresh-channel-economics|refresh-bi-views|refresh_v_leakage|kpi-daily-snapshot|\/api\/cron\/briefing-evaluate)/, 'revenue'],
  [/^(ingest-qb|ingest-lighthouse|refresh-gl-mv|monthly_close)/, 'finance'],
  [/^(media_|yt-|social-followers|reviews-scrape|scrape-reviews|enqueue-newsletter|send-newsletter|write-pending-drafts|\/api\/cron\/director-)/, 'marketing'],
  [/^(send-prospect|advance-prospect|gmail_)/, 'sales'],
  [/^(factorial_|parse_payslips)/, 'people'],
  [/^(agent_repair_|refresh-guest)/, 'guest'],
  [/^(bug_|bug-agent|brief-intake|documentarian|brain-|tile-sweep|module-testing|self-eval|autonomous-dept|it_window|release-scheduled|auto-complete-resolved|cockpit-daily-prompt|cockpit-weekly-cost|attention-daily|daily_ops_brief|docs-embed|memory-embed|phase_1_3_kb|spec-pipeline-runner|module-builder|module-completion-auditor|platform-architect|\/api\/cockpit\/(bugs\/sweep|agent\/run)|\/api\/cron\/bug-agent-index-refresh)/, 'agents'],
  [/^(backup_verify|docs-daily-backup|gh-commit-audit|cost_burn|kpi-freshness|kpi-conformance|parity-check|probe-data|daily_advisor|docs_expiry|cleanup-vercel|cockpit_change_log_prune|nd-notifications|auto-purge-email|prospects-bounce|cockpit-deploy-health)/, 'platform'],
];

export function groupOf(name: string): string {
  for (const [re, key] of GROUP_RULES) if (re.test(name)) return key;
  return 'agents';
}

// ── Cadence helpers ───────────────────────────────────────────────────────
export function cronPlain(c: string): string {
  const m = c.trim().split(/\s+/);
  if (m.length !== 5) return c;
  const [min, hour, dom, , dow] = m;
  if (min.startsWith('*/') && hour === '*') return `every ${min.slice(2)} min`;
  if (min === '*' && hour === '*') return 'every minute';
  if (min.includes(',') && hour === '*') return `hourly at :${min.split(',').map((x) => x.padStart(2, '0')).join(' :')}`;
  if (hour === '*' && min !== '*') return `hourly at :${min.padStart(2, '0')}`;
  if (hour.startsWith('*/')) return `every ${hour.slice(2)}h at :${min.padStart(2, '0')}`;
  if (dow !== '*' && !dow.includes('*')) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const d = days[Number(dow)] ?? `dow ${dow}`;
    return `weekly ${d} ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  }
  if (dom !== '*' && !dom.includes('*')) return `monthly day ${dom} ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  if (hour !== '*' && min !== '*') return `daily ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  return c;
}

// Approximate max interval between fires, in minutes (for late detection).
export function cronIntervalMinutes(c: string): number | null {
  const m = c.trim().split(/\s+/);
  if (m.length !== 5) return null;
  const [min, hour, dom, , dow] = m;
  if (dom !== '*' && !dom.includes('*')) return 31 * 24 * 60;
  if (dow !== '*' && !dow.includes('*')) return 7 * 24 * 60;
  if (min === '*' && hour === '*') return 1;
  if (min.startsWith('*/') && hour === '*') return Number(min.slice(2)) || null;
  if (min.includes(',') && hour === '*') return Math.round(60 / min.split(',').length);
  if (hour === '*') return 60;
  if (hour.startsWith('*/')) return (Number(hour.slice(2)) || 24) * 60;
  return 24 * 60;
}

// Fire hours (UTC, 0-23) for the pulse strip dots.
export function cronFireHours(c: string): number[] {
  const m = c.trim().split(/\s+/);
  if (m.length !== 5) return [];
  const hour = m[1];
  if (hour === '*') return Array.from({ length: 24 }, (_, i) => i);
  if (hour.startsWith('*/')) {
    const step = Number(hour.slice(2)) || 24;
    return Array.from({ length: 24 }, (_, i) => i).filter((h) => h % step === 0);
  }
  return hour.split(',').map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n < 24);
}
