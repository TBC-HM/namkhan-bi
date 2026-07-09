// app/operations/sops/[sop_code]/edit/page.tsx
// PBS 2026-07-09 pm: SOP editor — read current v_sop_catalog row + mount SopEditForm.

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import SopEditForm from './_components/SopEditForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Row {
  sop_code: string;
  title: string;
  dept_code: string;
  short_summary: string | null;
  body_md: string | null;
  author: string | null;
  sop_date: string | null;
  primary_audience: string | null;
  source: string | null;
  property_id: number | null;
}

export default async function SopEditPage({ params }: { params: Promise<{ sop_code: string }> }) {
  const { sop_code } = await params;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_sop_catalog').select('sop_code,title,dept_code,short_summary,body_md,author,sop_date,primary_audience,source,property_id').eq('sop_code', sop_code).maybeSingle();
  const row = data as Row | null;
  if (!row) notFound();

  return (
    <div style={{ padding: 24, background: '#FFFFFF', color: '#1B1B1B', fontFamily: '-apple-system, Helvetica, Arial, sans-serif', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5A5A' }}>Edit SOP · {row.sop_code}</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: '#084838' }}>{row.title}</h1>
        </div>
        <SopEditForm initial={row} />
      </div>
    </div>
  );
}
