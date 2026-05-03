import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fireMakeWebhook } from '@/lib/makeWebhooks';
import { createHash } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Ctx { params: { token: string } }

export async function POST(req: Request, { params }: Ctx) {
  let body: { event_type?: string } = {};
  try { body = await req.json(); } catch {}
  const eventType = body.event_type ?? 'open';

  const sb = getSupabaseAdmin();
  const { data: prop } = await sb.schema('sales').from('proposals')
    .select('id, status').eq('public_token', params.token).maybeSingle();
  if (!prop) return NextResponse.json({ error: 'invalid_token' }, { status: 404 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const ua = req.headers.get('user-agent') ?? '';
  const salt = process.env.IP_HASH_SALT ?? 'namkhan-portal-default';
  const ipHash = createHash('sha256').update(ip + salt).digest('hex').slice(0, 32);

  await sb.schema('sales').from('proposal_view_events').insert({
    proposal_id: (prop as any).id,
    event_type: eventType,
    ip_hash: ipHash,
    user_agent: ua.slice(0, 200),
  });

  if ((prop as any).status === 'sent' && eventType === 'open') {
    await sb.schema('sales').from('proposals').update({ status: 'viewed' }).eq('id', (prop as any).id);
    await fireMakeWebhook('proposal_viewed', {
      proposal_id: (prop as any).id,
      first_view: true,
      event_type: eventType,
    });
  }

  return NextResponse.json({ ok: true });
}
