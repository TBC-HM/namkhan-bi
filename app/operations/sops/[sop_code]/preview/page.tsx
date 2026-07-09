// app/operations/sops/[sop_code]/preview/page.tsx
// PBS 2026-07-09 pm: SOP preview — renders v_sop_catalog + sop_content body.

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Row {
  sop_code: string;
  title: string;
  dept_code: string;
  short_summary: string | null;
  author: string | null;
  status: string;
  version: string | null;
  body_md: string | null;
  sop_date: string | null;
  updated_at: string | null;
}

export default async function SopPreviewPage({ params }: { params: Promise<{ sop_code: string }> }) {
  const { sop_code } = await params;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_sop_catalog').select('sop_code,title,dept_code,short_summary,author,status,version,body_md,sop_date,updated_at').eq('sop_code', sop_code).maybeSingle();
  const row = data as Row | null;
  if (!row) notFound();

  return (
    <div style={{ padding: 24, background: '#FFFFFF', color: '#1B1B1B', fontFamily: '-apple-system, Helvetica, Arial, sans-serif', minHeight: '100vh' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5A5A' }}>SOP · {row.sop_code}</div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 700, color: '#084838', letterSpacing: '-0.01em' }}>{row.title}</h1>
          <div style={{ fontSize: 12, color: '#5A5A5A' }}>
            {row.dept_code} · v{row.version ?? '—'} · {row.status}
            {row.author ? ` · by ${row.author}` : ''}
            {row.sop_date ? ` · ${row.sop_date}` : ''}
          </div>
        </div>
        {row.short_summary && (
          <div style={{ marginBottom: 16, padding: 12, background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6, fontSize: 13, lineHeight: 1.5 }}>
            {row.short_summary}
          </div>
        )}
        <div style={{ padding: 16, background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {row.body_md ?? '(no body content stored)'}
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, fontSize: 12 }}>
          <a href={`/operations/sops/${encodeURIComponent(row.sop_code)}/edit`} style={{ padding: '6px 14px', background: '#084838', color: '#FFFFFF', border: '1px solid #084838', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>Edit</a>
          <a href={`/operations/sops/${encodeURIComponent(row.sop_code)}/send`} style={{ padding: '6px 14px', background: '#FFFFFF', color: '#084838', border: '1px solid #084838', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>Send by email</a>
          <a href="/operations/sops" style={{ padding: '6px 14px', background: '#FFFFFF', color: '#5A5A5A', border: '1px solid #E6DFCC', borderRadius: 4, textDecoration: 'none', fontWeight: 500 }}>← Back</a>
        </div>
      </div>
    </div>
  );
}
