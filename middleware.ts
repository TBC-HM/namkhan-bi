// middleware.ts  —  repo root (TBC-HM/namkhan-bi)
// ADR-112 · Supabase Auth gate + property access check.
// PBS 2026-07-09: Buffer->atob (Edge runtime lacks Buffer). base64url payload
// decoded via atob after '-->+' / '_-->/' swap + right-pad. /api/* returns 401 JSON
// instead of HTML redirect. holding_role stamped by custom_access_token_hook.
// PBS 2026-07-14: auto-connect Gmail for @thenamkhan.com on first authenticated
// page load. If the user is signed in with a namkhan email and has no active
// row in public.v_user_gmail_connections, redirect once to /api/user/gmail/connect
// so the OAuth consent flow completes automatically. Idempotent - once the row
// exists (active=true) we never redirect again; expired access tokens refresh
// silently via lib/userGmail helpers.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Signed public links + auth entry points stay open.
// /api/cron uses CRON_SECRET header; /api/cockpit/webhooks uses per-vendor signature.
// PBS 2026-07-09: /account/password is public so first-time invitees can
// reach the activation page with their token before they have a session cookie.
// The page itself validates the token and refuses if it's missing/expired.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/account/password', '/p/']

// base64url -> JSON. Edge-safe (no Buffer / no Node crypto).
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length < 2) return {}
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4))
  try { return JSON.parse(atob(pad)) } catch { return {} }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/cockpit/webhooks') ||
    pathname.startsWith('/api/cockpit/docs/backup') || // CI pre-deploy backup
    pathname.startsWith('/api/auth/') || // login / request-access / callback exchange
    pathname.startsWith('/api/marketing/media/preview') || // PBS 2026-07-14
    pathname.startsWith('/api/marketing/contacts/extract') || // PBS 2026-07-16 · cron+admin gate lives inside the route
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
  // Only fires on top-level HTML page loads. Never on API routes (would break
  // fetch calls with unexpected 302s), never on the Gmail connect / callback
  // path itself (would loop), never on /settings/gmail (user needs to see the
  // error-state toast if consent was declined).
  const email = (user.email ?? '').toLowerCase()
  if (email.endsWith('@thenamkhan.com')) {
    const skip =
      pathname.startsWith('/api/') ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/settings/gmail') ||
      pathname.includes('/gmail-connect')
    if (!skip) {
      // Bridge view public.v_user_gmail_connections is RLS-open, no tokens exposed.
      // ilike keeps casing tolerant (auth.users.email may be mixed-case).
      const { data: conn } = await supabase
        .from('v_user_gmail_connections')
        .select('gmail_address, active, expires_at')
        .ilike('gmail_address', email)
        .maybeSingle()
      const needsConnect = !conn || conn.active !== true
      if (needsConnect) {
        // Guard against redirect loop: only auto-trigger once per navigation.
        // We rely on /api/user/gmail/connect to build the Google authorize URL
        // and Google to bounce back to /api/user/gmail/callback which persists
        // the row. On the next page load the check above passes and we skip.
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
