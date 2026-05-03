import { NextResponse } from 'next/server';
import { getAvailableRooms, getInventoryFreshnessMin } from '@/lib/sales';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to dates required' }, { status: 400 });
  }
  const [rooms, staleMinutes] = await Promise.all([
    getAvailableRooms(from, to),
    getInventoryFreshnessMin(),
  ]);
  return NextResponse.json({ rooms, staleMinutes });
}
