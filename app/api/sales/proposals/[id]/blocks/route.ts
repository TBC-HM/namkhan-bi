import { NextResponse } from 'next/server';
import { addBlock, updateBlock, deleteBlock } from '@/lib/sales';

export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

export async function POST(req: Request, { params }: Ctx) {
  const body = await req.json();
  const block = await addBlock(params.id, body);
  if (!block) return NextResponse.json({ error: 'add_failed' }, { status: 500 });
  return NextResponse.json({ block });
}

export async function PATCH(req: Request, _ctx: Ctx) {
  const body = await req.json();
  if (!body.block_id) return NextResponse.json({ error: 'block_id required' }, { status: 400 });
  const { block_id, ...patch } = body;
  const ok = await updateBlock(block_id, patch);
  if (!ok) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, _ctx: Ctx) {
  const url = new URL(req.url);
  const block_id = url.searchParams.get('block_id');
  if (!block_id) return NextResponse.json({ error: 'block_id required' }, { status: 400 });
  const ok = await deleteBlock(block_id);
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
