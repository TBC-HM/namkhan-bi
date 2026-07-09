// app/auth/callback/route.ts
// PBS 2026-07-09: OAuth code-exchange route. When Google/OAuth flow (or magic
// link) sends the user back with ?code=…, we exchange it for a session cookie
// via supabase.auth.exchangeCodeForSession(), then redirect to ?next or /.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  const res = NextResponse.redirect(new URL(next, url.origin));
  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (c) => c.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
        },
      },
    );
    await supabase.auth.exchangeCodeForSession(code);
  }
  return res;
}
