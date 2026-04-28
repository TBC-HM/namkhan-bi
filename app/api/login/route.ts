import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { password } = body;
  if (password && password === process.env.DASHBOARD_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('nkbi_auth', password, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30
    });
    return res;
  }
  return NextResponse.json({ ok: false, error: 'Wrong password' }, { status: 401 });
}
