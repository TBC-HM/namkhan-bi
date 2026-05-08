'use client';
/**
 * _dynamic-tabs.tsx
 * Ticket #233 — Code-split heavy tab components in /cockpit
 *
 * Wraps the five non-default tabs (Activity, Logs, Schedule, Cost, Tools)
 * with next/dynamic + ssr:false so their JS is NOT included in the initial
 * page bundle. The default tab (Overview/Pulse) remains a static import.
 *
 * Usage: import these in place of the raw tab components inside page.tsx
 * or any CockpitTabs client component.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/** Shared loading placeholder — tiny, renders instantly */
function TabSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 240,
        color: '#888',
        fontSize: 14,
        letterSpacing: '0.02em',
      }}
    >
      Loading…
    </div>
  );
}

/* ─────────────────────────────────────────────
   Activity tab  (heavy: renders full audit log)
   ───────────────────────────────────────────── */
export const DynamicActivityTab: ComponentType<Record<string, unknown>> =
  dynamic(
    () =>
      import('@/components/cockpit/ActivityTab').then(
        (m) => m.default ?? m.ActivityTab ?? m,
      ) as Promise<ComponentType<Record<string, unknown>>>,
    { ssr: false, loading: TabSkeleton },
  );

/* ─────────────────────────────────────────────
   Logs tab  (heavy: virtualized log list)
   ───────────────────────────────────────────── */
export const DynamicLogsTab: ComponentType<Record<string, unknown>> =
  dynamic(
    () =>
      import('@/components/cockpit/LogsTab').then(
        (m) => m.default ?? m.LogsTab ?? m,
      ) as Promise<ComponentType<Record<string, unknown>>>,
    { ssr: false, loading: TabSkeleton },
  );

/* ─────────────────────────────────────────────
   Schedule tab  (heavy: calendar / Recharts)
   ───────────────────────────────────────────── */
export const DynamicScheduleTab: ComponentType<Record<string, unknown>> =
  dynamic(
    () =>
      import('@/components/cockpit/ScheduleTab').then(
        (m) => m.default ?? m.ScheduleTab ?? m,
      ) as Promise<ComponentType<Record<string, unknown>>>,
    { ssr: false, loading: TabSkeleton },
  );

/* ─────────────────────────────────────────────
   Cost tab  (heavy: finance charts / tables)
   ───────────────────────────────────────────── */
export const DynamicCostTab: ComponentType<Record<string, unknown>> =
  dynamic(
    () =>
      import('@/components/cockpit/CostTab').then(
        (m) => m.default ?? m.CostTab ?? m,
      ) as Promise<ComponentType<Record<string, unknown>>>,
    { ssr: false, loading: TabSkeleton },
  );

/* ─────────────────────────────────────────────
   Tools tab  (heavy: admin actions / rich forms)
   ───────────────────────────────────────────── */
export const DynamicToolsTab: ComponentType<Record<string, unknown>> =
  dynamic(
    () =>
      import('@/components/cockpit/ToolsTab').then(
        (m) => m.default ?? m.ToolsTab ?? m,
      ) as Promise<ComponentType<Record<string, unknown>>>,
    { ssr: false, loading: TabSkeleton },
  );
