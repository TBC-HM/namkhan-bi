// app/h/[property_id]/layout.tsx
// v3: PBS 2026-07-07 — property-aware <title> + meta description.
// generateMetadata resolves core.properties.name so `/h/1000001/*` renders
// "Donna Portals · BI" instead of the root layout's hardcoded "The Namkhan · BI".
// v2: Adds parallel fetch for property.brand + wraps children in <ThemeInjector>.

import type { Metadata } from 'next';
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

// PBS 2026-07-07 — resolve property.name so <title> matches the tenant.
// Falls back to KNOWN_PROPERTIES if the row is missing so we never render
// "undefined · BI". Next.js merges parent + child metadata: the root layout
// still supplies default OG/Twitter/etc. — we only override title + description.
export async function generateMetadata({
  params,
}: {
  params: { property_id: string };
}): Promise<Metadata> {
  const propertyId = Number(params.property_id);
  const fallback = KNOWN_PROPERTIES.find((p) => p.property_id === propertyId)?.display_name
    ?? `Property ${params.property_id}`;

  let name = fallback;
  try {
    const supabase = createClient();
    const { data } = await supabase
      .schema('core')
      .from('properties')
      .select('name')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (data?.name) name = data.name;
  } catch {
    /* keep fallback */
  }

  return {
    title: `${name} · BI`,
    description: `Operator intelligence dashboard for ${name}.`,
  };
}

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
        {/* 2026-05-14 — TopDeptStrip moved up to app/layout.tsx so it
            survives legacy /<dept> redirects that escape this scope. */}
        {children}
      </PropertyProvider>
    </ThemeInjector>
  );
}
