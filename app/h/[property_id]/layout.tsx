// app/p/[property_id]/layout.tsx
// Wraps every /p/[property_id]/... route with PropertyProvider.
// Server-side: fetches property name + module statuses, validates user access.

import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PropertyProvider, type ModuleStatus } from '@/lib/property-context';
import type { ReactNode } from 'react';

const KNOWN_PROPERTIES = [
  { property_id: 260955,  display_name: 'The Namkhan' },
  { property_id: 1000001, display_name: 'Donna Portals' },
];

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PropertyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  const known = KNOWN_PROPERTIES.find((p) => p.property_id === propertyId);
  if (!known) notFound();

  const supabase = createClient();

  // Fetch module statuses for this property
  const { data: modulesRaw } = await supabase.rpc('get_property_modules', {
    p_property_id: propertyId,
  });

  const modules: Record<string, ModuleStatus> = {};
  (modulesRaw ?? []).forEach((row: { module_code: string; status: string }) => {
    modules[row.module_code] = row.status as ModuleStatus;
  });

  return (
    <PropertyProvider
      value={{
        propertyId,
        propertyName: known.display_name,
        modules,
      }}
    >
      {children}
    </PropertyProvider>
  );
}
