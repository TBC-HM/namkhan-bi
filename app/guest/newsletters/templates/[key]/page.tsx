// app/guest/newsletters/templates/[key]/page.tsx
// PBS 2026-07-03: server wrapper that loads one template and mounts client editor.

import { notFound } from 'next/navigation';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import TemplateEditor from './_components/TemplateEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps { params: { key: string }; searchParams?: Record<string,string|string[]|undefined>; }

export default async function TemplateEditPage({ params, searchParams }: PageProps) {
  const sb = getSupabaseAdmin();
  const key = params.key;

  const isNew = key === 'new';
  const copyFrom = searchParams && !Array.isArray(searchParams.copy) ? searchParams.copy : null;

  let template: any = null;
  if (!isNew) {
    const { data } = await sb.from('v_newsletter_templates')
      .select('*').eq('property_id', PROPERTY_ID).eq('template_key', key).maybeSingle();
    if (!data) notFound();
    template = data;
  } else if (copyFrom) {
    const { data } = await sb.from('v_newsletter_templates')
      .select('*').eq('property_id', PROPERTY_ID).eq('template_key', copyFrom).maybeSingle();
    if (data) {
      template = { ...data, template_key: '', label: (data.label ?? '') + ' (copy)' };
    }
  }

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title={isNew ? 'New template' : `Template · ${template?.label ?? key}`}
        subtitle="Edit body content · header + footer are locked chrome and shared across all templates"
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1' }}>
          <TemplateEditor initial={template} isNew={isNew} />
        </div>
      </DashboardPage>
    </div>
  );
}
