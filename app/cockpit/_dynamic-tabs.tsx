'use client';

/**
 * ticket #233 — Perf marathon: code-split heavy tab components in /cockpit
 *
 * Exports next/dynamic versions of every non-default cockpit tab so the
 * main page.tsx can switch to these imports one-by-one without a full
 * rewrite.  Each component is loaded only when its tab becomes active,
 * cutting the initial JS bundle delivered to the browser.
 *
 * Usage in page.tsx (replace static imports):
 *
 *   // BEFORE (eager, bundled into initial chunk)
 *   import CockpitActivityTab  from './_tabs/ActivityTab';
 *
 *   // AFTER (lazy, split into its own chunk)
 *   import { DynamicActivityTab as CockpitActivityTab } from './_dynamic-tabs';
 *
 * Tabs kept eager (default-open, so no benefit from splitting):
 *   - Overview / Dashboard tab  →  keep as static import in page.tsx
 *
 * Tabs code-split here (not visible on first paint):
 *   - Activity, Logs, Schedule, Cost, Tools
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// ---------------------------------------------------------------------------
// Loading placeholder — lightweight spinner shown while the chunk downloads
// ---------------------------------------------------------------------------
function TabSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        color: '#6b7280',
        fontSize: 14,
      }}
      aria-busy="true"
      aria-label="Loading tab…"
    >
      Loading…
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper — creates a next/dynamic import with shared defaults
// ---------------------------------------------------------------------------
function lazyTab<T extends object>(
  loader: () => Promise<{ default: ComponentType<T> }>
): ComponentType<T> {
  return dynamic<T>(loader, {
    ssr: false,
    loading: TabSkeleton,
  });
}

// ---------------------------------------------------------------------------
// Dynamic tab exports
// Adjust the import paths if your project uses a different directory.
// The page.tsx file should already have static imports for these; just swap
// the import source to this file.
// ---------------------------------------------------------------------------

/**
 * Activity tab — user/agent action feed; typically large list rendering.
 * Resolves: app/cockpit/_tabs/ActivityTab.tsx  (adjust path as needed)
 */
export const DynamicActivityTab = lazyTab(
  () => import('./_tabs/ActivityTab')
);

/**
 * Logs tab — audit/event log, can have 1k+ rows; heavy render cost.
 * Resolves: app/cockpit/_tabs/LogsTab.tsx
 */
export const DynamicLogsTab = lazyTab(
  () => import('./_tabs/LogsTab')
);

/**
 * Schedule tab — calendar / task scheduler; often pulls in date-fns / calendar libs.
 * Resolves: app/cockpit/_tabs/ScheduleTab.tsx
 */
export const DynamicScheduleTab = lazyTab(
  () => import('./_tabs/ScheduleTab')
);

/**
 * Cost tab — financial data, may include heavy chart imports (Recharts etc.).
 * Resolves: app/cockpit/_tabs/CostTab.tsx
 */
export const DynamicCostTab = lazyTab(
  () => import('./_tabs/CostTab')
);

/**
 * Tools tab — admin utilities; rarely visited so ideal for splitting.
 * Resolves: app/cockpit/_tabs/ToolsTab.tsx
 */
export const DynamicToolsTab = lazyTab(
  () => import('./_tabs/ToolsTab')
);
