// app/holding/it2/fleet/_lib/pipelines.ts
// loops-audit-v1 slice 2 (2026-08-07) — THE NAMED LOOPS.
//
// Slice 1 shipped class counts ("37 batch loops") which you cannot act on:
// nowhere could you find the newsletter loop, the Cloudbeds sync, or the
// prospect chain by name. This file is the mapping from cron jobnames to the
// 19 real business pipelines they belong to.
//
// A cron job is a TRIGGER, not a loop. One pipeline is several cron jobs.
//
// Shared by /fleet/loops (cards) and /fleet/cron (?pipe= filter) so the two
// surfaces can never disagree about what a pipeline contains.

export type PipelineShape = 'chain' | 'loop' | 'hybrid';

export interface Pipeline {
  key: string;
  name: string;
  shape: PipelineShape;
  purpose: string;
  exitCondition: string;
  members: string[];
  warning?: string;
}

export const PIPELINES: Pipeline[] = [
  {
    key: 'cloudbeds',
    name: 'Cloudbeds sync, derive, classify',
    shape: 'hybrid',
    purpose: 'Pulls reservations, transactions and the rate catalogue from the Namkhan PMS, derives extras, classifies transactions.',
    exitCondition: 'rows written = rows the API reported for the window',
    members: ['cb-sync-reservations-30min', 'cb-sync-transactions-30min', 'cb-sync-full-3h', 'cb-sync-rates-catalog-3h', 'classify-cb-transactions-30min', 'derive-extras-3h', 'recompute-daily-metrics-30min', 'capture-otb-snapshot-daily'],
    warning: 'derive-extras has been 100% dead since the sync_watermarks PK changed. No completeness assertion anywhere in the chain.',
  },
  {
    key: 'factorial',
    name: 'Factorial HR ingestion',
    shape: 'hybrid',
    purpose: 'Polls shifts, leaves, employees, contracts and pay data from Factorial into a queue, then drains it.',
    exitCondition: 'queue depth flat or falling over the window',
    members: ['factorial_poll_shifts', 'factorial_poll_planned_shifts', 'factorial_poll_leaves', 'factorial_poll_employees', 'factorial_poll_contracts', 'factorial_poll_compensations', 'factorial_poll_supplements', 'factorial_poll_policy_assignments', 'factorial_drain_responses', 'parse_payslips_inbox'],
    warning: 'Textbook producer/consumer: 8 pollers feed one drain running every minute. Nothing measures queue depth.',
  },
  {
    key: 'newsletter',
    name: 'Newsletter send',
    shape: 'hybrid',
    purpose: 'Builds recipient groups, enqueues relative and group recipients, then sends in batches of 25 every minute.',
    exitCondition: 'pending recipients = 0 for the campaign',
    members: ['enqueue-newsletter-relative-recipients', 'send-newsletter-batch', 'newsletter-quality-sweep-nightly', 'auto-purge-email-suppressions-15m', 'refresh-guest-dmc-groups-6h', 'refresh-everyone-group-6h'],
    warning: 'send-newsletter-batch shows a 343-run deficit against a theoretical 10,080 — the same deficit as both media sweeps. Confirm no sends were dropped.',
  },
  {
    key: 'prospects',
    name: 'Prospect outreach',
    shape: 'chain',
    purpose: 'Advances prospect enrollments hourly and sends the resulting batch.',
    exitCondition: 'enqueued = sent + bounced',
    members: ['advance-prospect-enrollments', 'send-prospect-batch', 'prospects-bounce-cleanup'],
    warning: 'BROKEN CHAIN — the enroller is live and enqueuing hourly, the sender was disabled 06-Aug 21:49. The queue fills and never drains. Decide: re-enable the sender or stop the enroller.',
  },
  {
    key: 'media',
    name: 'Media polish and render',
    shape: 'loop',
    purpose: 'Polishes and renders media assets, two and four items per minute respectively.',
    exitCondition: 'unpolished = 0 and unrendered = 0',
    members: ['media_polish_sweep', 'media_render_sweep', 'yt-shotstack-reconcile-5min', 'studio-exports-hourly'],
    warning: 'Cron-paced batch loops with hard throughput ceilings (2,880 and 5,760 items/day). Caught-up and starved are indistinguishable.',
  },
  {
    key: 'youtube',
    name: 'YouTube analytics and scouting',
    shape: 'chain',
    purpose: 'Keeps the YouTube token alive, pulls analytics daily, scouts trends and competitors weekly.',
    exitCondition: 'token valid and last pull within 24h',
    members: ['yt-token-refresh-30min', 'yt-analytics-pull-daily', 'yt-trend-scout-weekly', 'yt-spy-weekly'],
    warning: 'Token refresh failure would be logged but not alarmed — the whole chain silently stops on an auth lapse.',
  },
  {
    key: 'forecast',
    name: 'Forecast engine',
    shape: 'hybrid',
    purpose: 'Daily forecast run, trigger checks, learning journal, commentary and scenario narration.',
    exitCondition: 'forecast written for today for both properties',
    members: ['forecast-daily-run', 'forecast-trigger-check', 'forecast-learning-journal', 'forecast-commentary-run', 'forecast-recommendation-sync', 'forecast-scenario-narrate', 'forecast-test-harness'],
    warning: 'Cleanest family on the platform — zero failures, and the only one with its own test harness. Use it as the reference pattern.',
  },
  {
    key: 'guest-repair',
    name: 'Guest data repair',
    shape: 'loop',
    purpose: 'Repairs malformed guest phones, names, name junk and name casing, 300 rows at a time.',
    exitCondition: 'malformed rows = 0',
    members: ['agent_repair_phones', 'agent_repair_names', 'agent_repair_name_junk', 'agent_repair_name_case', 'refresh-guest-profile'],
    warning: 'Four jobs x 288 runs/day, forever, on data that has almost certainly converged. THE best candidate on the platform for a real exit condition.',
  },
  {
    key: 'bi',
    name: 'BI / KPI refresh',
    shape: 'chain',
    purpose: 'Refreshes hot and warm BI views, channel economics, the classified-transactions MV, and the daily KPI snapshot.',
    exitCondition: 'every MV refreshed within its own cadence',
    members: ['refresh-bi-views-hot', 'refresh-bi-views-warm', 'refresh-channel-economics-10min', 'refresh-mv-classified-transactions-hourly', 'refresh_v_leakage_action_pointers', 'kpi-daily-snapshot', 'kpi-freshness-check', 'kpi-conformance-battery-nightly', 'dq-run-hourly'],
    warning: 'kpi-daily-snapshot and the hourly job both refresh mv_classified_transactions; only one raises the timeout. Same object, two owners.',
  },
  {
    key: 'docs',
    name: 'Docs, memory and backup',
    shape: 'chain',
    purpose: 'Embeds docs and agent memory, backs up documentation nightly, verifies the backup, wakes the documentarian.',
    exitCondition: 'a backup row exists dated today',
    members: ['docs-embed-refresh', 'memory-embed-refresh', 'docs-daily-backup', 'backup_verify_daily', 'documentarian-wake-daily', 'docs_expiry_alerts', 'self-eval-weekly'],
    warning: 'BACKUPS ARE NOT RUNNING and the verifier reported success through all four failed days. Highest-severity item on the platform.',
  },
  {
    key: 'governance',
    name: 'Spend and governance watchers',
    shape: 'loop',
    purpose: 'Guards spend, alarms on cost burn and stale AI usage, reconciles the push ledger, audits commits.',
    exitCondition: 'no unacknowledged breach older than one cadence',
    members: ['spend-guard-5min', 'cost_burn_alarm', 'ai-usage-staleness-alarm', 'alarms-sweep-15min', 'push-ledger-reconcile', 'gh-commit-audit-15min', 'builder-heartbeat-reap-5min', 'production-promotion-5min'],
    warning: 'gh-commit-audit parses an HTML error page as JSON on ~11% of runs. Post-incident controls from 05-Aug live here — verify they would actually fire.',
  },
  {
    key: 'gmail',
    name: 'Gmail intake and drafts',
    shape: 'hybrid',
    purpose: 'Processes the shared mailbox, scans replies, extracts contacts, writes pending drafts.',
    exitCondition: 'unprocessed messages = 0',
    members: ['gmail_extract_shared_process_2min', 'gmail_scan_replies_30min', 'gmail_contact_extract_nightly', 'sales-gmail-poll-15min', 'write-pending-drafts-2min'],
    warning: 'marketing.gmail_extract_jobs carries attempts and error columns but has no max_attempts — a permanently failing message retries forever.',
  },
  {
    key: 'reviews',
    name: 'Reviews, GBP and social',
    shape: 'chain',
    purpose: 'Scrapes OTA reviews, pulls Google Business Profile daily, syncs social followers.',
    exitCondition: 'review corpus current within one cadence',
    members: ['scrape-reviews-biweekly', 'reviews-scrape-weekly-sunday', 'gbp-daily-pull', 'gbp-allowlist-watch', 'social-followers-sync'],
    warning: 'TWO independent review scrapers on different schedules — an edge function every 14 days and a Vercel route every Sunday. Neither knows about the other. Pick one.',
  },
  {
    key: 'brain',
    name: 'Brain extract and classify',
    shape: 'loop',
    purpose: 'Extracts and classifies knowledge into the brain every 5 minutes, with a nightly battery.',
    exitCondition: 'unclassified items = 0',
    members: ['brain-extract-5min', 'brain-classify-5min', 'brain-battery-nightly'],
  },
  {
    key: 'finance',
    name: 'Finance ingestion (QuickBooks / costs)',
    shape: 'chain',
    purpose: 'Weekly QuickBooks GL ingestion, hourly cost ingestion, USALI P&L materialisation, revenue assurance.',
    exitCondition: 'GL period rows = source rows',
    members: ['ingest-qb-weekly', 'costs-ingest-hourly', 'refresh-gl-mv-usali-pl-monthly', 'commercial-assurance-daily', 'inv-spa-deduct-daily', 'ingest-lighthouse-mails-daily'],
    warning: 'ingest-qb-weekly runs once a week — a silent failure costs seven days before anyone could notice.',
  },
  {
    key: 'revenue-reports',
    name: 'Revenue reporting and parity',
    shape: 'chain',
    purpose: 'Daily, weekly and monthly revenue reports; rate-action outcome measurement; BDC rate parity checking.',
    exitCondition: 'report rendered and delivered for the cadence',
    members: ['revenue-report-daily-8am', 'revenue-report-weekly-mon', 'revenue-report-monthly-1st', 'rate-action-outcome-daily', 'parity-check-daily'],
    warning: 'parity-check-daily was dead for ~3 months — governance.agents was dropped on 11-May and seven functions were left pointing at it. Restored 07-Aug via a compatibility view.',
  },
  {
    key: 'health',
    name: 'Module and deploy health probes',
    shape: 'loop',
    purpose: 'Probes module pages, refreshes module testing state, sweeps deploy and integration health.',
    exitCondition: 'every module page returns 200 and every integration answered',
    members: ['module-page-probe-sweep', 'module-page-probe-settle', 'module-testing-refresh-hourly', 'health-sweep-6h', 'cockpit-deploy-health-hourly', 'probe-data-integrations-daily'],
    warning: 'health-sweep-6h did not catch any of the six dead jobs. Health currently means HTTP 200, not outcome freshness.',
  },
  {
    key: 'sales',
    name: 'Sales pipeline and ICP',
    shape: 'chain',
    purpose: 'Weekly ICP snapshot and draft proposals, daily proposal follow-up and expiry.',
    exitCondition: 'no proposal past its follow-up date unactioned',
    members: ['icp-weekly-snapshot', 'icp-weekly-proposals', 'sales-proposal-followup-daily', 'proposals-expire-daily', 'finding-to-brief-hourly', 'finding-close-on-ship-10min'],
  },
  {
    key: 'bug-selfheal',
    name: 'Bug self-heal',
    shape: 'loop',
    purpose: 'Triages incoming bugs, attempts self-healing patches, drains the agent queue.',
    exitCondition: 'open auto-fixable bugs = 0',
    members: ['bug_triage_sweep', 'bug_selfheal_sweep', 'bug-agent-drain-3h'],
    warning: 'ENTIRE FAMILY DISABLED since the 05-Aug spend incident (16:50). The bug-triage edge function is still deployed and reachable. Revive with exit tests and max_attempts, or delete.',
  },
];

// Departments — same taxonomy as Build -> Specs, so the owner navigates one
// mental model across the cockpit rather than learning a second one here.

export type Dept = 'revenue' | 'finance' | 'sales' | 'marketing' | 'ops' | 'guest' | 'it';

export const DEPTS: Array<{ key: Dept; label: string }> = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'finance', label: 'Finance' },
  { key: 'sales', label: 'Sales' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'ops', label: 'Ops' },
  { key: 'guest', label: 'Guest' },
  { key: 'it', label: 'IT / Platform' },
];

export const PIPELINE_DEPT: Record<string, Dept> = {
  cloudbeds: 'revenue',
  forecast: 'revenue',
  'revenue-reports': 'revenue',
  finance: 'finance',
  prospects: 'sales',
  sales: 'sales',
  gmail: 'sales',
  newsletter: 'marketing',
  media: 'marketing',
  youtube: 'marketing',
  reviews: 'marketing',
  factorial: 'ops',
  'guest-repair': 'guest',
  bi: 'it',
  docs: 'it',
  governance: 'it',
  brain: 'it',
  health: 'it',
  'bug-selfheal': 'it',
};

export function deptOf(pipelineKey: string): Dept {
  return PIPELINE_DEPT[pipelineKey] ?? 'it';
}

/** Which pipeline a jobname belongs to, or null if it is not mapped. */
export function pipelineOf(jobname: string): Pipeline | null {
  return PIPELINES.find((p) => p.members.includes(jobname)) ?? null;
}

export const SHAPE_LABEL: Record<PipelineShape, string> = {
  chain: 'CHAIN',
  loop: 'LOOP',
  hybrid: 'HYBRID',
};
