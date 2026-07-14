// middleware.ts  —  repo root (TBC-HM/namkhan-bi)
// ADR-112 · Supabase Auth gate + property access check.
// PBS 2026-07-09: Buffer->atob (Edge runtime lacks Buffer). base64url payload
// decoded via atob. /api/* returns 401 JSON instead of HTML redirect.
// PBS 2026-07-14: auto-connect Gmail for @thenamkhan.com on first authenticated
// page load. Idempotent - once v_user_gmail_connections row is active we skip.
// PBS 2026-07-14 (idle): server-side rolling cookie 'nb_last_seen' invalidates
// the session after IDLE_TIMEOUT_MINUTES (60) of no HTTP activity. Pages get
// 302 to /login?reason=idle&next=<path>; /api/* returns 401 JSON.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/account/password', '/p/']

const IDLE_TIMEOUT_MINUTES = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? '60') || 60
const IDLE_COOKIE = 'nb_last_seen'
const IDLE_COOKIE_MAXAGE_S = (IDLE_TIMEOUT_MINUTES + 5) * 60

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length < 2) return {}
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4))
  try { return JSON.parse(atob(pad)) } catch { return {} }
}

function clearSupabaseSessionCookies(res: NextResponse) {
  const names = [
    'sb-access-token',
    'sb-refresh-token',
    'sb-kpenyneooigsyuuomgct-auth-token',
    'sb-kpenyneooigsyuuomgct-auth-token.0',
    'sb-kpenyneooigsyuuomgct-auth-token.1',
    IDLE_COOKIE,
  ]
  for (const n of names) res.cookies.set(n, '', { path: '/', maxAge: 0 })
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/cockpit/webhooks') ||
    pathname.startsWith('/api/cockpit/docs/backup') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/marketing/media/preview') ||
    PUBLIC_PATHS.some(p => pathname.startsWith(p))
  ) return NextResponse.next()

  let res = NextResponse.next({ request: { headers: req.headers } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (c) => { c.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)) },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'auth required' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // -------- Idle-timeout check --------
  // Every authenticated pass (page or api) reads nb_last_seen. If missing:
  // first hit after login -> stamp fresh, allow. If present but older than
  // IDLE_TIMEOUT_MINUTES -> genuine lapse: clear session cookies + reject.
  // Pages redirect to /login?reason=idle&next=<path>. /api/* returns 401 JSON.
  const nowMs = Date.now()
  const lastSeenRaw = req.cookies.get(IDLE_COOKIE)?.value
  const lastSeenMs = lastSeenRaw ? Number(lastSeenRaw) : NaN
  const isStale = Number.isFinite(lastSeenMs) &&
    (nowMs - lastSeenMs) >= IDLE_TIMEOUT_MINUTES * 60 * 1000

  if (isStale) {
    if (pathname.startsWith('/api/')) {
      const expired = NextResponse.json(
        { error: 'session expired', reason: 'idle' },
        { status: 401 },
      )
      clearSupabaseSessionCookies(expired)
      return expired
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('reason', 'idle')
    url.searchParams.set('next', pathname)
    const redirect = NextResponse.redirect(url)
    clearSupabaseSessionCookies(redirect)
    return redirect
  }

  // Roll cookie forward on every authenticated pass.
  res.cookies.set(IDLE_COOKIE, String(nowMs), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: IDLE_COOKIE_MAXAGE_S,
  })

  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token ? decodeJwtPayload(session.access_token) : {}
  const holdingRole: string = String(claims.holding_role ?? '')
  const propertyIds: number[] = Array.isArray(claims.property_ids)
    ? (claims.property_ids as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : []

  const m = pathname.match(/^\/h\/(\d+)(\/|$)/)
  if (m) {
    const pid = Number(m[1])
    const allowed = holdingRole !== '' || propertyIds.includes(pid)
    if (!allowed) return new NextResponse('Forbidden -- no access to this property', { status: 403 })
  }

  if (pathname.startsWith('/holding') && holdingRole === '') {
    return new NextResponse('Forbidden -- holding access only', { status: 403 })
  }

  // -------- Auto-connect Gmail for @thenamkhan.com staff --------
  const email = (user.email ?? '').toLowerCase()
  if (email.endsWith('@thenamkhan.com')) {
    const skip =
      pathname.startsWith('/api/') ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/settings/gmail') ||
      pathname.includes('/gmail-connect')
    if (!skip) {
      const { data: conn } = await supabase
        .from('v_user_gmail_connections')
        .select('gmail_address, active, expires_at')
        .ilike('gmail_address', email)
        .maybeSingle()
      const needsConnect = !conn || conn.active !== true
      if (needsConnect) {
        const dest = req.nextUrl.clone()
        dest.pathname = '/api/user/gmail/connect'
        dest.search = ''
        return NextResponse.redirect(dest)
      }
    }
  }

  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
