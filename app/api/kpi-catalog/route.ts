// app/api/kpi-catalog/route.ts — serve a single KPI catalog entry by key.
// Key = kpi_name (snake_case) OR gold_view string.
// Used by KpiPopoverButton client component (lazy, cached on client).

import { NextResponse } from 'next/server';
import { getKpiEntry } from '@/lib/kpiCatalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  const key = new URL(req.url).searchParams.get('key') ?? '';
  if (!key) return NextResponse.json(null);
  const entry = await getKpiEntry(key);
  return NextResponse.json(entry, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
  });
}
