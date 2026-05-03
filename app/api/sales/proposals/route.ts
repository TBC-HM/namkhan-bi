import { NextResponse } from 'next/server';
import { createProposalFromInquiry } from '@/lib/sales';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { inquiry_id?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.inquiry_id) {
    return NextResponse.json({ error: 'inquiry_id required' }, { status: 400 });
  }
  const created = await createProposalFromInquiry(body.inquiry_id);
  if (!created) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ id: created.id });
}
