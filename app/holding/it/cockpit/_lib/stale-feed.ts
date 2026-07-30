// app/holding/it/cockpit/_lib/stale-feed.ts
// Stale-deploy-feed predicate (brief fix-deployments-ingestion, goal 47, A3).
// Pure function so the banner logic is unit-testable without rendering.
//
// The feed is STALE when BOTH hold:
//   1. the newest deploy row is older than `thresholdMs` (default 2h), and
//   2. at least one successful push in v_push_ledger is NEWER than that row
//      (pushes without deploys = the pipeline is producing deploys we can't see).
// No deploy rows at all + pushes exist → also stale (blind feed).
// No pushes newer than the last deploy → quiet repo, not a feed problem.

export const STALE_FEED_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export function isDeployFeedStale(
  newestDeployAt: string | null | undefined,
  newestPushAt: string | null | undefined,
  now: number = Date.now(),
  thresholdMs: number = STALE_FEED_THRESHOLD_MS,
): boolean {
  const pushT = newestPushAt ? new Date(newestPushAt).getTime() : NaN;
  if (!Number.isFinite(pushT)) return false; // no push signal → can't claim staleness

  const deployT = newestDeployAt ? new Date(newestDeployAt).getTime() : NaN;
  if (!Number.isFinite(deployT)) return true; // pushes exist, zero deploy rows → blind

  return now - deployT > thresholdMs && pushT > deployT;
}

export function staleFeedMessage(newestDeployAt: string | null | undefined): string {
  const last = newestDeployAt
    ? new Date(newestDeployAt).toISOString().slice(0, 16).replace('T', ' ') + 'Z'
    : 'never';
  return `Deploy feed stale — newest deploy row ${last}, but newer pushes exist. Showing last known data, not live state.`;
}
