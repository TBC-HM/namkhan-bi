// app/operations/sops/[sop_code]/send/page.tsx
// PBS 2026-07-11 pm: SOP send page — pick recipient email + optional cover note.
// SOP itself is delivered as .doc attachment (see /api/sop/send).

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import SopSendForm from './_components/SopSendForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Row {
  sop_code: string;
  title: string;
  dept_code: string;
  short_summary: string | null;
  body_md: string | null;
  version: string | null;
  author: string | null;
}

export default async function SopSendPage({ params }: { params: Promise<{ sop_code: string }> }) {
  const { sop_code } = await params;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_sop_catalog').select('sop_code,title,dept_code,short_summary,body_md,version,author').eq('sop_code', sop_code).maybeSingle();
  const row = data as Row | null;
  if (!row) notFound();

  const previewSummary = row.short_summary ?? row.body_md ?? '(no summary available)';

  return (
    <div style={{ padding: 24, background: '#FFFFFF', color: '#1B1B1B', fontFamily: '-apple-system, Helvetica, Arial, sans-serif', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5A5A' }}>Send SOP · {row.sop_code}</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: '#1F3A2E' }}>{row.title}</h1>
          <div style={{ fontSize: 12, color: '#5A5A5A' }}>{row.dept_code} · v{row.version ?? '—'}{row.author ? ` · by ${row.author}` : ''}</div>
        </div>
        <SopSendForm sopCode={row.sop_code} defaultSubject={`SOP · ${row.title} (v${row.version ?? '1.0'})`} previewSummary={previewSummary} />
      </div>
    </div>
  );
}
