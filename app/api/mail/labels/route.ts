// app/api/mail/labels/route.ts
// GET: list all Gmail labels for the current user (system + user labels).
import { NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { listLabels } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  try {
    const data = await listLabels(user.id);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'labels_failed' }, { status: 500 });
  }
}
