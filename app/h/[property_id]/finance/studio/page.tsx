// app/h/[property_id]/finance/studio/page.tsx
// Spreadsheet Studio v1 — in-platform canon grid over gold views
// (brief module-spreadsheet-studio-v1, goal 46). Administration substripe
// placement per PBS 2026-07-29 menu-placement directive.
//
// Read-only over metric data: the picker is driven by public.fn_studio_catalog
// (public + kpi v_* views, annotated from the KPI catalog); queries run through
// public.fn_studio_query — whitelisted, no raw SQL surface. Exports carry the
// footer stamp (source view · generated-at · data-as-of) so every number is
// reproducible from the named source view.

import { notFound } from 'next/navigation';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import type { StudioCatalogEntry, StudioTemplateRow } from '@/lib/studio/types';
import StudioTabs from './_components/StudioTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'The Namkhan', 1000001: 'Donna Portals' };

export default async function SpreadsheetStudioPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();

  const [catalogRes, templatesRes] = await Promise.all([
    supabase.rpc('fn_studio_catalog'),
    supabase
      .from('v_studio_templates')
      .select('id, property_id, name, definition, owner, version, status, updated_at')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false }),
  ]);

  const catalog = (catalogRes.data ?? []) as StudioCatalogEntry[];
  const templates = (templatesRes.data ?? []) as StudioTemplateRow[];

  return (
    <DashboardPage title={`Spreadsheet Studio · ${KNOWN_LABEL[propertyId]}`}>
      <StudioTabs propertyId={propertyId} catalog={catalog} initialTemplates={templates} />
    </DashboardPage>
  );
}
