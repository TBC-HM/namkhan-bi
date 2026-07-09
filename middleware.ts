// middleware.ts  —  repo root (TBC-HM/namkhan-bi)
// ADR-112. Gates the whole app: no session -> /login; session lacking
// the requested property_id in JWT claims -> 403. Holding roles bypass.
//
// Edge-runtime note: Buffer is a Node global, not available here.
// We decode the JWT payload with atob() after normalising base64url.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/p/'] // signed public links stay open

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch {
    return {}
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/cockpit/webhooks') ||
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
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token ? decodeJwtPayload(session.access_token) : {}
  const holdingRole: string = (claims.holding_role as string) || ''
  const propertyIds: number[] = (claims.property_ids as number[]) || []

  const m = pathname.match(/^\/h\/(\d+)(\/|$)/)
  if (m) {
    const pid = Number(m[1])
    const allowed = holdingRole !== '' || propertyIds.includes(pid)
    if (!allowed) return new NextResponse('Forbidden — no access to this property', { status: 403 })
  }

  if (pathname.startsWith('/holding') && holdingRole === '') {
    return new NextResponse('Forbidden — holding access only', { status: 403 })
  }

  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
