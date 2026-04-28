import { NextRequest, NextResponse } from 'next/server';

// Single-password gate. Checks cookie against env DASHBOARD_PASSWORD.
// Login page sets the cookie. Public assets pass through.
const COOKIE = 'nkbi_auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/login') ||
    pathname === '/login' ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && cookie === process.env.DASHBOARD_PASSWORD) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!api/login|login|_next|favicon).*)'] };
