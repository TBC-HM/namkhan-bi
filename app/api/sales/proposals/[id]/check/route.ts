// GET /api/sales/proposals/[id]/check
// Returns ProposalCheck — used by the composer to gate the Send button.
import { NextResponse } from 'next/server';
import { checkProposalRoomsAvail } from '@/lib/sales';

export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const check = await checkProposalRoomsAvail(params.id);
  if (!check) {
    return NextResponse.json({ error: 'proposal not found' }, { status: 404, headers: NO_CACHE });
  }
  return NextResponse.json(check, { headers: NO_CACHE });
}

// PBS 2026-07-16 — force-fresh: check result was serving stale from the browser
// cache after users edited dates, keeping the "no dates" banner visible until
// hard refresh.
const NO_CACHE: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
  'Pragma': 'no-cache',
  'Expires': '0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};
