// lib/property-context.tsx
// Active property context. Provides current property + module status to all children.

'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type ModuleStatus = 'active' | 'planned' | 'disabled';

export type PropertyContextValue = {
  propertyId: number;
  propertyName: string;
  modules: Record<string, ModuleStatus>; // module_code -> status
};

const PropertyContext = createContext<PropertyContextValue | null>(null);

export function PropertyProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: PropertyContextValue;
}) {
  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>;
}

export function useCurrentProperty(): PropertyContextValue {
  const ctx = useContext(PropertyContext);
  if (!ctx) {
    throw new Error('useCurrentProperty must be used inside <PropertyProvider>');
  }
  return ctx;
}

export function useModuleStatus(moduleCode: string): ModuleStatus {
  const { modules } = useCurrentProperty();
  return modules[moduleCode] ?? 'disabled';
}
