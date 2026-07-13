// app/api/mail/message/[id]/modify/route.ts
// POST { addLabels?: string[], removeLabels?: string[] }
// Wrap Gmail users.messages.modify — used by star/unstar, archive, mark-read.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, modifyLabelsForUser } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { addLabels?: string[]; removeLabels?: string[] }

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const add = Array.isArray(body.addLabels) ? body.addLabels : [];
  const remove = Array.isArray(body.removeLabels) ? body.removeLabels : [];
  try {
    await modifyLabelsForUser(user.id, id, add, remove);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'modify_failed' }, { status: 500 });
  }
}
