// app/api/sop/save/route.ts
// PBS 2026-07-07: Thin server relay → public.fn_sop_upsert (SECURITY DEFINER).
// Inserts dms.documents + knowledge.sop_meta + knowledge.sop_content in one txn.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  property_id:      number;
  dept_code:        string;
  title:            string;
  short_summary:    string;
  bullets:          string[];
  author:           string;
  sop_date:         string;   // YYYY-MM-DD
  primary_audience?: string;
  source?:          string;
  sop_code?:        string;
  created_by?:      string;
}

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    if (!b.property_id || !b.dept_code || !b.title) {
      return NextResponse.json({ error: 'property_id, dept_code, title required' }, { status: 400 });
    }
    const bullets = Array.isArray(b.bullets) ? b.bullets.map((x) => String(x).trim()).filter(Boolean) : [];
    // body_md: newline-separated markdown bullets. Preserves what the user edits.
    const body_md = bullets.map((line) => (line.startsWith('- ') ? line : `- ${line}`)).join('\n');

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_sop_upsert', {
      p_property_id:      Number(b.property_id),
      p_dept_code:        String(b.dept_code),
      p_title:            String(b.title),
      p_short_summary:    String(b.short_summary ?? ''),
      p_body_md:          body_md,
      p_primary_audience: String(b.primary_audience ?? 'staff'),
      p_author:           String(b.author ?? 'AI · Claude Sonnet'),
      p_sop_date:         String(b.sop_date ?? new Date().toISOString().slice(0, 10)),
      p_source:           String(b.source ?? 'ai_generated'),
      p_sop_code:         b.sop_code ? String(b.sop_code) : null,
      p_created_by:       b.created_by ? String(b.created_by) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, row: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
