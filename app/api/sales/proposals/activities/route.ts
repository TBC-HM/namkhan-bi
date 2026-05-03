import { NextResponse } from 'next/server';
import { listActivities, listCategories } from '@/lib/sales';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kindParam = url.searchParams.get('kind');
  const cat = url.searchParams.get('cat') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;

  const kind: 'internal' | 'external' | 'all' | undefined =
    kindParam === 'internal' || kindParam === 'external' || kindParam === 'all' ? kindParam : undefined;

  const [activities, categories] = await Promise.all([
    listActivities({ kind, cat, q }),
    listCategories(),
  ]);

  return NextResponse.json({ activities, categories });
}
