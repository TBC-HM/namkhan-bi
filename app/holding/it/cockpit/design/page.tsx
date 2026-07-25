// app/holding/it/cockpit/design/page.tsx
// Design contract — LIVE template gallery. Renders what design_system vN actually
// means: real atoms with sample data, token swatches, format law, per-property
// money/currency behaviour. Contract version is read live from
// documentation.documents so "is the doc being read?" is answerable on sight.
// PBS 2026-07-25.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DesignTemplateClient } from './DesignTemplateClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CockpitDesignTemplatePage() {
  const sb = getSupabaseAdmin();
  let meta = { version: 0, title: 'design_system doc NOT FOUND', updated: '' };
  const { data } = await sb
    .from('v_documentation_documents')
    .select('doc_type, version, title, last_updated_at')
    .eq('doc_type', 'design_system')
    .maybeSingle();
  if (data) {
    meta = { version: Number(data.version), title: String(data.title), updated: String(data.last_updated_at) };
  }
  return <DesignTemplateClient meta={meta} />;
}
