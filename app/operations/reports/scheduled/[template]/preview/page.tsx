// Preview page for the Ops HoD scheduled daily report.
// URL: /operations/reports/scheduled/{daily}/preview?property_id=260955
// Mirror of app/revenue/reports/scheduled/[template]/preview/page.tsx
// 2026-07-14 · PBS · fires supabase edge fn render-operations-report

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ template: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

interface Props { params: Params; searchParams?: Search }

// URL segment (daily) -> edge fn template_key (operations_daily)
const TEMPLATE_KEY_MAP: Record<string, string> = { daily: 'operations_daily' };

async function renderReport(propertyId: number, templateKey: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.functions.invoke('render-operations-report', {
    body: { property_id: propertyId, template_key: templateKey },
  });
  if (error) return { error: error.message, html: null, subject: null, propertyName: null, reportDate: null };
  return {
    error: null,
    html: (data?.html as string) ?? null,
    subject: (data?.subject as string) ?? null,
    propertyName: (data?.property_name as string) ?? null,
    reportDate: (data?.report_date as string) ?? null,
  };
}

export default async function OperationsReportPreviewPage({ params, searchParams }: Props) {
  const p  = await params;
  const sp = (await searchParams) ?? {};
  const template = String(p.template ?? '');
  const templateKey = TEMPLATE_KEY_MAP[template];
  if (!templateKey) notFound();

  const spProp = Array.isArray(sp.property_id) ? sp.property_id[0] : sp.property_id;
  const propertyId = spProp ? Number(spProp) : Number(PROPERTY_ID);
  if (!Number.isFinite(propertyId)) notFound();

  const { html, subject, propertyName, reportDate, error } = await renderReport(propertyId, templateKey);

  return (
    <div style={{ padding: 24, background: '#FFFFFF', color: '#1B1B1B', fontFamily: '-apple-system, Helvetica, Arial, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ borderBottom: '1px solid #E6DFCC', paddingBottom: 12, marginBottom: 16, fontSize: 12, color: '#5A5A5A' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#0F4C3A', letterSpacing: '-0.01em' }}>
            Preview - Operations {template} report
          </div>
          <div>Property: <strong>{propertyName ?? propertyId}</strong> · Date: <strong>{reportDate ?? ''}</strong> · Author: Namkhan BI cockpit (automated)</div>
          {subject && <div style={{ marginTop: 4 }}>Subject: <code style={{ fontSize: 11 }}>{subject}</code></div>}
        </div>
        {error && <div style={{ color: '#B04A2F', border: '1px solid #E6DFCC', padding: 12 }}>Render error: {error}</div>}
        {html && (
          <div style={{ border: '1px solid #E6DFCC', borderRadius: 8, overflow: 'hidden' }}>
            <iframe title="report preview" srcDoc={html} style={{ width: '100%', minHeight: 720, border: 'none', background: '#FFFFFF' }} />
          </div>
        )}
      </div>
    </div>
  );
}
