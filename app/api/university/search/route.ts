// app/api/university/search/route.ts
// TBC University · Cmd+K global search backend (design item 1, brief
// autospec-university_module-20260725 · §0.V3 gap 3 "Cmd+K global search").
// Fast, no LLM: FTS over university.articles via fn_university_search,
// plus KPI reference matches (v_kpi_definitions) and learning paths
// (v_university_paths). Ask-AI stays on /api/university/ask — the palette
// links there for full answers with citations.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ArticleHit = {
  slug: string; module: string; article_type: string; title: string;
  purpose: string; rank: number;
};
type KpiHit = { kpi_id: number; kpi_name: string; family: string | null; section: string | null };
type PathHit = { role_key: string; title: string; description: string | null };

export async function POST(req: NextRequest) {
  let q = '';
  try {
    const body = (await req.json()) as { q?: string };
    q = (body.q ?? '').trim();
  } catch { /* fall through to empty */ }
  if (q.length < 2) {
    return NextResponse.json({ ok: true, q, articles: [], kpis: [], paths: [] });
  }

  try {
    const sb = getSupabaseAdmin();
    const esc = q.replace(/[%_,]/g, ' ').trim();
    const kpiNum = /^\d{1,4}$/.test(q) ? Number(q) : null;

    const [artRes, kpiRes, kpiNumRes, pathRes] = await Promise.all([
      sb.rpc('fn_university_search', { p_q: q, p_module: null }),
      sb.from('v_kpi_definitions')
        .select('kpi_id, kpi_name, family, section')
        .ilike('kpi_name', `%${esc}%`)
        .limit(6),
      kpiNum !== null
        ? sb.from('v_kpi_definitions').select('kpi_id, kpi_name, family, section').eq('kpi_id', kpiNum).limit(1)
        : Promise.resolve({ data: [], error: null } as { data: KpiHit[]; error: null }),
      sb.from('v_university_paths')
        .select('role_key, title, description')
        .ilike('title', `%${esc}%`)
        .limit(4),
    ]);

    const articles: ArticleHit[] = ((artRes.data as ArticleHit[] | null) ?? [])
      .slice(0, 8)
      .map((a) => ({
        slug: a.slug, module: a.module, article_type: a.article_type,
        title: a.title, purpose: a.purpose, rank: a.rank,
      }));

    const seen = new Set<number>();
    const kpis: KpiHit[] = [
      ...(((kpiNumRes.data as KpiHit[] | null) ?? [])),
      ...(((kpiRes.data as KpiHit[] | null) ?? [])),
    ].filter((k) => (seen.has(k.kpi_id) ? false : (seen.add(k.kpi_id), true))).slice(0, 6);

    const paths: PathHit[] = (pathRes.data as PathHit[] | null) ?? [];

    return NextResponse.json({ ok: true, q, articles, kpis, paths });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'search failed' },
      { status: 500 },
    );
  }
}
