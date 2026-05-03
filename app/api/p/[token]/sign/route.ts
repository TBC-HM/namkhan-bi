import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fireMakeWebhook } from '@/lib/makeWebhooks';
import { createHash } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Ctx { params: { token: string } }

export async function POST(req: Request, { params }: Ctx) {
  const body = await req.json() as { signed_by_name?: string; signed_by_email?: string };
  if (!body.signed_by_name || !body.signed_by_email) {
    return NextResponse.json({ error: 'name + email required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: prop } = await sb.schema('sales').from('proposals')
    .select('id, status, expires_at').eq('public_token', params.token).maybeSingle();
  if (!prop) return NextResponse.json({ error: 'invalid_token' }, { status: 404 });
  if ((prop as any).expires_at && new Date((prop as any).expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const salt = process.env.IP_HASH_SALT ?? 'namkhan-portal-default';
  const ipHash = createHash('sha256').update(ip + salt).digest('hex').slice(0, 32);

  await sb.schema('sales').from('proposal_sig_events').insert({
    proposal_id: (prop as any).id,
    provider: 'native_typed',
    status: 'signed',
    signed_by_name: body.signed_by_name,
    signed_by_email: body.signed_by_email,
    ip_hash: ipHash,
  });

  await sb.schema('sales').from('proposals').update({
    status: 'signed',
    signed_at: new Date().toISOString(),
  }).eq('id', (prop as any).id);

  await fireMakeWebhook('proposal_signed', {
    proposal_id: (prop as any).id,
    signed_by_name: body.signed_by_name,
    signed_by_email: body.signed_by_email,
  });

  return NextResponse.json({ ok: true, status: 'signed' });
}
