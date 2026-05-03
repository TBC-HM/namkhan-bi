// GET /api/sales/proposals/[id]/check
// Returns ProposalCheck — used by the composer to gate the Send button.
import { NextResponse } from 'next/server';
import { checkProposalRoomsAvail } from '@/lib/sales';

export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const check = await checkProposalRoomsAvail(params.id);
  if (!check) return NextResponse.json({ error: 'proposal not found' }, { status: 404 });
  return NextResponse.json(check);
}
