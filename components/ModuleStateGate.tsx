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
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <div
          className="rounded-lg p-10 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full font-medium tracking-wider uppercase mb-6"
               style={{
                 fontSize: 'var(--t-xs)',
                 background: isPlanned ? 'rgba(168, 133, 74, 0.15)' : 'var(--paper-deep)',
                 color: isPlanned ? 'var(--brass)' : 'var(--ink-mute)',
               }}>
            {isPlanned ? 'Planned' : 'Not enabled'}
          </div>

          <h1 className="font-serif mb-3" style={{ fontSize: 'var(--t-3xl)', color: 'var(--ink)' }}>
            {meta.title}
          </h1>
          <p className="mb-6" style={{ fontSize: 'var(--t-md)', color: 'var(--ink-soft)' }}>
            {meta.description}
          </p>

          <div
            className="mt-8 pt-6"
            style={{ borderTop: '1px solid var(--border)', fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}
          >
            <p className="mb-1">
              <span className="font-medium" style={{ color: 'var(--ink)' }}>For {propertyName}:</span> {meta.roadmap}
            </p>
            <p className="mt-2" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-faint)' }}>
              Module: <code className="font-mono">{moduleCode}</code> · Status: <code className="font-mono">{status}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
