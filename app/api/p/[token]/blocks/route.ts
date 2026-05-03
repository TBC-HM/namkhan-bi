import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fireMakeWebhook } from '@/lib/makeWebhooks';

export const dynamic = 'force-dynamic';

interface Ctx { params: { token: string } }

export async function PATCH(req: Request, { params }: Ctx) {
  const body = await req.json() as { block_id?: string; qty?: number; removable?: boolean; action?: 'remove' | 'restore' | 'qty' };
  if (!body.block_id) return NextResponse.json({ error: 'block_id required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: prop } = await sb.schema('sales').from('proposals').select('id, expires_at').eq('public_token', params.token).maybeSingle();
  if (!prop) return NextResponse.json({ error: 'invalid_token' }, { status: 404 });
  if ((prop as any).expires_at && new Date((prop as any).expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  const { data: block } = await sb.schema('sales').from('proposal_blocks').select('id, qty, removable').eq('id', body.block_id).eq('proposal_id', (prop as any).id).maybeSingle();
  if (!block) return NextResponse.json({ error: 'block_not_found' }, { status: 404 });

  const qtyBefore = (block as any).qty as number;
  const patch: Record<string, unknown> = {};
  let action: 'removed' | 'restored' | 'qty_changed' = 'qty_changed';
  if (body.action === 'remove' || body.qty === 0) { patch.qty = 0; action = 'removed'; }
  else if (body.action === 'restore') { patch.qty = qtyBefore > 0 ? qtyBefore : 1; action = 'restored'; }
  else if (typeof body.qty === 'number') { patch.qty = Math.max(0, body.qty); action = 'qty_changed'; }
  else return NextResponse.json({ error: 'no_op' }, { status: 400 });

  const { error } = await sb.schema('sales').from('proposal_blocks').update(patch).eq('id', body.block_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.schema('sales').from('proposal_guest_edits').insert({
    proposal_id: (prop as any).id,
    block_id: body.block_id,
    action,
    qty_before: qtyBefore,
    qty_after: patch.qty as number,
  });

  await fireMakeWebhook('proposal_guest_edited', {
    proposal_id: (prop as any).id,
    block_id: body.block_id,
    action,
    qty_before: qtyBefore,
    qty_after: patch.qty,
  });

  return NextResponse.json({ ok: true, action });
}
