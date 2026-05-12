// app/h/[property_id]/layout.tsx
// v2: Adds parallel fetch for property.brand + wraps children in <ThemeInjector>.

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PropertyProvider, type ModuleStatus } from '@/lib/property-context';
import ThemeInjector from '@/components/ThemeInjector';
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

  const [{ data: modulesRaw }, { data: brand }] = await Promise.all([
    supabase.rpc('get_property_modules', { p_property_id: propertyId }),
    supabase.schema('property').from('brand').select('brand_palette, logo_url').eq('property_id', propertyId).maybeSingle(),
  ]);

  const modules: Record<string, ModuleStatus> = {};
  (modulesRaw ?? []).forEach((row: { module_code: string; status: string }) => {
    modules[row.module_code] = row.status as ModuleStatus;
  });

  return (
    <ThemeInjector palette={brand?.brand_palette ?? null}>
      <PropertyProvider
        value={{
          propertyId,
          propertyName: known.display_name,
          modules,
          logoUrl: brand?.logo_url ?? null,
        }}
      >
        {children}
      </PropertyProvider>
    </ThemeInjector>
  );
}
