// components/ModuleStateGate.tsx
// Wraps a module page. If the module is "planned" or "disabled" for the current
// property, shows a roadmap placeholder instead of the actual content.
// Used by the sidebar-linked module pages (Revenue, Marketing, F&B, etc.).

'use client';

import { useCurrentProperty } from '@/lib/property-context';
import type { ReactNode } from 'react';

type ModuleMeta = {
  title: string;
  description: string;
  roadmap: string; // e.g. "Q3 2026 — pending Mews integration"
};

export default function ModuleStateGate({
  moduleCode,
  meta,
  children,
}: {
  moduleCode: string;
  meta: ModuleMeta;
  children: ReactNode;
}) {
  const { modules, propertyName } = useCurrentProperty();
  const status = modules[moduleCode] ?? 'disabled';

  if (status === 'active') return <>{children}</>;

  const isPlanned = status === 'planned';

  return (
    <div className="min-h-screen bg-[var(--bg,#F4EFE2)]">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <div className="rounded-lg border border-[var(--sand,#B8A878)]/40 bg-[var(--bg,#F4EFE2)] p-10 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium tracking-wider uppercase mb-6"
               style={{
                 background: isPlanned ? 'rgba(184, 84, 42, 0.08)' : 'rgba(184, 168, 120, 0.15)',
                 color: isPlanned ? 'var(--terracotta, #B8542A)' : 'var(--sand, #B8A878)',
               }}>
            {isPlanned ? 'Planned' : 'Not enabled'}
          </div>

          <h1 className="text-3xl font-serif text-[var(--primary,#1F3A2E)] mb-3">
            {meta.title}
          </h1>
          <p className="text-base text-[var(--primary,#1F3A2E)]/70 mb-6">
            {meta.description}
          </p>

          <div className="mt-8 pt-6 border-t border-[var(--sand,#B8A878)]/30 text-sm text-[var(--primary,#1F3A2E)]/60">
            <p className="mb-1">
              <span className="font-medium text-[var(--primary,#1F3A2E)]">For {propertyName}:</span> {meta.roadmap}
            </p>
            <p className="text-xs text-[var(--primary,#1F3A2E)]/40 mt-2">
              Module: <code className="font-mono">{moduleCode}</code> · Status: <code className="font-mono">{status}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
