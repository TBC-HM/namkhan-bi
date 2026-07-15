// Preview page for the scaffolded Revenue HoD scheduled reports.
// URL: /revenue/reports/scheduled/{daily|weekly|monthly}/preview?property_id=260955
// 2026-07-15 PBS · duplicate-title fix: outer wrapper now only carries the Download
// button; the iframe body already renders the canonical title/date/author strip.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ template: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

interface Props { params: Params; searchParams?: Search }

async function renderReport(propertyId: number, templateKey: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.functions.invoke('render-revenue-report', {
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

export default async function RevenueReportPreviewPage({ params, searchParams }: Props) {
  const p  = await params;
  const sp = (await searchParams) ?? {};
  const template = String(p.template ?? '');
  if (!['daily','weekly','monthly'].includes(template)) notFound();

  const spProp = Array.isArray(sp.property_id) ? sp.property_id[0] : sp.property_id;
  const propertyId = spProp ? Number(spProp) : Number(PROPERTY_ID);
  if (!Number.isFinite(propertyId)) notFound();

  const { html, propertyName, reportDate, error } = await renderReport(propertyId, template);

  const downloadHref = html ? 'data:text/html;charset=utf-8,' + encodeURIComponent(html) : null;
  const downloadName = `revenue-${template}-${propertyName ?? propertyId}-${reportDate ?? ''}.html`.replace(/\s+/g, '_');

  return (
    <div style={{ padding: '16px', background: '#FFFFFF', color: '#1B1B1B', fontFamily: '-apple-system, Helvetica, Arial, sans-serif' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {/* Compact toolbar — the iframe body already carries the report title/date/author. */}
        {downloadHref && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <a href={downloadHref} download={downloadName} style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
              background: '#084838', color: '#FFFFFF', border: 'none', borderRadius: 4,
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}>⬇ Download HTML</a>
          </div>
        )}
        {error && <div style={{ color: '#B00020', border: '1px solid #E6DFCC', padding: 12 }}>Render error: {error}</div>}
        {html && (
          <div style={{ border: '1px solid #E6DFCC', borderRadius: 8, overflow: 'hidden', background: '#FFFFFF' }}>
            <iframe
              title="Daily Revenue Report"
              srcDoc={html}
              style={{ width: '100%', minHeight: '90vh', height: '4000px', border: 'none', background: '#FFFFFF', display: 'block' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
