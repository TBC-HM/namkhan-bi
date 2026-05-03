import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

export async function PATCH(req: Request, { params }: Ctx) {
  const body = await req.json();
  const sb = getSupabaseAdmin();
  const { data: latest } = await sb.schema('sales')
    .from('proposal_emails')
    .select('id, version')
    .eq('proposal_id', params.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return NextResponse.json({ error: 'no email exists' }, { status: 404 });
  const { error } = await sb.schema('sales').from('proposal_emails').update({
    subject: body.subject,
    intro_md: body.intro_md,
    outro_md: body.outro_md,
    ps_md: body.ps_md,
  }).eq('id', (latest as { id: string }).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
