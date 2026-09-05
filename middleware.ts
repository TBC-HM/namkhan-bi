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
// PBS 2026-07-16: /subscriber/confirm/[token] is the public newsletter opt-in
// confirmation landing (single-purpose page; token = only auth surface).
// PBS brief dataroom-module-v1 (2026-07-30): /room/[token] is the external
// data-room guest surface — token-only auth (per-request grant re-validation
// inside fn_dataroom_guest_* RPCs), zero platform navigation. /api/room/ is
// its serving API. Pattern mirrors /p/ (proposals).
const PUBLIC_PATHS = ['/login', '/auth/callback', '/account/password', '/p/', '/subscriber/confirm/', '/room/']

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

  // ADR-306/307 restore (2026-08-24): this exemption block was destroyed as
  // collateral damage by 439979a5 (2026-08-22 emergency redirect revert), which
  // left every /api/* route 401'd before it could present its own secret —
  // freezing deploy.deployments at 2026-08-22 11:39 and killing the gmail,
  // newsletter and health-sweep crons. Restored verbatim from 63a12396 (last
  // known-good), plus /api/health which ADR-306 named explicitly.
  // Each route below enforces its OWN secret internally; middleware must not
  // pre-empt that. Keep this block ABOVE the Supabase client construction.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/cockpit/webhooks') ||
    pathname.startsWith('/api/cockpit/docs/backup') || // CI pre-deploy backup
    pathname.startsWith('/api/cockpit/health-sweep') || // bug #157 2026-08-03: cron job 188 — internal Bearer gate lives inside the route
    pathname === '/api/health' || // ADR-306: deploy-health probe, both hostnames
    pathname.startsWith('/api/auth/') || // login / request-access / callback exchange
    pathname.startsWith('/api/marketing/media/preview') || // PBS 2026-07-14
    pathname.startsWith('/api/marketing/contacts/extract') || // PBS 2026-07-16 · cron+admin gate lives inside the route
    pathname.startsWith('/api/marketing/gmail/scan-replies') ||
    pathname.startsWith('/api/newsletter/refire-broadcasts') || // job 153 was middleware-401-dead; x-cron-secret gate lives inside the route
    pathname.startsWith('/api/marketing/gmail/extract-shared/') || // job 152 was middleware-401-dead; internal gate lives inside the route
    pathname.startsWith('/api/public/') || // PBS 2026-07-16 (Feature B): public guest confirmation POST
    pathname.startsWith('/api/sales/leads/webhook') || // sales brief A7 2026-07-30: vendor webhook — x-webhook-secret gate inside route
    pathname.startsWith('/api/sales/prospects/import') || // sales brief A7 2026-07-30: server-to-server import — secret gate inside route
    pathname.startsWith('/api/p/') || // PBS 2026-07-16: guest-side /p/[token] view + block tracking
    pathname.startsWith('/api/room/') || // dataroom-module-v1: guest item view/download (token-gated in route)
    pathname === '/api/website/sitemap.xml' || // website-module-v1-slice-cms4-seo: public crawler access (protected_path_decisions id=7)
    pathname === '/api/website/robots.txt' || // website-module-v1-slice-cms4-seo: public crawler access (protected_path_decisions id=7)
    PUBLIC_PATHS.some(p => pathname.startsWith(p))
  ) return NextResponse.next()

  let res = NextResponse.next({ request: { headers: req.headers } })

  // A throw anywhere in middleware is MIDDLEWARE_INVOCATION_FAILED — a hard 500
  // on EVERY route, including pages that need no auth. createServerClient throws
  // when either value is falsy, so an env blip took the whole site down rather
  // than one route (observed intermittently since 2026-07-24). Degrade closed:
  // no client means no verified session, which is exactly the !user path below.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'auth unavailable' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (c) => { c.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)) },
      },
    }
  )

  // A stale/rotated cookie makes getUser() reject with AuthApiError
  // (refresh_token_not_found). Unhandled, that 500s the whole request instead of
  // just sending the user to sign in again. Treat any auth failure as "no user".
  let user: { id: string; email?: string } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'auth required' }, { status: 401 })
    }
    // Let public surfaces through without redirecting — PUBLIC_PATHS was defined
    // but never checked, causing /login → /login?next=/login infinite loops when
    // session cookies are invalid. Fixed 2026-08-24.
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
      return res
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  let accessToken: string | undefined
  try {
    const { data } = await supabase.auth.getSession()
    accessToken = data?.session?.access_token
  } catch {
    accessToken = undefined
  }
  const claims = accessToken ? decodeJwtPayload(accessToken) : {}
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
  const isNamkhanStaff = email.endsWith('@thenamkhan.com')
  const isApiRoute = pathname.startsWith('/api/')
  const isGmailPath = pathname.startsWith('/api/user/gmail') || pathname.startsWith('/settings/gmail')
  if (isNamkhanStaff && !isApiRoute && !isGmailPath) {
    const { data: connections, error: connErr } = await supabase
      .from('v_user_gmail_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle()
    if (!connErr && !connections) {
      const url = req.nextUrl.clone()
      url.pathname = '/api/user/gmail/connect'
      return NextResponse.redirect(url)
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
